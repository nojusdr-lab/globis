'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../adapters/keturkojo-viltis.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');
const routes = require('../fixtures/keturkojo-viltis/routes.json');

test('keturkojo-viltis: species from rusis, age from "Spėjama gimimo data", status unknown', async () => {
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(routes, []) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  assert.equal(run.state, 'complete');
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const m = byId['keturkojo-viltis:2077'];
  assert.equal(m.name, 'Morana');
  assert.equal(m.species, 'cat');
  assert.equal(m.age_text, '2025-10-01');
  assert.equal(m.sex, null);
  assert.equal(m.status, 'unknown');
  assert.deepEqual(m.photos, ['https://keturkojo-viltis.lt/wp-content/uploads/2026/11/morana.jpg']);
  const t = byId['keturkojo-viltis:2050'];
  assert.equal(t.species, 'dog');
  assert.equal(t.age_text, null);
  assert.deepEqual(t.photos, []);
});
