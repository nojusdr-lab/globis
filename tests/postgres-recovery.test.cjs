// Real PostgreSQL integration. The CI service is disposable and contains fixtures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');
const { dumpSnapshot } = require('../scripts/scrapers/backup-dump.cjs');
const input = process.env.GLOBIS_TEST_DATABASE_URL;

test('PostgreSQL source locks, transaction clocks and encrypted recovery', { skip: !input, timeout: 60000 }, async t => {
  const url = new URL(input);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.pathname, '/globis_test', 'only the disposable CI service may be used');
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const clients = [], created = [];
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-recovery-'));
  async function createDatabase() {
    const name = 'globis_test_' + randomUUID().replace(/-/g, '');
    await admin.query('create database "' + name + '"');
    created.push(name);
    const target = new URL(url);
    target.pathname = '/' + name;
    const client = new Client({ connectionString: target.toString(), query_timeout: 5000 });
    await client.connect();
    clients.push(client);
    return { client, connection: target.toString() };
  }
  async function connect(connection) {
    const client = new Client({ connectionString: connection, query_timeout: 5000 });
    await client.connect();
    clients.push(client);
    return client;
  }
  try {
    const source = await createDatabase(), db = source.client;
    await db.query(fs.readFileSync(path.join(__dirname, 'supabase-stub.sql'), 'utf8'));
    for (const file of fs.readdirSync(path.join(__dirname, '../supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
      await db.query(fs.readFileSync(path.join(__dirname, '../supabase/migrations', file), 'utf8'));
    }
    async function seed(sourceId, date, name) {
      const animal = sourceId + ':a';
      await db.query('insert into animals(id,source,source_url) values($1,$2,$3) on conflict do nothing',
        [animal, sourceId, 'https://fixture.invalid/' + sourceId]);
      const result = await db.query("insert into source_runs(source,state,started_at) values($1,'complete',$2) returning id", [sourceId, date]);
      const id = result.rows[0].id;
      await db.query('insert into snapshot_animals(run_id,animal_id,name) values($1,$2,$3)', [id, animal, name]);
      return id;
    }
    const a = await connect(source.connection), b = await connect(source.connection);

    await t.test('same-source publication waits while a different source can publish', async () => {
      const older = await seed('concurrent', '2026-01-01', 'older');
      const newer = await seed('concurrent', '2026-01-02', 'newer');
      const independent = await seed('independent', '2026-01-01', 'independent');
      const pid = (await b.query('select pg_backend_pid() as id')).rows[0].id;
      await a.query('begin');
      await a.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['globis:publish:concurrent']);
      const pending = b.query('select publish_source_run($1)', [newer]).then(() => null, error => error);
      try {
        let waiting = false;
        const deadline = Date.now() + 2500;
        while (Date.now() < deadline && !waiting) {
          waiting = (await db.query("select wait_event = 'advisory' as waiting from pg_stat_activity where pid=$1", [pid])).rows[0]?.waiting;
          if (!waiting) await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.ok(waiting, 'publication must wait on the same source lock');
        await db.query('select publish_source_run($1)', [independent]);
        await a.query('select publish_source_run($1)', [older]);
        await a.query('commit');
        assert.equal(await pending, null);
        const rows = (await db.query("select name from published_animals where source='concurrent'")).rows;
        assert.deepEqual(rows, [{ name: 'newer' }]);
      } finally {
        await a.query('rollback');
        await pending;
      }
    });

    await t.test('an earlier transaction can publish the latest observation without rewinding the visible head', async () => {
      const older = await seed('clock', '2026-01-01', 'older');
      const newer = await seed('clock', '2026-01-02', 'newer');
      await a.query('begin');
      try {
        await b.query('select pg_sleep(0.02)');
        await b.query('select publish_source_run($1)', [older]);
        await a.query('select publish_source_run($1)', [newer]);
        await a.query('commit');
        assert.deepEqual((await db.query("select name from published_animals where source='clock'")).rows, [{ name: 'newer' }]);
      } finally { await a.query('rollback'); }
    });

    await t.test('one snapshot restores accounts, identities, saved rows, RLS and grants after encryption', async () => {
      await db.query('create table auth.identities(id uuid primary key,user_id uuid references auth.users(id),provider text)');
      const user = '00000000-0000-0000-0000-000000000001';
      const later = '00000000-0000-0000-0000-000000000002';
      await db.query("insert into auth.users values($1);", [user]);
      await db.query("insert into auth.identities values($1,$1,'email')", [user]);
      await db.query("insert into saved(user_id,animal_id) values($1,'clock:a')", [user]);
      // Add another account after export but before either dump. Both dumps must
      // exclude it, proving they share the same view of the database.
      const query = db.query.bind(db);
      const observed = { query: async (...args) => {
        const result = await query(...args);
        if (args[0] === 'select pg_export_snapshot() as snapshot') {
          await b.query('insert into auth.users values($1)', [later]);
          await b.query("insert into saved(user_id,animal_id) values($1,'clock:a')", [later]);
        }
        return result;
      } };
      const dump = path.join(temporary, 'dump');
      await dumpSnapshot(observed, source.connection, dump);
      const tar = path.join(temporary, 'dump.tar.gz'), encrypted = tar + '.gpg';
      const home = path.join(temporary, 'gnupg');
      fs.mkdirSync(home, { mode: 0o700 });
      const env = { ...process.env, GNUPGHOME: home };
      const passphrase = 'Local fixture passphrase only\n';
      execFileSync('tar', ['-czf', tar, '-C', dump, 'public.sql', 'auth-users.sql']);
      execFileSync('gpg', ['--batch', '--yes', '--pinentry-mode', 'loopback', '--no-symkey-cache',
        '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256', '-o', encrypted, tar],
        { env, input: passphrase, stdio: ['pipe', 'pipe', 'pipe'] });
      const plain = execFileSync('gpg', ['--batch', '--pinentry-mode', 'loopback', '--no-symkey-cache',
        '--passphrase-fd', '0', '-d', encrypted], { env, input: passphrase });
      const restoredFiles = path.join(temporary, 'decrypted');
      fs.mkdirSync(restoredFiles);
      execFileSync('tar', ['-xzf', '-', '-C', restoredFiles], { input: plain });
      const target = await createDatabase();
      const auth = fs.readFileSync(path.join(__dirname, 'supabase-stub.sql'), 'utf8').replace(/^create role \w+;\n/gm, '');
      await target.client.query(auth);
      await target.client.query('create table auth.identities(id uuid primary key,user_id uuid references auth.users(id),provider text)');
      // The destination is a new, randomly named fixture database.
      await target.client.query('drop schema public cascade');
      execFileSync('psql', [target.connection, '--set=ON_ERROR_STOP=1', '--single-transaction',
        '-f', path.join(restoredFiles, 'auth-users.sql'), '-f', path.join(restoredFiles, 'public.sql')],
        { stdio: 'pipe' });
      assert.deepEqual((await target.client.query('select id from auth.users')).rows, [{ id: user }]);
      assert.deepEqual((await target.client.query('select user_id from auth.identities')).rows, [{ user_id: user }]);
      await target.client.query("set role authenticated; set request.jwt.claim.sub = '" + user + "'");
      assert.deepEqual((await target.client.query('select animal_id from saved')).rows, [{ animal_id: 'clock:a' }]);
      await target.client.query('reset role; set role anon');
      assert.deepEqual((await target.client.query("select name from published_animals where source='clock'")).rows, [{ name: 'newer' }]);
      await assert.rejects(target.client.query('select * from saved'), /permission denied/);
      await target.client.query('reset role');
    });
  } finally {
    await Promise.allSettled(clients.map(client => client.end()));
    for (const name of created) await admin.query('drop database "' + name + '" with (force)');
    await admin.end();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
