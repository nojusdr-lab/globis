'use strict';
// End-to-end: kggn fixture -> adapter -> run -> Supabase schema (in-memory Postgres).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/kggn.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { loadRun } = require('../lib/supabase-load.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');
const routes = require('../fixtures/kggn/routes.json');

async function db() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(__dirname, '../../../tests/supabase-stub.sql'), 'utf8'));
  const dir = path.join(__dirname, '../../../supabase/migrations');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  return pg;
}

async function collect(r = routes) {
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r) });
  return runSource(adapter, { fetcher, cache: createParseCache(null) });
}

test('supabase: a complete run is published; nulls stay null; anon sees it', async () => {
  const pg = await db();
  const res = await loadRun(pg, adapter, await collect());
  assert.equal(res.published, true, res.reason);
  await pg.exec('set role anon');
  const { rows } = await pg.query('select animal_id, species, sex, age_text, status, status_evidence, vaccinated from published_animals order by animal_id');
  await pg.exec('reset role');
  assert.deepEqual(rows.map(r => r.animal_id), ['kggn:9001', 'kggn:9002', 'kggn:9004']);
  assert.equal(rows[1].status, 'confirmed_adopted');
  assert.equal(rows[1].status_evidence, 'Rado namus');
  assert.equal(rows[2].species, null);
  assert.equal(rows[0].vaccinated, null);
});

test('supabase: a failed run is stored but never published; last good copy stays', async () => {
  const pg = await db();
  await loadRun(pg, adapter, await collect());
  const broken = { ...routes };
  delete broken['https://kggn.lt/wp-json/wp/v2/media?include=501&per_page=100&_fields=id,source_url'];
  const res = await loadRun(pg, adapter, await collect(broken));
  assert.equal(res.published, false);
  const { rows } = await pg.query('select count(*)::int as n from published_animals');
  assert.equal(rows[0].n, 3);
});

test('supabase: an animal that disappears becomes no_longer_listed, not adopted', async () => {
  const pg = await db();
  await loadRun(pg, adapter, await collect());
  const key = Object.keys(routes).find(k => k.includes('/globotiniai?'));
  const fewer = { ...routes, [key]: { body: routes[key].body.filter(p => p.id !== 9004) } };
  const res = await loadRun(pg, adapter, await collect(fewer));
  assert.equal(res.published, true, res.reason);
  const { rows } = await pg.query(`select status from animal_status_history where animal_id = 'kggn:9004' order by id`);
  assert.deepEqual(rows.map(r => r.status), ['unknown', 'no_longer_listed']);
});

test('supabase: a DB error mid-load leaves no partial run; last good copy stays', async () => {
  const pg = await db();
  await loadRun(pg, adapter, await collect());
  const run = await collect();
  run.animals = [...run.animals, { ...run.animals[0], id: 'kggn:bad', status: 'not-a-status' }];
  await assert.rejects(loadRun(pg, adapter, run));
  const runs = await pg.query('select count(*)::int as n from public.source_runs');
  assert.equal(runs.rows[0].n, 1);
  const { rows } = await pg.query('select count(*)::int as n from published_animals');
  assert.equal(rows[0].n, 3);
});

test('supabase: publishing takes a per-source lock before reading the previous snapshot', async () => {
  const pg = await db();
  const seen = [];
  const spy = { query: (sql, params) => { seen.push(sql.trim().split(/\s+/).slice(0, 4).join(' ')); return pg.query(sql, params); } };
  const res = await loadRun(spy, adapter, await collect());
  assert.equal(res.published, true, res.reason);
  const lock = seen.findIndex(s => s.includes('pg_advisory_xact_lock'));
  const prev = seen.findIndex(s => s.startsWith('select id from public.source_runs'));
  assert.ok(lock > -1 && lock < prev, seen.join('\n'));
});

test('supabase: the app read path (anon view -> fromRemote) gives the same pets as the bundled path', async () => {
  const { fromRemote, toAppPet, shelterResolver } = require('../../../src/data/appPet.cjs');
  const shelters = require('../../../src/data/shelters.json');
  const pg = await db();
  const run = await collect();
  assert.equal((await loadRun(pg, adapter, run)).published, true);
  await pg.exec('set role anon');
  const { rows } = await pg.query('select * from published_animals order by animal_id');
  await pg.exec('reset role');
  const viaServer = fromRemote(rows, shelters, []);
  const byId = new Map(shelters.map(s => [s.id, s]));
  const published = run.animals.filter(a => rows.some(r => r.animal_id === a.id));
  const bundled = published.map(a => toAppPet(a, shelterResolver(a.source, byId)(a)));
  assert.equal(viaServer.length, 3);
  assert.equal(viaServer.length, bundled.length);
  // sourceUpdatedAt is not stored in snapshot_animals; everything else must match.
  const strip = p => ({ ...p, sourceUpdatedAt: null });
  assert.deepEqual(viaServer.map(strip).sort((x, y) => x.id.localeCompare(y.id)),
    bundled.map(strip).sort((x, y) => x.id.localeCompare(y.id)));
});

test('supabase: in_shelter reaches the app view; a database without the column still loads', async () => {
  const pg = await db();
  const run = await collect();
  run.animals = run.animals.map((a, i) => ({ ...a, in_shelter: i === 0 ? 'nuo 2026-09-13' : null }));
  assert.equal((await loadRun(pg, adapter, run)).published, true);
  await pg.exec('set role anon');
  const { rows } = await pg.query('select animal_id, in_shelter from published_animals order by animal_id');
  await pg.exec('reset role');
  assert.equal(rows[0].in_shelter, 'nuo 2026-09-13');
  // Before the migration is applied: information_schema has no in_shelter, so the insert leaves it out.
  const sql = [];
  const old = { query: (q, p) => { sql.push(q); return /information_schema/.test(q) ? { rows: [] } : pg.query(q, p); } };
  await loadRun(old, adapter, await collect());
  assert.ok(sql.some(q => /insert into public\.snapshot_animals/.test(q)));
  assert.ok(!sql.some(q => /insert into public\.snapshot_animals[\s\S]*in_shelter/.test(q)));
});
