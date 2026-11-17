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
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const F1 = read('list-filtered-1.html');
const F2 = read('list-filtered-2-synthetic.html');
const L175 = read('list-175.html');
const TANKAS = read('detail-tankas.html');
const EMPTY = read('detail-empty-synthetic.html');

const HOST = 'https://www.katinosvajone.lt';
const P1 = `${HOST}/musu-globotiniai?pet_status=for_adoption`;
const P2 = `${HOST}/musu-globotiniai?pet_status=for_adoption&pg=2`;
const ROBOTS = `${HOST}/robots.txt`;

// Real filtered page 1 reshaped into "page 1 of 2": its last row moves to page 2, item 3 dropped.
const rows = F1.match(/<div class="row clear-fix">.*?<\/div>/g);
const F1_OF_2 = F1.replace(rows[rows.length - 1], '').replace(/<li class="pagination-item"><a href="[^"]*pg=3">3<\/a><\/li>/, '');

function routes({ p1 = F1_OF_2, p2 = F2, detail = {} } = {}) {
  return url => {
    if (url === ROBOTS) return { body: 'User-agent: *\nCrawl-delay: 10\n', headers: { 'content-type': 'text/plain' } };
    if (url === P1) return { body: p1 };
    if (url === P2) return p2 instanceof Object ? p2 : { body: p2 };
    if (url in detail) return detail[url];
    if (url === `${HOST}/musu-globotinis/tankas`) return { body: TANKAS };
    if (url.startsWith(`${HOST}/musu-globotinis/`)) return { body: EMPTY };
    return null;
  };
}

async function collect(r = routes()) {
  const calls = [];
  const clock = fakeClock();
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...clock, fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls, clock };
}

test('katinosvajone: robots first, filtered list only, one detail per listed animal, crawl-delay', async () => {
  const { run, calls, clock } = await collect();
  assert.equal(run.state, 'complete');
  const urls = calls.map(c => c.url);
  assert.equal(urls[0], ROBOTS);
  assert.deepEqual(urls.slice(1, 3), [P1, P2]);
  assert.equal(urls.length, 1 + 2 + 16);
  assert.ok(urls.slice(3).every(u => u.startsWith(`${HOST}/musu-globotinis/`)));
  assert.ok(!urls.some(u => /musu-globotiniai\?pg=/.test(u)), 'never walks the unfiltered archive');
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'www.katinosvajone.lt'));
  assert.ok(clock.sleeps.every(ms => ms >= 10000));
});

test('katinosvajone: detail facts filled from the labelled list; unknown stays null', async () => {
  const { run } = await collect();
  assert.equal(run.animals.length, 16);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const t = byId['katinosvajone:tankas'];
  assert.equal(t.name, 'Tankas');
  assert.equal(t.sourceUrl, `${HOST}/musu-globotinis/tankas`);
  assert.equal(t.sex, 'male');
  assert.equal(t.age_text, '6-12 Mėnesiai');
  assert.equal(t.neutered, false);
  assert.deepEqual(t.photos, [`${HOST}/wp-content/uploads/2026/11/IMG_8291-scaled-703x800-c-center.jpeg`]);
  for (const f of ['species', 'size', 'vaccinated', 'chipped', 'bio_lt', 'sourceUpdatedAt']) assert.equal(t[f], null, f);
  const k = byId['katinosvajone:katyte-340'];
  assert.equal(k.name, 'Karvutė');
  for (const f of ['species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt']) assert.equal(k[f], null, f);
  assert.deepEqual(k.photos, [`${HOST}/wp-content/uploads/2026/11/IMG_8332-scaled-142x142-c-center.jpeg`], 'list thumbnail when gallery is empty');
});

test('katinosvajone: status from page words with evidence; detail status wins over list', async () => {
  const { run } = await collect();
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.equal(byId['katinosvajone:tankas'].status, 'available');
  assert.equal(byId['katinosvajone:tankas'].statusEvidence, 'Dovanojamas');
  assert.equal(byId['katinosvajone:sirena'].statusEvidence, 'Dovanojama');
  assert.ok(run.animals.every(a => a.status === 'available'));

  // Tankas's own page says it is adopted now (real status word from the site), list still says available.
  const adopted = TANKAS.replace('<dd>Dovanojamas</dd>', '<dd>Padovanotas</dd>');
  const r2 = await collect(routes({ detail: { [`${HOST}/musu-globotinis/tankas`]: { body: adopted } } }));
  const t = r2.run.animals.find(a => a.id === 'katinosvajone:tankas');
  assert.equal(t.status, 'confirmed_adopted');
  assert.equal(t.statusEvidence, 'Padovanotas');

  const returned = TANKAS.replace('<dd>Dovanojamas</dd>', '<dd>Grįžo namo</dd>');
  const r3 = await collect(routes({ detail: { [`${HOST}/musu-globotinis/tankas`]: { body: returned } } }));
  assert.deepEqual(r3.run.skipped, [{ nativeId: 'tankas', reason: 'Grįžo namo' }]);
});

test('katinosvajone: contacts list on the detail page is never read', () => {
  const withContacts = TANKAS.replace('</dl>', '</dl><br><h3>Kontaktai</h3><dl class="pet-details-list"><dt>Tel.</dt><dd>[pašalinta]</dd><dt>Lytis</dt><dd>Patelė</dd></dl>');
  const d = adapter.parseDetailPage(withContacts, `${HOST}/musu-globotinis/tankas`);
  assert.equal(d.facts.sex, 'male');
  assert.ok(!JSON.stringify(d).includes('pašalinta'));
});

test('katinosvajone: real last page markup proves the end', () => {
  const p = adapter.parseListPage(L175, `${HOST}/musu-globotiniai?pg=175`);
  assert.deepEqual(p.pagination, { current: 175, last: 175, hasNextItem: true, next: null });
  assert.equal(p.cards.length, 9);
  assert.equal(p.filterSelected, false);
  const real1 = adapter.parseListPage(F1, P1);
  assert.equal(real1.filterSelected, true);
  assert.deepEqual(real1.pagination, { current: 1, last: 3, hasNextItem: true, next: P2 });
});

test('katinosvajone: stopping before the announced last page is never complete', async () => {
  const { run } = await collect(routes({ p1: F1 })); // page 1 announces 3, page 2 claims to be last
  assert.equal(run.state, 'partial');
  const noNext = F2.replace('<li class="next"><span>Pirmyn</span></li>', '');
  assert.equal((await collect(routes({ p2: noNext }))).run.state, 'partial');
});

test('katinosvajone: unfiltered page served for the filter URL fails the run', async () => {
  const { run } = await collect(routes({ p1: F1_OF_2.replace(' selected', '') }));
  assert.equal(run.state, 'failed');
});

test('katinosvajone: a failing list or detail page makes the run failed', async () => {
  assert.equal((await collect(routes({ p2: { status: 500, body: 'error' } }))).run.state, 'failed');
  const r = await collect(routes({ detail: { [`${HOST}/musu-globotinis/moka`]: { status: 503, body: 'x' } } }));
  assert.equal(r.run.state, 'failed');
  assert.equal(r.run.animals.length, 0);
  const noDl = await collect(routes({ detail: { [`${HOST}/musu-globotinis/moka`]: { body: '<html><body>kita</body></html>' } } }));
  assert.equal(noDl.run.state, 'failed');
});
