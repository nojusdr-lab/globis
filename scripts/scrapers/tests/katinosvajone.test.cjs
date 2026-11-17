'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/katinosvajone.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const dir = path.join(__dirname, '../fixtures/katinosvajone');
const PAGE1 = fs.readFileSync(path.join(dir, 'page-1.html'), 'utf8');
const PAGE2 = fs.readFileSync(path.join(dir, 'page-2-synthetic.html'), 'utf8');
const LIST = 'https://www.katinosvajone.lt/musu-globotiniai';
const ROBOTS = { 'https://www.katinosvajone.lt/robots.txt': { body: 'User-agent: *\nCrawl-delay: 10\n', headers: { 'content-type': 'text/plain' } } };

// Real page 1 reshaped into a 2-page list: drop its last card row (it is on page 2) and
// pagination items 3..175.
const rows = PAGE1.match(/<div class="row clear-fix">.*?<\/div>/g);
const PAGE1_OF_2 = PAGE1
  .replace(rows[rows.length - 1], '')
  .replace(/<li class="pagination-item"><a href="[^"]*\?pg=(\d+)">\d+<\/a><\/li>/g, (m, n) => (Number(n) >= 3 ? '' : m));

const twoPages = { ...ROBOTS, [LIST]: { body: PAGE1_OF_2 }, [`${LIST}?pg=2`]: { body: PAGE2 } };

async function collect(routes) {
  const calls = [];
  const clock = fakeClock();
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...clock, fetchImpl: fakeFetch(routes, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls, clock };
}

test('katinosvajone: robots.txt first, GET only, own host, 10 s crawl-delay respected', async () => {
  const { calls, clock } = await collect(twoPages);
  assert.equal(calls[0].url, 'https://www.katinosvajone.lt/robots.txt');
  assert.deepEqual(calls.map(c => c.url).slice(1), [LIST, `${LIST}?pg=2`]);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'www.katinosvajone.lt'));
  assert.ok(clock.sleeps.every(ms => ms >= 10000));
});

test('katinosvajone: parses real list cards; unknown facts stay null', async () => {
  const { run } = await collect(twoPages);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 16 + 1); // 16 real cards + TESTAS2 (TESTAS is skipped)
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const t = byId['katinosvajone:tankas'];
  assert.equal(t.name, 'Tankas');
  assert.equal(t.sourceUrl, 'https://www.katinosvajone.lt/musu-globotinis/tankas');
  assert.deepEqual(t.photos, ['https://www.katinosvajone.lt/wp-content/uploads/2026/11/IMG_8291-scaled-142x142-c-center.jpeg']);
  assert.equal(byId['katinosvajone:katyte-340'].name, 'Karvutė', 'nativeId is the slug, name is the visible text');
  assert.equal(byId['katinosvajone:abis-ir-nubis'].name, 'Abis ir Nubis');
  for (const a of run.animals) {
    for (const f of ['species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
      assert.equal(a[f], null, `${a.id}.${f} must stay unknown`);
    }
  }
});

test('katinosvajone: status only from the page word, with evidence', async () => {
  const { run } = await collect(twoPages);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.equal(byId['katinosvajone:tankas'].status, 'available');
  assert.equal(byId['katinosvajone:tankas'].statusEvidence, 'Dovanojamas');
  assert.equal(byId['katinosvajone:sirena'].status, 'available');
  assert.equal(byId['katinosvajone:mona'].status, 'confirmed_adopted');
  assert.equal(byId['katinosvajone:mona'].statusEvidence, 'Padovanota');
  assert.equal(byId['katinosvajone:balu-3'].statusEvidence, 'Padovanotas');
  assert.equal(byId['katinosvajone:testas-be-statuso'].status, 'unknown');
  assert.equal(byId['katinosvajone:testas-be-statuso'].statusEvidence, null);
  assert.equal(byId['katinosvajone:testas-be-statuso'].photos.length, 0);
  assert.deepEqual(run.skipped, [{ nativeId: 'testas-grizo', reason: 'Grįžo namo' }]);
  const counts = run.animals.reduce((m, a) => ({ ...m, [a.status]: (m[a.status] || 0) + 1 }), {});
  assert.deepEqual(counts, { confirmed_adopted: 7, available: 9, unknown: 1 });
});

test('katinosvajone: real page 1 announces 175 pages; stopping early is never complete', async () => {
  // Page 2 (synthetic) claims to be last, but page 1 said 175 pages exist.
  const routes = { ...ROBOTS, [LIST]: { body: PAGE1 }, [`${LIST}?pg=2`]: { body: PAGE2 } };
  const { run } = await collect(routes);
  assert.equal(run.state, 'partial');
});

test('katinosvajone: missing "Pirmyn" item means the end is not proven', async () => {
  const noNext = PAGE2.replace('<li class="next"><span>Pirmyn</span></li>', '');
  const { run } = await collect({ ...twoPages, [`${LIST}?pg=2`]: { body: noNext } });
  assert.equal(run.state, 'partial');
});

test('katinosvajone: a failing page makes the run failed', async () => {
  const broken = { ...twoPages, [`${LIST}?pg=2`]: { status: 500, body: 'error' } };
  const { run } = await collect(broken);
  assert.equal(run.state, 'failed');
  assert.equal(run.animals.length, 0);
});

test('katinosvajone: a page with no animal cards (layout change) fails the run', async () => {
  const empty = PAGE2.replace(/<div class="row clear-fix">.*?<\/div>/g, '');
  const { run } = await collect({ ...twoPages, [`${LIST}?pg=2`]: { body: empty } });
  assert.equal(run.state, 'failed');
});
