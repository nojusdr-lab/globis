'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/gyvunugloba.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const fx = name => fs.readFileSync(path.join(__dirname, '../fixtures/gyvunugloba', name), 'utf8');
const P = 'https://gyvunugloba.com/iesko-namu-gyvunai/';
const routes = {
  'https://gyvunugloba.com/robots.txt': { body: fx('robots.txt') },
  [P]: { body: fx('iesko-namu-gyvunai.html') },
  [`${P}sunys/`]: { body: fx('sunys.html') },
  [`${P}kates/`]: { body: fx('kates.html') },
  [`${P}kiti/`]: { body: fx('kiti.html') },
};
// The theme's real "Show more" block (from the home page), pointed at a page-2 URL. Test-only.
const paging = (href, rel) => `<div class="portfolio_paging"><span rel="${rel}" class="load_more"><a href="${href}" >Show more</a></span></div></body>`;

async function collect(r = routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('gyvunugloba: robots.txt first, then parent and one GET per list page', async () => {
  const { calls } = await collect();
  assert.deepEqual(calls.map(c => c.url), ['https://gyvunugloba.com/robots.txt', P, `${P}sunys/`, `${P}kates/`, `${P}kiti/`]);
  assert.ok(calls.every(c => c.method === 'GET'));
});

test('gyvunugloba: parses real list pages, unknowns stay null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 37);
  const count = s => run.animals.filter(a => a.species === s).length;
  assert.deepEqual([count('dog'), count('cat'), count('other')], [13, 22, 2]);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const a = byId['gyvunugloba:leopoldas-2'];
  assert.equal(a.name, 'Leopoldas');
  assert.equal(a.species, 'cat');
  assert.equal(a.sourceUrl, 'https://gyvunugloba.com/portfolio_page/leopoldas-2/');
  assert.equal(a.photos.length, 1);
  assert.match(a.photos[0], /^https:\/\/gyvunugloba\.com\/wp-content\/uploads\//);
  for (const f of ['sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} is not on the list page`);
  }
  assert.equal(byId['gyvunugloba:sakira'].name, 'Šakira');
  assert.equal(byId['gyvunugloba:sakira'].species, 'dog');
  const t = byId['gyvunugloba:triusiukai'];
  assert.equal(t.species, 'other');
  assert.deepEqual(t.photos, [], 'no image on the page = no photo');
});

test('gyvunugloba: status comes from the real page heading, with evidence', async () => {
  const { run } = await collect();
  assert.ok(run.animals.every(a => a.status === 'available' && a.statusEvidence === 'Ieško namų gyvūnai'));
  const noHeading = { ...routes, [P]: { body: fx('iesko-namu-gyvunai.html').replace(/<h1[\s\S]*?<\/h1>/, '') } };
  const r2 = (await collect(noHeading)).run;
  assert.ok(r2.animals.every(a => a.status === 'unknown' && a.statusEvidence === null));
});

test('gyvunugloba: follows Show more and stops at the last page', async () => {
  const r = { ...routes,
    [`${P}kates/`]: { body: fx('kates.html').replace('</body>', paging(`${P}kates/page/2/`, 2)) },
    [`${P}kates/page/2/`]: { body: fx('kates.html') } };
  const { run, calls } = await collect(r);
  assert.equal(run.state, 'complete');
  assert.ok(calls.some(c => c.url === `${P}kates/page/2/`));
  assert.equal(run.animals.length, 37, 'same animals on both pages are counted once');
});

test('gyvunugloba: endless pagination is reported as incomplete', async () => {
  const endless = url => {
    const m = url.match(/kates\/(?:page\/(\d+)\/)?$/);
    if (m) return { body: fx('kates.html').replace('</body>', paging(`${P}kates/page/${Number(m[1] || 1) + 1}/`, '')) };
    return routes[url];
  };
  const { run } = await collect(endless);
  assert.equal(run.state, 'partial');
});

test('gyvunugloba: a failing page makes the whole run failed', async () => {
  const broken = { ...routes };
  delete broken[`${P}kates/`];
  assert.equal((await collect(broken)).run.state, 'failed');
  const changed = { ...routes, [`${P}kiti/`]: { body: '<html><body><p>nieko</p></body></html>' } };
  assert.equal((await collect(changed)).run.state, 'failed', 'missing list block = layout change, not empty');
});
