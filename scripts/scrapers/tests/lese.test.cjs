'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/lese.cjs');
const { createLeseAdapter } = require('../adapters/lese.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const fx = name => fs.readFileSync(path.join(__dirname, '../fixtures/lese', name), 'utf8');
const ROBOTS = '\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nSitemap: https://lese.lt/wp-sitemap.xml\n';
const P1 = 'https://lese.lt/lese-globotiniai/?stat=1';
const P2 = 'https://lese.lt/lese-globotiniai/page/2/?stat=1';
const routes = {
  'https://lese.lt/robots.txt': { body: ROBOTS, headers: { 'content-type': 'text/plain' } },
  [P1]: { body: fx('list-page-1.html') },
  [P2]: { body: fx('list-page-2.html') },
};

async function collect(r = routes, a = adapter) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('lese: robots.txt first, then only the filtered list pages, all GET to lese.lt', async () => {
  const { calls } = await collect();
  assert.deepEqual(calls.map(c => c.url), ['https://lese.lt/robots.txt', P1, P2]);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'lese.lt'));
});

test('lese: parses cards, keeps unknown facts null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 20);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const a = byId['lese:en-urve'];
  assert.equal(a.name, 'Urvė');
  assert.equal(a.sourceUrl, 'https://lese.lt/globotiniai/en-urve/');
  assert.equal(a.status, 'available');
  assert.equal(a.statusEvidence, 'Ieško namų');
  assert.deepEqual(a.photos, ['https://lese.lt/wp-content/uploads/2026/11/ae872ad717ce86e7de61c7df5e2b8a8f-768x1024.jpeg']);
  for (const f of ['species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} is not on the list page`);
  }
  assert.equal(byId['lese:51862-2'].name, null, 'empty name on page stays null');
});

test('lese: statuses come from page text, with evidence', async () => {
  const { run } = await collect();
  const count = {};
  for (const a of run.animals) count[a.status] = (count[a.status] || 0) + 1;
  assert.deepEqual(count, { available: 7, reserved: 3, unknown: 2, confirmed_adopted: 8 });
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.equal(byId['lese:51826-2'].status, 'reserved');
  assert.equal(byId['lese:51826-2'].statusEvidence, 'Rezervuotas');
  assert.equal(byId['lese:51830-2'].status, 'confirmed_adopted');
  assert.equal(byId['lese:51830-2'].statusEvidence, 'Rado namus');
  assert.equal(byId['lese:51842-2'].status, 'unknown', '"Karantinuojamas" is not a known status');
  assert.equal(byId['lese:51842-2'].statusEvidence, null);
  for (const a of run.animals) {
    if (a.status === 'reserved' || a.status === 'confirmed_adopted') assert.ok(a.statusEvidence);
  }
});

test('lese: pagination stops on the last page (current page, no next)', async () => {
  const { run, calls } = await collect();
  assert.equal(run.state, 'complete');
  assert.ok(!calls.some(c => /page\/3/.test(c.url)));
});

test('lese: page limit reached = not complete (partial, never published)', async () => {
  const { run, calls } = await collect(routes, createLeseAdapter({ maxPages: 1 }));
  assert.equal(run.state, 'partial');
  assert.equal(calls.length, 2);
});

test('lese: a failing page makes the whole run failed', async () => {
  const broken = { ...routes };
  delete broken[P2];
  const { run } = await collect(broken);
  assert.equal(run.state, 'failed');
});

test('lese: a page without the animal list fails instead of returning nothing', async () => {
  const { run } = await collect({ ...routes, [P1]: { body: '<html><body><main>Klaida</main></body></html>' } });
  assert.equal(run.state, 'failed');
});
