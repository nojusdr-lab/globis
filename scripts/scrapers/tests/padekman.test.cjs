'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/padekman.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const dir = path.join(__dirname, '../fixtures/padekman');
const home = fs.readFileSync(path.join(dir, 'home.html'), 'utf8');
const robots = fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8');
// SYNTHETIC variant (see fixtures README): the same real page with the list's page count set to 1.
const homeOnePage = home.replace('data-max-num-pages=5', 'data-max-num-pages=1');

const routesFor = body => ({
  'https://padekman.lt/robots.txt': { body: robots, headers: { 'content-type': 'text/plain' } },
  'https://padekman.lt/': { body, headers: { 'content-type': 'text/html' } },
});

async function collect(routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(routes, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('padekman: robots.txt first, then one GET of the home page list', async () => {
  const { calls } = await collect(routesFor(home));
  assert.deepEqual(calls.map(c => c.url), ['https://padekman.lt/robots.txt', 'https://padekman.lt/']);
  assert.ok(calls.every(c => c.method === 'GET'));
});

test('padekman: parses cards from the "Ieško namų" list; unknown facts stay null', async () => {
  const { run } = await collect(routesFor(homeOnePage));
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 20);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const lika = byId['padekman:6975'];
  assert.equal(lika.name, 'Lika');
  assert.equal(lika.species, 'dog');
  assert.equal(lika.sourceUrl, 'https://padekman.lt/portfolio-item/lika/');
  assert.deepEqual(lika.photos, ['https://padekman.lt/wp-content/uploads/2021/11/LIKA_mini.jpg']);
  assert.equal(lika.status, 'available');
  assert.equal(lika.statusEvidence, 'Ieško namų');
  for (const f of ['sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(lika[f], null, `${f} is not on the list page`);
  }
  const vasilij = byId['padekman:7277'];
  assert.equal(vasilij.name, 'Nr.12 Vasilij');
  assert.equal(vasilij.species, 'cat');
  assert.equal(run.animals.filter(a => a.species === 'dog').length, 5);
  assert.equal(run.animals.filter(a => a.species === 'cat').length, 15);
});

test('padekman: contradicting status labels give unknown, not a guess', async () => {
  const { run } = await collect(routesFor(homeOnePage));
  const viola = run.animals.find(a => a.id === 'padekman:7298');
  assert.equal(viola.name, 'Nr.94 Viola');
  assert.equal(viola.status, 'unknown', 'card has both "Ieško namų" and "Rado namus"');
  assert.equal(viola.statusEvidence, null);
  assert.equal(run.animals.filter(a => a.status === 'available').length, 19);
});

test('padekman: label rules (reserved/adopted need evidence; excluded dropped)', () => {
  assert.deepEqual(adapter._fromLabels(['Rado namus', 'Šunys']), { status: 'confirmed_adopted', statusEvidence: 'Rado namus', species: 'dog' });
  assert.deepEqual(adapter._fromLabels(['Katės']), { status: 'unknown', statusEvidence: null, species: 'cat' });
  assert.deepEqual(adapter._fromLabels(['Ieško namų', 'Šunys', 'Katės']).species, null);
});

test('padekman: list has 5 pages but only page 1 is reachable by GET -> partial, never published', async () => {
  const { run, calls } = await collect(routesFor(home));
  assert.equal(run.animals.length, 20);
  assert.equal(run.state, 'partial');
  assert.equal(calls.length, 2, 'does not invent page URLs');
});

test('padekman: a failing page makes the run failed', async () => {
  const routes = routesFor(home);
  routes['https://padekman.lt/'] = { status: 500, body: 'error' };
  const { run } = await collect(routes);
  assert.equal(run.state, 'failed');
});

test('padekman: layout change (no list) fails instead of returning nothing', async () => {
  const { run } = await collect(routesFor('<html><body>nauja svetainė</body></html>'));
  assert.equal(run.state, 'failed');
});
