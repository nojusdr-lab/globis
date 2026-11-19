// Runs the Supabase migrations in an in-memory Postgres (PGlite) and checks the P0 rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'supabase', 'migrations');

async function db() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  // Supabase creates these roles; plain Postgres does not.
  await pg.exec(fs.readFileSync(path.join(__dirname, 'supabase-stub.sql'), 'utf8'));
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    await pg.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  await pg.exec(`
    insert into shelters (id, source, name) values ('s1', 'globok', 'Prieglauda');
    insert into animals (id, source, source_url, shelter_id) values
      ('globok:a', 'globok', 'https://globok.lt/gyvunai/a', 's1'),
      ('globok:b', 'globok', 'https://globok.lt/gyvunai/b', 's1');
  `);
  return pg;
}

async function run(pg, state, ids) {
  const { rows } = await pg.query(
    'insert into source_runs (source, state) values ($1, $2) returning id', ['globok', state]);
  for (const id of ids) {
    await pg.query('insert into snapshot_animals (run_id, animal_id) values ($1, $2)', [rows[0].id, id]);
  }
  return rows[0].id;
}

async function asAnon(pg, sql) {
  await pg.exec('set role anon');
  try { return (await pg.query(sql)).rows; } finally { await pg.exec('reset role'); }
}

test('unknown facts stay null and status defaults to unknown', async () => {
  const pg = await db();
  const id = await run(pg, 'complete', ['globok:a']);
  const { rows } = await pg.query('select * from snapshot_animals where run_id = $1', [id]);
  assert.equal(rows[0].status, 'unknown');
  for (const col of ['name', 'species', 'sex', 'age_text', 'size', 'chipped', 'vaccinated', 'neutered', 'bio_lt']) {
    assert.equal(rows[0][col], null, col);
  }
});

test('failed and partial runs cannot be published', async () => {
  const pg = await db();
  for (const state of ['failed', 'partial', 'running']) {
    const id = await run(pg, state, ['globok:a', 'globok:b']);
    await assert.rejects(pg.query('select publish_source_run($1)', [id]), /only complete runs/);
    await assert.rejects(pg.query(
      'update source_runs set published = true, published_at = now() where id = $1', [id]),
      /published_only_when_complete/);
  }
});

async function addAnimals(pg, n) {
  const ids = Array.from({ length: n }, (_, i) => `globok:x${i}`);
  for (const id of ids) {
    await pg.query('insert into animals (id, source, source_url, shelter_id) values ($1, $2, $3, $4)',
      [id, 'globok', `https://globok.lt/gyvunai/${id.slice(7)}`, 's1']);
  }
  return ids;
}

test('an incomplete run never replaces the published snapshot', async () => {
  const pg = await db();
  const ids = await addAnimals(pg, 10);
  const good = await run(pg, 'complete', ids);
  await pg.query('select publish_source_run($1)', [good]);
  const shrunk = await run(pg, 'complete', ids.slice(0, 5));
  await assert.rejects(pg.query('select publish_source_run($1)', [shrunk]), /previous snapshot preserved/);
  const empty = await run(pg, 'complete', []);
  await assert.rejects(pg.query('select publish_source_run($1)', [empty]), /no animals/);
  const rows = await asAnon(pg, 'select distinct run_id from published_animals');
  assert.deepEqual(rows.map(r => Number(r.run_id)), [good]);
});

test('small sources: a few adoptions publish at once; a big drop needs 3 identical runs', async () => {
  const pg = await db();
  const ids = await addAnimals(pg, 20);
  await pg.query('select publish_source_run($1)', [await run(pg, 'complete', ids)]);
  const twoAdopted = await run(pg, 'complete', ids.slice(2));
  await pg.query('select publish_source_run($1)', [twoAdopted]);
  const half = ids.slice(10);
  const first = await run(pg, 'complete', half);
  await assert.rejects(pg.query('select publish_source_run($1)', [first]), /previous snapshot preserved/);
  const other = await run(pg, 'complete', ids.slice(9));
  await assert.rejects(pg.query('select publish_source_run($1)', [other]), /previous snapshot preserved/);
  const second = await run(pg, 'complete', half);
  await assert.rejects(pg.query('select publish_source_run($1)', [second]), /previous snapshot preserved/, 'runs must be consecutive and identical');
  const third = await run(pg, 'complete', half);
  await assert.rejects(pg.query('select publish_source_run($1)', [third]), /previous snapshot preserved/);
  const fourth = await run(pg, 'complete', half);
  await pg.query('select publish_source_run($1)', [fourth]);
  const rows = await asAnon(pg, 'select count(*)::int as n from published_animals');
  assert.equal(rows[0].n, 10);
});

