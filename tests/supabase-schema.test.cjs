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
  await pg.exec('create role anon; create role authenticated;');
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

test('an incomplete run never replaces the published snapshot', async () => {
  const pg = await db();
  const good = await run(pg, 'complete', ['globok:a', 'globok:b']);
  await pg.query('select publish_source_run($1)', [good]);
  const shrunk = await run(pg, 'complete', ['globok:a']);
  await assert.rejects(pg.query('select publish_source_run($1)', [shrunk]), /previous snapshot preserved/);
  const empty = await run(pg, 'complete', []);
  await assert.rejects(pg.query('select publish_source_run($1)', [empty]), /no animals/);
  const rows = await asAnon(pg, 'select animal_id, run_id from published_animals order by animal_id');
  assert.deepEqual(rows.map(r => [r.animal_id, Number(r.run_id)]), [['globok:a', good], ['globok:b', good]]);
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
