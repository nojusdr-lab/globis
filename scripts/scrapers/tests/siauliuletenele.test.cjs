'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/siauliuletenele.cjs');
const { createSiauliuLetenele, statusFor } = require('../adapters/siauliuletenele.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const fx = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/siauliuletenele', name), 'utf8'));
const ROBOTS = 'User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nSitemap: https://siauliuletenele.lt/sitemap.xml\n';
const API = 'https://siauliuletenele.lt/wp-json/wp/v2/';
const FIELDS = '_fields=id,link,title,modified_gmt,categories,content';
const CATS = `${API}categories?per_page=100&page=1&_fields=id,slug,name`;
const postsUrl = (cat, perPage, page) => `${API}posts?categories=${cat}&per_page=${perPage}&page=${page}&${FIELDS}`;

const dogs = fx('posts-sunys.json'); // 6 posts, newest first
const cats = fx('posts-kates.json'); // 4 posts

// Production page size (100): one page per category.
const routes100 = {
  'https://siauliuletenele.lt/robots.txt': { body: ROBOTS, headers: { 'content-type': 'text/plain' } },
  [CATS]: { body: fx('categories.json') },
  [postsUrl(3, 100, 1)]: { body: dogs },
  [postsUrl(7, 100, 1)]: { body: cats },
};

// Page size 3: dogs = 3 + 3 + HTTP 400 (WordPress "past the last page"), cats = 3 + 1 (short page).
const routes3 = {
  'https://siauliuletenele.lt/robots.txt': routes100['https://siauliuletenele.lt/robots.txt'],
  [CATS]: routes100[CATS],
  [postsUrl(3, 3, 1)]: { body: dogs.slice(0, 3) },
  [postsUrl(3, 3, 2)]: { body: dogs.slice(3, 6) },
  [postsUrl(3, 3, 3)]: { status: 400, body: { code: 'rest_post_invalid_page_number' } },
  [postsUrl(7, 3, 1)]: { body: cats.slice(0, 3) },
  [postsUrl(7, 3, 2)]: { body: cats.slice(3) },
};

async function collect(r = routes100, a = adapter) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}
const byId = run => Object.fromEntries(run.animals.map(a => [a.id, a]));

test('siauliuletenele: robots.txt first, then categories and the two lists, all GET to the site', async () => {
  const { run, calls } = await collect();
  assert.equal(run.state, 'complete');
  assert.deepEqual(calls.map(c => c.url), ['https://siauliuletenele.lt/robots.txt', CATS, postsUrl(3, 100, 1), postsUrl(7, 100, 1)]);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'siauliuletenele.lt'));
  assert.ok(adapter.hosts.includes('www.siauliuletenele.lt'));
});

test('siauliuletenele: parses fields from REST posts and categories', async () => {
  const { run } = await collect();
  assert.equal(run.animals.length, 10);
  assert.deepEqual(run.skipped, []);
  const a = byId(run);
  const una = a['siauliuletenele:92798'];
  assert.equal(una.name, 'UNA');
  assert.equal(una.sourceUrl, 'https://siauliuletenele.lt/is-vienkiemio/');
  assert.equal(una.species, 'dog');
  assert.equal(una.age_text, 'ŠUNYS, GIMĘ 2024-2026 M.');
  assert.equal(una.sourceUpdatedAt, '2026-11-16T05:46:46Z');
  assert.deepEqual(una.photos, [
    'https://siauliuletenele.lt/wp-content/uploads/2026/11/Messenger_creation_2380880079395391.jpg',
    'https://siauliuletenele.lt/wp-content/uploads/2026/11/Messenger_creation_1865801614872247.jpg',
  ]);
  assert.match(una.bio_lt, /^Kiek kartais nedaug reikia/);
  assert.match(una.bio_lt, /Rasta ties Sidariais-Žostarčiais/);
  assert.doesNotMatch(una.bio_lt, /gallery|<|wp-content/);

  const dina = a['siauliuletenele:92739'];
  assert.equal(dina.photos.length, 2, 'Facebook emoji images and the video are not photos');
  assert.ok(dina.photos.every(p => p.startsWith('https://siauliuletenele.lt/wp-content/uploads/')));
  assert.doesNotMatch(dina.bio_lt, /\.mp4/);

  const kenzis = a['siauliuletenele:86345'];
  assert.equal(kenzis.species, 'cat');
  assert.equal(kenzis.age_text, 'KATĖS, GIMUSIOS IKI 2016 M.');
  assert.equal(a['siauliuletenele:88088'].age_text, 'KAČIUKAI IKI 6 MĖN.');
});