test('anon reads only published data and cannot write', async () => {
  const pg = await db();
  await run(pg, 'failed', ['globok:a']);
  assert.equal((await asAnon(pg, 'select * from snapshot_animals')).length, 0);
  assert.equal((await asAnon(pg, 'select * from source_runs')).length, 0);
  assert.equal((await asAnon(pg, 'select * from shelters')).length, 1);
  await pg.exec('set role anon');
  try {
    await assert.rejects(pg.query("insert into shelters (id, source, name) values ('x', 'x', 'x')"), /permission denied/);
    await assert.rejects(pg.query("update animals set source = 'x'"), /permission denied/);
    await assert.rejects(pg.query('select publish_source_run(1)'), /permission denied/);
  } finally { await pg.exec('reset role'); }
});

test('status rules: evidence required, disappearance is not adoption', async () => {
  const pg = await db();
  const id = await run(pg, 'complete', []);
  await assert.rejects(pg.query(
    "insert into snapshot_animals (run_id, animal_id, status) values ($1, 'globok:a', 'reserved')", [id]),
    /snapshot_status_evidence/);
  await assert.rejects(pg.query(
    "insert into snapshot_animals (run_id, animal_id, status) values ($1, 'globok:a', 'no_longer_listed')", [id]),
    /snapshot_status_listed/);
  await assert.rejects(pg.query(
    "insert into animal_status_history (animal_id, status) values ('globok:a', 'confirmed_adopted')"),
    /history_status_evidence/);
  await pg.query("insert into animal_status_history (animal_id, status) values ('globok:a', 'no_longer_listed')");
  await assert.rejects(pg.query("insert into animal_status_history (animal_id, status) values ('globok:a', 'adopted')"),
    /invalid input value for enum/);
});

test('public listing identities and history stay private until publication', async () => {
  const pg = await db();
  try {
    const failed = await run(pg, 'failed', ['globok:a']);
    const complete = await run(pg, 'complete', ['globok:b']);
    await pg.query(
      "insert into animal_status_history (animal_id, status, evidence, source_run_id) values ('globok:b', 'reserved', 'Rezervuotas', $1)",
      [failed]);
    await pg.query(`
      insert into animal_status_history (animal_id, status) values
        ('globok:a', 'unknown'), ('globok:b', 'unknown');
    `);

    async function checkPublicRows(expectedIds) {
      for (const role of ['anon', 'authenticated']) {
        await pg.exec('set role ' + role);
        try {
          const identities = await pg.query('select id, source_url from animals order by id');
          assert.deepEqual(identities.rows, expectedIds.map(id => ({
            id, source_url: 'https://globok.lt/gyvunai/' + id.split(':')[1],
          })), role);
          const history = await pg.query('select animal_id, status from animal_status_history order by id');
          assert.deepEqual(history.rows, expectedIds.map(id => ({ animal_id: id, status: 'unknown' })), role);
        } finally { await pg.exec('reset role'); }
      }
    }

    await checkPublicRows([]);
    await pg.query('select publish_source_run($1)', [complete]);
    await checkPublicRows(['globok:b']);
  } finally { await pg.close(); }
});

