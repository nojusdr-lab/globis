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
  await pg.exec('create role anon; create role authenticated;');
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
  assert.equal(rows[1].status, 'reserved');
  assert.equal(rows[1].status_evidence, 'Rezervuotas');
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
