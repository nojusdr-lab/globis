'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/lese.cjs').createLeseAdapter({ details: false });
const { createLeseAdapter } = require('../adapters/lese.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const fx = name => fs.readFileSync(path.join(__dirname, '../fixtures/lese', name), 'utf8');
const ROBOTS = '\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nSitemap: https://lese.lt/wp-sitemap.xml\n';
const L = 'https://lese.lt/lese-globotiniai/';
const P1 = `${L}?stat=1`;
const P2 = `${L}page/2/?stat=1`;
const SUO = `${L}?stat=1&type=suo`;
const OTHER_TYPES = ['grauzikas', 'kate', 'kita', 'paukstis', 'roplys', 'seskas'];

// SYNTHETIC (see fixtures/lese/README.md): the probe has no page for these types, so the test
// serves the real page-1 shell with no cards, no pagination and that type selected.
function emptyTypePage(type) {
  return fx('stat1-page-1.html')
    .replace(/<div class="animals-list">[\s\S]*?<div class="pagination">/, '<div class="animals-list">\n</div>\n<div class="pagination">')
    .replace(/<div class="pagination loop-pagination">[\s\S]*?<\/div>/, '<div class="pagination loop-pagination">\n</div>')
    .replace(`<option value="${type}">`, `<option value="${type}" selected>`);
}

const routes = {
  'https://lese.lt/robots.txt': { body: ROBOTS, headers: { 'content-type': 'text/plain' } },
  [P1]: { body: fx('stat1-page-1.html') },
  [P2]: { body: fx('stat1-page-2.html') },
  [SUO]: { body: fx('stat1-type-suo-page-1.html') },
  ...Object.fromEntries(OTHER_TYPES.map(t => [`${L}?stat=1&type=${t}`, { body: emptyTypePage(t) }])),
};

async function collect(r = routes, a = adapter) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('lese: robots.txt first, then the stat=1 list, then one walk per type; all GET to lese.lt', async () => {
  const { calls } = await collect();
  assert.deepEqual(calls.map(c => c.url), [
    'https://lese.lt/robots.txt', P1, P2,
    ...['grauzikas', 'kate', 'kita', 'paukstis', 'roplys', 'seskas', 'suo'].map(t => `${L}?stat=1&type=${t}`),
  ]);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'lese.lt'));
  assert.ok(!calls.some(c => /stat=(2|3|4|7|8)/.test(c.url)), 'no adopted/other status lists');
});

test('lese: parses cards, species from the type filter, unknown facts stay null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 43);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const a = byId['lese:en-urve'];
  assert.equal(a.name, 'Urvė');
  assert.equal(a.sourceUrl, 'https://lese.lt/globotiniai/en-urve/');
  assert.equal(a.species, 'dog', 'listed under type=suo (Šuo)');
  assert.equal(a.status, 'available');
  assert.equal(a.statusEvidence, 'Ieško namų');
  assert.deepEqual(a.photos, ['https://lese.lt/wp-content/uploads/2026/11/ae872ad717ce86e7de61c7df5e2b8a8f-768x1024.jpeg']);
  for (const f of ['sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} is not on the list page`);
  }
  assert.equal(byId['lese:ravas-2'].species, null, 'not in any type walk served here = unknown');
  assert.equal(byId['lese:51862-2'].name, null, 'empty name on page stays null');
  assert.equal(byId['lese:haris-3'].species, 'dog', 'card seen only in a type walk is still kept');
  assert.equal(run.animals.filter(x => x.species === 'dog').length, 20);
});

test('lese: statuses come from page text, reserved kept with evidence', async () => {
  const { run } = await collect();
  const count = {};
  for (const a of run.animals) count[a.status] = (count[a.status] || 0) + 1;
  assert.deepEqual(count, { available: 33, reserved: 5, unknown: 5 });
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.equal(byId['lese:zoris'].status, 'reserved');
  assert.equal(byId['lese:zoris'].statusEvidence, 'Rezervuotas');
  assert.equal(byId['lese:51842-2'].status, 'unknown', '"Karantinuojamas" is not a known status');
  assert.equal(byId['lese:51842-2'].statusEvidence, null);
});

test('lese: pagination stops on the last page (current page, no next)', async () => {
  const { run, calls } = await collect();
  assert.equal(run.state, 'complete');
  assert.ok(!calls.some(c => /page\/3/.test(c.url)));
});

test('lese: page limit reached = not complete (partial, never published)', async () => {
  const { run } = await collect(routes, createLeseAdapter({ maxPages: 1, details: false }));
  assert.equal(run.state, 'partial');
});

test('lese: a failing page makes the whole run failed', async () => {
  const broken = { ...routes };
  delete broken[P2];
  assert.equal((await collect(broken)).run.state, 'failed');
  const brokenType = { ...routes };
  delete brokenType[SUO];
  assert.equal((await collect(brokenType)).run.state, 'failed');
});

test('lese: filter not applied or list missing = failed, never a silent wrong list', async () => {
  const unfiltered = fx('stat1-page-1.html').replace('<option value="1" selected>', '<option value="1">');
  assert.equal((await collect({ ...routes, [P1]: { body: unfiltered } })).run.state, 'failed');
  const noList = '<html><body><main><select id="stat"><option value="1" selected>Ieško namų</option></select></main></body></html>';
  assert.equal((await collect({ ...routes, [P1]: { body: noList } })).run.state, 'failed');
});

test('lese: detail page facts, gallery, branch', () => {
  const { parseDetail } = require('../adapters/lese.cjs');
  const d = parseDetail(fs.readFileSync(path.join(__dirname, '../fixtures/lese/detail-urve.html'), 'utf8'),
    'https://lese.lt/globotiniai/en-urve/');
  assert.deepEqual({ ...d, photos: d.photos.length }, {
    species: 'dog', sex: 'female', size: 'small', vaccinated: true, neutered: false, chipped: null,
    age_text: '2 mėn.', bio_lt: 'Bruožai: bailus, draugiškas, reikalauja daug dėmesio, žaismingas.',
    photos: 1, sourceUpdatedAt: '2026-11-16T00:00:00Z', shelterHint: 'vilnius',
  });
});
