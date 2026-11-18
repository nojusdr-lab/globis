'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/bukmanodraugas.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const dir = path.join(__dirname, '../fixtures/bukmanodraugas');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const ROBOTS = read('robots.txt');
const CATEGORIES = JSON.parse(read('categories.json'));
const POSTS = JSON.parse(read('posts.json'));
const MEDIA = JSON.parse(read('media.json'));

const API = 'https://bukmanodraugas.lt/wp-json/wp/v2/';
const CAT_URL = `${API}categories?slug=sunys-iesko-namu,kates-iesko-namu,rado-namus&per_page=100&_fields=id,name,slug`;
const FIELDS = 'id,link,title,modified_gmt,featured_media,content,categories';
const postsUrl = (perPage, page) => `${API}posts?categories=38,39&per_page=${perPage}&page=${page}&_fields=${FIELDS}`;
const MEDIA_URL = `${API}media?include=2543,2535,2527,2523,2517&per_page=100&_fields=id,source_url`;

function routes({ perPage = 100, posts = POSTS, categories = CATEGORIES } = {}) {
  const r = {
    'https://bukmanodraugas.lt/robots.txt': { body: ROBOTS },
    [CAT_URL]: { body: categories },
    [MEDIA_URL]: { body: MEDIA },
  };
  let page = 1;
  for (let i = 0; i < posts.length || page === 1; i += perPage, page++) r[postsUrl(perPage, page)] = { body: posts.slice(i, i + perPage) };
  return r;
}

async function collect(r, a = adapter) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('bukmanodraugas: robots.txt first, only GETs to the site, 4 requests in all', async () => {
  const { run, calls } = await collect(routes());
  assert.equal(run.state, 'complete');
  assert.equal(calls[0].url, 'https://bukmanodraugas.lt/robots.txt');
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'bukmanodraugas.lt'));
  assert.deepEqual(calls.map(c => c.url), ['https://bukmanodraugas.lt/robots.txt', CAT_URL, postsUrl(100, 1), MEDIA_URL]);
  assert.deepEqual(adapter.hosts, ['bukmanodraugas.lt', 'www.bukmanodraugas.lt']);
});

test('bukmanodraugas: real posts give name, species, photo, text; unknown facts stay null', async () => {
  const { run } = await collect(routes());
  assert.equal(run.animals.length, 5);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(),
    ['bukmanodraugas:2516', 'bukmanodraugas:2522', 'bukmanodraugas:2526', 'bukmanodraugas:2533', 'bukmanodraugas:2542']);
  const a = byId['bukmanodraugas:2542'];
  assert.equal(a.name, 'Martukas');
  assert.equal(a.sourceUrl, 'https://bukmanodraugas.lt/martukas/');
  assert.equal(a.species, 'dog');
  assert.deepEqual(a.photos, ['https://bukmanodraugas.lt/wp-content/uploads/2026/11/986089CA-1C1D-4BBE-8D9D-BB7C96634B39.png']);
  assert.match(a.bio_lt, /^Martulis su dar dviem/);
  assert.equal(a.sourceUpdatedAt, '2026-11-11T18:50:16Z');
  // Prose only: nothing is guessed from words like "šunelis"; only a stated "vidutinio ūgio" gives a size.
  for (const x of run.animals) {
    for (const f of ['sex', 'age_text', 'vaccinated', 'neutered', 'chipped']) assert.equal(x[f], null, `${x.id} ${f}`);
  }
  assert.equal(byId['bukmanodraugas:2516'].size, 'medium', '"vidutinio ūgio" stated in the text');
});

test('bukmanodraugas: status comes from the category text, with evidence', async () => {
  const { run } = await collect(routes());
  for (const a of run.animals) {
    assert.equal(a.status, 'available');
    assert.equal(a.statusEvidence, 'ieško namų');
  }
  // A post that is also in "Rado namus ❤️" keeps that real status. The category id is not
  // known from the probe, so this test uses a placeholder id (not an animal fact).
  const cats = [...CATEGORIES, { id: 900001, name: 'Rado namus ❤️', slug: 'rado-namus' }];
  const posts = POSTS.map(p => (p.id === 2533 ? { ...p, categories: [38, 900001] } : p));
  const { run: r2 } = await collect(routes({ categories: cats, posts }));
  const adopted = r2.animals.find(a => a.id === 'bukmanodraugas:2533');
  assert.equal(adopted.status, 'confirmed_adopted');
  assert.equal(adopted.statusEvidence, 'Rado namus ❤️');
  // Extra unrelated category (real: post 1693 also has "Įrašas", id 12) changes nothing.
  const p3 = POSTS.map(p => (p.id === 2522 ? { ...p, categories: [38, 12] } : p));
  const { run: r3 } = await collect(routes({ posts: p3 }));
  const m = r3.animals.find(a => a.id === 'bukmanodraugas:2522');
  assert.equal(m.species, 'dog');
  assert.equal(m.status, 'available');
  // In both dog and cat listings: species unknown, status still from the shared text.
  const p4 = POSTS.map(p => (p.id === 2526 ? { ...p, categories: [38, 39] } : p));
  const { run: r4 } = await collect(routes({ posts: p4 }));
  const z = r4.animals.find(a => a.id === 'bukmanodraugas:2526');
  assert.equal(z.species, null);
  assert.equal(z.status, 'available');
});

test('bukmanodraugas: walks pages until a short page, then stops', async () => {
  const small = adapter.create({ perPage: 2 });
  const { run, calls } = await collect(routes({ perPage: 2 }), small);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);
  assert.deepEqual(calls.filter(c => c.url.includes('/posts?')).map(c => new URL(c.url).searchParams.get('page')), ['1', '2', '3']);
});

test('bukmanodraugas: a full last page ends on WP 400 past the end; a page limit makes it partial', async () => {
  const exact = adapter.create({ perPage: 5 });
  const r = routes({ perPage: 5 });
  delete r[postsUrl(5, 2)];
  r[postsUrl(5, 2)] = { status: 400, body: { code: 'rest_post_invalid_page_number' } };
  const { run } = await collect(r, exact);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);

  const capped = adapter.create({ perPage: 2, maxPages: 2 });
  const rc = routes({ perPage: 2 });
  rc[`${API}media?include=2543,2535,2527,2523&per_page=100&_fields=id,source_url`] = { body: MEDIA.slice(0, 4) };
  const { run: partial } = await collect(rc, capped);
  assert.equal(partial.animals.length, 4);
  assert.equal(partial.state, 'partial');
});

test('bukmanodraugas: a failing page makes the whole run failed', async () => {
  for (const url of [CAT_URL, postsUrl(100, 1), MEDIA_URL]) {
    const r = routes();
    r[url] = { status: 500, body: 'error' };
    const { run } = await collect(r);
    assert.equal(run.state, 'failed', url);
  }
  const small = adapter.create({ perPage: 2 });
  const r = routes({ perPage: 2 });
  delete r[postsUrl(2, 2)]; // 404 on page 2
  const { run } = await collect(r, small);
  assert.equal(run.state, 'failed');
  // Listing category missing (site changed): fail, do not publish an empty list.
  const { run: r2 } = await collect(routes({ categories: CATEGORIES.slice(0, 1) }));
  assert.equal(r2.state, 'failed');
});
