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
  [`${P}sunys/`]: { body: fx('sunys-synthetic.html') },
  [`${P}kates/`]: { body: fx('kates-page-1-synthetic.html') },
  [`${P}kates/page/2/`]: { body: fx('kates-page-2-synthetic.html') },
  [`${P}kiti/`]: { body: fx('kiti-synthetic.html') },
};

async function collect(r = routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('gyvunugloba: robots.txt first, then parent and list pages, GET only', async () => {
  const { calls } = await collect();
  assert.deepEqual(calls.map(c => c.url), [
    'https://gyvunugloba.com/robots.txt', P, `${P}sunys/`, `${P}kates/`, `${P}kates/page/2/`, `${P}kiti/`,
  ]);
  assert.ok(calls.every(c => c.method === 'GET'));
});

test('gyvunugloba: parses list items, dedupes mobile copies, unknowns stay null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), [
    'gyvunugloba:agrastas', 'gyvunugloba:alyte', 'gyvunugloba:apvalaini', 'gyvunugloba:leopoldas-2',
    'gyvunugloba:loris-2', 'gyvunugloba:sakira', 'gyvunugloba:sodas', 'gyvunugloba:vezuvijus',
  ]);
  const a = byId['gyvunugloba:leopoldas-2'];
  assert.equal(a.name, 'Leopoldas');
  assert.equal(a.species, 'cat');
  assert.equal(a.sourceUrl, 'https://gyvunugloba.com/portfolio_page/leopoldas-2/');
  assert.deepEqual(a.photos, ['https://gyvunugloba.com/wp-content/uploads/2026/10/20261021_203100.jpg']);
  for (const f of ['sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} is not on the list page`);
  }
  assert.equal(byId['gyvunugloba:sakira'].name, 'Šakira');
  assert.equal(byId['gyvunugloba:sakira'].species, 'dog');
});

test('gyvunugloba: status comes from the real page heading, with evidence', async () => {
  const { run } = await collect();
  for (const a of run.animals) {
    assert.equal(a.status, 'available');
    assert.equal(a.statusEvidence, 'Ieško namų gyvūnai');
  }
  const noHeading = { ...routes, [P]: { body: fx('iesko-namu-gyvunai.html').replace(/<h1[\s\S]*?<\/h1>/, '') } };
  const r2 = (await collect(noHeading)).run;
  assert.ok(r2.animals.every(a => a.status === 'unknown' && a.statusEvidence === null));
});

test('gyvunugloba: pagination follows Show more and stops at the last page', async () => {
  const { run } = await collect();
  const cats = run.animals.filter(a => a.species === 'cat').map(a => a.name).sort();
  assert.deepEqual(cats, ['Alytė', 'Apvalaini', 'Leopoldas', 'Sodas', 'Vezuvijus']);
});

test('gyvunugloba: endless pagination is reported as incomplete', async () => {
  const page1 = fx('kates-page-1-synthetic.html').replace(/rel="2"/, 'rel=""');
  const endless = url => {
    if (url in routes && url !== `${P}kates/page/2/`) return url === `${P}kates/` ? { body: page1 } : routes[url];
    const m = url.match(/kates\/page\/(\d+)\/$/);
    if (m) return { body: page1.replace('kates/page/2/', `kates/page/${Number(m[1]) + 1}/`) };
    return null;
  };
  const { run } = await collect(endless);
  assert.equal(run.state, 'partial');
});

test('gyvunugloba: a failing page makes the whole run failed', async () => {
  const broken = { ...routes };
  delete broken[`${P}kates/page/2/`];
  assert.equal((await collect(broken)).run.state, 'failed');
  const changed = { ...routes, [`${P}kiti/`]: { body: '<html><body><p>nieko</p></body></html>' } };
  assert.equal((await collect(changed)).run.state, 'failed', 'missing list block = layout change, not empty');
});