test('saved: a user sees and changes only their own rows; anon has no access; account deletion cascades', async () => {
  const pg = await db();
  const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
  await pg.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
  const as = async (user, sql) => {
    await pg.exec(`set role authenticated; set request.jwt.claim.sub = '${user}'`);
    try { return (await pg.query(sql)).rows; } finally { await pg.exec("reset role; set request.jwt.claim.sub = ''"); }
  };
  try {
    await as(A, "insert into saved (user_id, animal_id) values ('" + A + "', 'lese:1')");
    await as(B, "insert into saved (user_id, animal_id) values ('" + B + "', 'lese:2')");
    assert.deepEqual((await as(A, 'select animal_id from saved')).map(r => r.animal_id), ['lese:1']);
    await assert.rejects(as(A, "insert into saved (user_id, animal_id) values ('" + B + "', 'lese:3')"), /row-level security/);
    await as(A, "delete from saved where animal_id = 'lese:2'"); // B's row: invisible to A, not deleted
    assert.equal((await pg.query("select count(*)::int n from saved where user_id = '" + B + "'")).rows[0].n, 1);
    await assert.rejects(asAnon(pg, 'select * from saved'), /permission denied/);
    await assert.rejects(asAnon(pg, 'select delete_own_account()'), /permission denied/);
    await as(A, 'select delete_own_account()');
    assert.deepEqual((await pg.query('select id from auth.users')).rows.map(r => r.id), [B]);
    assert.equal((await pg.query("select count(*)::int n from saved where user_id = '" + A + "'")).rows[0].n, 0);
  } finally { await pg.close(); }
});

test('a delayed older observation cannot replace a newer published source snapshot', async () => {
  const pg = await db();
  try {
    const newer = await run(pg, 'complete', ['globok:b']);
    const delayed = await run(pg, 'complete', ['globok:a']);
    await pg.query("update source_runs set started_at = '2026-01-02T00:00:00Z' where id = $1", [newer]);
    await pg.query("update source_runs set started_at = '2026-01-01T00:00:00Z' where id = $1", [delayed]);
    await pg.query('select publish_source_run($1)', [newer]);
    await assert.rejects(pg.query('select publish_source_run($1)', [delayed]), /older/);
    assert.deepEqual((await asAnon(pg, 'select animal_id from published_animals')).map(row => row.animal_id), ['globok:b']);
  } finally { await pg.close(); }
});

test('replaying an already published run leaves its timestamp and the current snapshot unchanged', async () => {
  const pg = await db();
  try {
    const first = await run(pg, 'complete', ['globok:a']);
    const second = await run(pg, 'complete', ['globok:b']);
    await pg.query('select publish_source_run($1)', [first]);
    const before = (await pg.query('select published_at from source_runs where id = $1', [first])).rows[0].published_at;
    await pg.query('select publish_source_run($1)', [second]);
    await pg.query('select publish_source_run($1)', [first]);
    const after = (await pg.query('select published_at from source_runs where id = $1', [first])).rows[0].published_at;
    assert.equal(after.getTime(), before.getTime());
    assert.deepEqual((await asAnon(pg, 'select animal_id from published_animals')).map(row => row.animal_id), ['globok:b']);
  } finally { await pg.close(); }
});

test('backdated complete runs cannot confirm a large drop after a newer published observation', async () => {
  const pg = await db();
  try {
    const ids = Array.from({ length: 10 }, (_, i) => 'sample:' + i);
    for (const id of ids) await pg.query('insert into animals (id, source, source_url) values ($1,$2,$3)',
      [id, 'globok', 'https://source.invalid/' + id]);
    const previous = await run(pg, 'complete', ids);
    await pg.query("update source_runs set started_at = '2026-01-10T00:00:00Z' where id = $1", [previous]);
    await pg.query('select publish_source_run($1)', [previous]);
    for (let i = 0; i < 2; i++) {
      const old = await run(pg, 'complete', ids.slice(0, 5));
      await pg.query("update source_runs set started_at = '2026-01-01T00:00:00Z' where id = $1", [old]);
    }
    const current = await run(pg, 'complete', ids.slice(0, 5));
    await pg.query("update source_runs set started_at = '2026-01-11T00:00:00Z' where id = $1", [current]);
    await assert.rejects(pg.query('select publish_source_run($1)', [current]), /previous snapshot preserved/);
    assert.equal((await asAnon(pg, 'select * from published_animals')).length, 10);
  } finally { await pg.close(); }
});

test('publication rejects a repeatable-read snapshot that could predate its source lock', async () => {
  const pg = await db();
  try {
    const id = await run(pg, 'complete', ['globok:a']);
    await pg.query('begin isolation level repeatable read');
    await assert.rejects(pg.query('select publish_source_run($1)', [id]), /read committed/i);
  } finally {
    await pg.query('rollback');
    await pg.close();
  }
});