test('siauliuletenele: unknown facts stay null (no guessing)', async () => {
  const { run } = await collect();
  const a = byId(run);
  for (const animal of run.animals) {
    for (const f of ['size', 'vaccinated', 'neutered', 'chipped']) assert.equal(animal[f], null, `${animal.id} ${f}`);
  }
  // Sex only where the story names it for one animal: "maža ... kalytė" (UNA), "Kalytė buvo palikta" (GANGA).
  const female = run.animals.filter(x => x.sex).map(x => [x.id, x.sex]);
  // "Senjoras katinas" (KENZIS) is male.
  assert.deepEqual(female.sort(), [['siauliuletenele:86345', 'male'], ['siauliuletenele:92734', 'female'], ['siauliuletenele:92798', 'female']]);
  assert.equal(a['siauliuletenele:92739'].sex, null, '"DINA IR DUKRYTĖS": several animals');
  assert.equal(a['siauliuletenele:92790'].name, null, '"IŠ RADVILIŠKIO" is a place, not a name');
  assert.equal(a['siauliuletenele:88088'].name, null, '"IŠ VARPUTĖNŲ" is a place, not a name');
  assert.equal(a['siauliuletenele:92739'].age_text, null, 'mother + puppies: two age categories = unknown');
  assert.equal(a['siauliuletenele:89199'].age_text, null, 'two age categories = unknown');
  assert.equal(a['siauliuletenele:90611'].sourceUpdatedAt, null);
});

test('siauliuletenele: status only from page words, with evidence', async () => {
  const { run } = await collect();
  const a = byId(run);
  assert.equal(a['siauliuletenele:90611'].status, 'reserved');
  assert.equal(a['siauliuletenele:90611'].statusEvidence, 'Rezervuota');
  assert.equal(a['siauliuletenele:86345'].status, 'reserved');
  assert.equal(a['siauliuletenele:86345'].statusEvidence, 'Rezervuotas Aš Kenzis');
  assert.equal(a['siauliuletenele:88088'].status, 'unknown', '"(rado namus)" mid-sentence is about one kitten, not proof');
  assert.equal(a['siauliuletenele:89199'].status, 'unknown', 'NETEKTYS family post is kept, status unknown');
  assert.equal(a['siauliuletenele:92798'].status, 'unknown', '"Rasta ties ..." is not treated as excluded');
  const count = {};
  for (const x of run.animals) count[x.status] = (count[x.status] || 0) + 1;
  assert.deepEqual(count, { unknown: 8, reserved: 2 });

  assert.deepEqual(statusFor([{ slug: 'padovanoti-gyvunai', name: 'RADO NAMUS' }], null), { status: 'confirmed_adopted', statusEvidence: 'RADO NAMUS' });
  assert.deepEqual(statusFor([], 'Rasta ties Sidariais-Žostarčiais'), { status: 'unknown', statusEvidence: null });
});

test('siauliuletenele: pagination walks to the end (short page or HTTP 400)', async () => {
  const a3 = createSiauliuLetenele({ perPage: 3 });
  const { run, calls } = await collect(routes3, a3);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 10);
  assert.deepEqual(calls.map(c => c.url).slice(2), [postsUrl(3, 3, 1), postsUrl(3, 3, 2), postsUrl(3, 3, 3), postsUrl(7, 3, 1), postsUrl(7, 3, 2)]);
});

test('siauliuletenele: stopping at the page limit is not complete', async () => {
  const a = createSiauliuLetenele({ perPage: 3, maxPages: 1 });
  const { run } = await collect(routes3, a);
  assert.equal(run.state, 'partial');
});

test('siauliuletenele: a failing page makes the whole run failed', async () => {
  const broken = { ...routes3, [postsUrl(3, 3, 2)]: { status: 500, body: 'error' } };
  const { run } = await collect(broken, createSiauliuLetenele({ perPage: 3 }));
  assert.equal(run.state, 'failed');
  assert.equal(run.animals.length, 0);

  const noCats = { ...routes100 };
  delete noCats[CATS];
  assert.equal((await collect(noCats)).run.state, 'failed');
});
