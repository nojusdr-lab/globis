'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/tautmilesgloba.cjs');
const { createTautmilesglobaAdapter } = require('../adapters/tautmilesgloba.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const fx = name => fs.readFileSync(path.join(__dirname, '../fixtures/tautmilesgloba', name), 'utf8');
// Verbatim robots.txt from the 2026-11-16 probe.
const ROBOTS = '# START YOAST BLOCK\n# ---------------------------\nUser-agent: *\nDisallow:\n\nSitemap: https://tautmilesgloba.lt/sitemap_index.xml\n# ---------------------------\n# END YOAST BLOCK';
const ROBOTS_URL = 'https://tautmilesgloba.lt/robots.txt';
const P1 = 'https://tautmilesgloba.lt/dovanojami/';
const P2 = 'https://tautmilesgloba.lt/dovanojami/page/2/';
const robots = { body: ROBOTS, headers: { 'content-type': 'text/plain' } };
const routes = { [ROBOTS_URL]: robots, [P1]: { body: fx('dovanojami.html') } };
const pagedRoutes = { [ROBOTS_URL]: robots, [P1]: { body: fx('synthetic-page-1.html') }, [P2]: { body: fx('synthetic-page-2.html') } };

async function collect(r = routes, a = adapter) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('tautmilesgloba: robots.txt first, then one list page, all GET to tautmilesgloba.lt', async () => {
  const { calls } = await collect();
  assert.deepEqual(calls.map(c => c.url), [ROBOTS_URL, P1]);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'tautmilesgloba.lt'));
  assert.ok(adapter.hosts.includes('tautmilesgloba.lt') && adapter.hosts.includes('www.tautmilesgloba.lt'));
});

test('tautmilesgloba: parses the 19 real cards, ignores spam links, unknown facts stay null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 19);
  assert.ok(run.animals.every(a => new URL(a.sourceUrl).pathname.startsWith('/gyvunai/')), 'no spam links');
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const a = byId['tautmilesgloba:cipas-3'];
  assert.equal(a.name, 'Čipas');
  assert.equal(a.sourceUrl, 'https://tautmilesgloba.lt/gyvunai/cipas-3/');
  assert.deepEqual(a.photos, ['https://tautmilesgloba.lt/wp-content/uploads/2026/08/IMG_4092-500x500.jpg']);
  for (const f of ['species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} is not on the list page`);
  }
  assert.equal(byId['tautmilesgloba:dzordzia-sodyboj'].name, 'Džordžia');
});

test('tautmilesgloba: status comes from page text with evidence; missing text = unknown', async () => {
  const { run } = await collect();
  assert.ok(run.animals.every(a => a.status === 'available' && a.statusEvidence === 'Dovanojamas'));
  // Same real page with one card's alt text removed: no status text = unknown, no evidence.
  const html = fx('dovanojami.html').replace(
    /(IMG_4092-500x500\.jpg" class="img-responsive archive-gyvunas-img") alt="Dovanojamas"/, '$1 alt=""');
  const { run: r2 } = await collect({ ...routes, [P1]: { body: html } });
  const c = r2.animals.find(a => a.id === 'tautmilesgloba:cipas-3');
  assert.equal(c.status, 'unknown');
  assert.equal(c.statusEvidence, null);
});

test('tautmilesgloba: walks pagination to the last page and stops', async () => {
  const { run, calls } = await collect(pagedRoutes);
  assert.deepEqual(calls.map(c => c.url), [ROBOTS_URL, P1, P2]);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 19);
});

test('tautmilesgloba: cannot prove the end = partial (never published)', async () => {
  const limited = createTautmilesglobaAdapter({ maxPages: 1 });
  const { run } = await collect(pagedRoutes, limited);
  assert.equal(run.state, 'partial');
  const noBlock = fx('dovanojami.html').replace(/<div class="archive-pagination">[\s\S]*?<\/div>/, '');
  const { run: r2 } = await collect({ ...routes, [P1]: { body: noBlock } });
  assert.equal(r2.state, 'partial', 'missing pagination block = end not proven');
});

test('tautmilesgloba: a failing page makes the whole run failed', async () => {
  const broken = { ...pagedRoutes, [P2]: { status: 500, body: 'error' } };
  const { run } = await collect(broken);
  assert.equal(run.state, 'failed');
  const { run: r2 } = await collect({ ...routes, [P1]: { body: '<html><body>Maintenance</body></html>' } });
  assert.equal(r2.state, 'failed', 'layout change fails loudly');
});
