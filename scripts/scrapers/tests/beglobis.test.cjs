'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/beglobis.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const home = fs.readFileSync(path.join(__dirname, '../fixtures/beglobis/home.html'), 'utf8');

const routesFor = body => ({
  // Real probe answer (2026-11-16): robots.txt is HTTP 404 = no rules.
  'http://www.beglobis.com/robots.txt': { status: 404, body: 'Not Found', headers: { 'content-type': 'text/html' } },
  'http://www.beglobis.com/': { body, headers: { 'content-type': 'text/html; charset=UTF-8' } },
});

async function collect(routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(routes, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('beglobis: robots.txt first, then one GET of the home page; no invented URLs', async () => {
  const { calls } = await collect(routesFor(home));
  assert.deepEqual(calls.map(c => c.url), ['http://www.beglobis.com/robots.txt', 'http://www.beglobis.com/']);
  assert.ok(calls.every(c => c.method === 'GET'));
});

test('beglobis: parses the "Ieško namų" cards; unknown facts stay null', async () => {
  const { run } = await collect(routesFor(home));
  assert.deepEqual(run.animals.map(a => a.id), ['beglobis:3084', 'beglobis:3963']);
  const a = run.animals[0];
  assert.equal(a.sourceUrl, 'http://www.beglobis.com/Mylia-684.html?productid=3084&reset=1');
  assert.deepEqual(a.photos, ['http://www.beglobis.com/page/upload/modproduct_5ccc8b6c24a26_s1.jpg']);
  assert.equal(a.status, 'available');
  assert.equal(a.statusEvidence, 'Ieško namų');
  for (const f of ['name', 'species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} is not written on the home page`);
  }
  assert.deepEqual(run.skipped, []);
});

test('beglobis: status comes only from the block heading text', async () => {
  // SYNTHETIC reshape: heading replaced with the real nav label "Gyvūnai" (no status meaning).
  const { run } = await collect(routesFor(home.replace('>Ieško namų</h2>', '>Gyvūnai</h2>')));
  assert.ok(run.animals.every(a => a.status === 'unknown' && a.statusEvidence === null));
});

test('beglobis: home block is a subset of the full list -> partial, never published', async () => {
  const { run, calls } = await collect(routesFor(home));
  assert.equal(run.state, 'partial');
  assert.equal(calls.length, 2);
  assert.match(adapter._parseHome(home, 'http://www.beglobis.com/').fullList, /\/Dovanojami-684\.html$/);
});

test('beglobis: a failing page makes the run failed', async () => {
  const routes = routesFor(home);
  routes['http://www.beglobis.com/'] = { status: 500, body: 'error' };
  const { run } = await collect(routes);
  assert.equal(run.state, 'failed');
});

test('beglobis: layout change (no block) fails instead of returning nothing', async () => {
  const { run } = await collect(routesFor('<html><body><div id="left"></div></body></html>'));
  assert.equal(run.state, 'failed');
});
