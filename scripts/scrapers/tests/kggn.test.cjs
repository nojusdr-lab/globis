'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../adapters/kggn.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');
const routes = require('../fixtures/kggn/routes.json');

async function collect(r = routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('kggn: maps WordPress taxonomies to facts, keeps unknowns null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), ['kggn:9001', 'kggn:9002', 'kggn:9004']);
  const a = byId['kggn:9001'];
  assert.equal(a.name, 'TESTAS');
  assert.equal(a.species, 'dog');
  assert.equal(a.sex, 'male');
  assert.equal(a.age_text, '2022');
  assert.equal(a.status, 'available');
  assert.deepEqual(a.photos, ['https://kggn.lt/wp-content/uploads/2025/02/testas.jpg']);
  assert.doesNotMatch(a.bio_lt, /600/, 'phone removed');
  const r = byId['kggn:9002'];
  assert.equal(r.status, 'reserved');
  assert.equal(r.statusEvidence, 'Rezervuotas');
  assert.equal(r.age_text, null);
  const u = byId['kggn:9004'];
  assert.equal(u.species, null, 'two species terms = ambiguous = unknown');
  assert.equal(u.status, 'unknown');
  assert.deepEqual(run.skipped, [{ nativeId: '9003', reason: 'Grįžo namo' }]);
});

test('kggn: a failing page makes the whole run failed (never published)', async () => {
  const broken = { ...routes };
  delete broken['https://kggn.lt/wp-json/wp/v2/media?include=501&per_page=100&_fields=id,source_url'];
  const { run } = await collect(broken);
  assert.equal(run.state, 'failed');
});

test('kggn: robots.txt is read first and every request is a GET to kggn.lt', async () => {
  const { calls } = await collect();
  assert.equal(calls[0].url, 'https://kggn.lt/robots.txt');
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'kggn.lt'));
});
