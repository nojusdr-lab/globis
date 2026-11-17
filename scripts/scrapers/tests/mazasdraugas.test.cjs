'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/mazasdraugas.cjs');
const { createMazasdraugasAdapter, parseTitle, parseContent } = adapter;
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const dir = path.join(__dirname, '../fixtures/mazasdraugas');
const robots = fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8');
const posts = require('../fixtures/mazasdraugas/posts.json');
const cats = require('../fixtures/mazasdraugas/categories.json');

const API = 'https://www.mazasdraugas.lt/wp-json/wp/v2/';
const CAT_URL = `${API}categories?slug=dovanojami-sunys,dovanojamos-kates&_fields=id,name,slug`;
const FIELDS = 'id,link,title,modified_gmt,categories,content';
const postUrl = (per, page) => `${API}posts?categories=34,35&per_page=${per}&page=${page}&_fields=${FIELDS}`;
const PAST_END = { status: 400, body: { code: 'rest_post_invalid_page_number' } };

function routes(per = 100, pages = [posts]) {
  const r = {
    'https://www.mazasdraugas.lt/robots.txt': { body: robots, headers: { 'content-type': 'text/plain' } },
    [CAT_URL]: cats,
  };
  pages.forEach((items, i) => { r[postUrl(per, i + 1)] = items; });
  return r;
}

async function collect(r, opts) {
  const calls = [];
  const a = opts ? createMazasdraugasAdapter(opts) : adapter;
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('mazasdraugas: robots.txt read first; only GETs to the site; 3 requests in all', async () => {
  const { run, calls } = await collect(routes());
  assert.equal(run.state, 'complete');
  assert.equal(calls[0].url, 'https://www.mazasdraugas.lt/robots.txt');
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'www.mazasdraugas.lt'));
  assert.equal(calls.length, 3, 'robots + categories + one posts page; no detail or media requests');
});

test('mazasdraugas: parses name, birth, procedures, species, photos, bio; contacts removed', async () => {
  const { run } = await collect(routes());
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), ['mazasdraugas:13800', 'mazasdraugas:13816', 'mazasdraugas:13828', 'mazasdraugas:13841', 'mazasdraugas:13856']);
  const s = byId['mazasdraugas:13856'];
  assert.equal(s.name, 'Šaris');
  assert.equal(s.sourceUrl, 'https://www.mazasdraugas.lt/saris/');
  assert.equal(s.species, 'dog');
  assert.equal(s.age_text, 'Gimė: 2018-06');
  assert.equal(s.neutered, true);
  assert.equal(s.vaccinated, true);
  assert.equal(s.chipped, true);
  assert.deepEqual(s.photos, [
    'https://www.mazasdraugas.lt/wp-content/uploads/2026/11/Saris1-684x1024.jpg',
    'https://www.mazasdraugas.lt/wp-content/uploads/2026/11/Saris-1024x684.jpg',
  ]);
  assert.match(s.bio_lt, /^❤️ Šaris – mielas šunelis/);
  assert.match(s.bio_lt, /Ūgis: 37cm\.$/);
  assert.doesNotMatch(s.bio_lt, /Born|About|KONTAKTAI|kontaktai/, 'English copy and contact block not in bio');
  assert.equal(s.sourceUpdatedAt, '2026-11-02T17:02:03Z');
  assert.equal(byId['mazasdraugas:13841'].species, 'cat');
  assert.equal(byId['mazasdraugas:13841'].neutered, true, '"Sterilizuota"');
});

test('mazasdraugas: unknown stays null (sex, size, unlisted procedure)', async () => {
  const { run } = await collect(routes());
  for (const a of run.animals) { assert.equal(a.sex, null); assert.equal(a.size, null); }
  const p = run.animals.find(a => a.id === 'mazasdraugas:13828');
  assert.equal(p.name, 'Pripsas');
  assert.equal(p.neutered, null, '"Skiepytas, čipuotas." says nothing about neutering');
  assert.equal(p.vaccinated, true);
  assert.equal(p.chipped, true);
});

test('mazasdraugas: post in both categories: species unknown, status unknown', async () => {
  const both = posts.map(p => (p.id === 13816 ? { ...p, categories: [34, 35] } : p));
  const { run } = await collect(routes(100, [both]));
  const n = run.animals.find(a => a.id === 'mazasdraugas:13816');
  assert.equal(n.species, null);
  assert.equal(n.status, 'unknown');
  assert.equal(n.statusEvidence, null);
});

test('mazasdraugas: status comes from the category name, with evidence', async () => {
  const { run } = await collect(routes());
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.equal(byId['mazasdraugas:13856'].status, 'available');
  assert.equal(byId['mazasdraugas:13856'].statusEvidence, 'Dovanojami šunys');
  assert.equal(byId['mazasdraugas:13841'].status, 'available');
  assert.equal(byId['mazasdraugas:13841'].statusEvidence, 'Dovanojamos katės');
});

test('mazasdraugas: a status word after the name in a title is split off as evidence', () => {
  // Parser check on a label only (no animal record): the probe had no reserved animal.
  assert.deepEqual(parseTitle('Vardas (rezervuota)'), { name: 'Vardas', statusText: 'rezervuota' });
  assert.deepEqual(parseTitle('Šaris'), { name: 'Šaris', statusText: null });
});

test('mazasdraugas: pagination walks to a short page and stops', async () => {
  const { run, calls } = await collect(routes(2, [posts.slice(0, 2), posts.slice(2, 4), posts.slice(4)]), { perPage: 2 });
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);
  assert.equal(calls.filter(c => c.url.includes('/posts?')).length, 3);
});

test('mazasdraugas: exact multiple of page size ends on WordPress 400', async () => {
  const r = routes(5, [posts]);
  r[postUrl(5, 2)] = PAST_END;
  const { run } = await collect(r, { perPage: 5 });
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);
});

test('mazasdraugas: page limit reached means not complete', async () => {
  const { run } = await collect(routes(2, [posts.slice(0, 2), posts.slice(2, 4)]), { perPage: 2, maxPages: 2 });
  assert.equal(run.state, 'partial');
});

test('mazasdraugas: missing listing category means not complete', async () => {
  const r = routes();
  r[CAT_URL] = cats.filter(c => c.id === 34);
  r[`${API}posts?categories=34&per_page=100&page=1&_fields=${FIELDS}`] = posts.filter(p => p.categories.includes(34));
  const { run } = await collect(r);
  assert.equal(run.state, 'partial');
});

test('mazasdraugas: a failing page makes the run failed', async () => {
  const r = routes(2, [posts.slice(0, 2)]);
  r[postUrl(2, 2)] = { status: 500, body: 'error' };
  const { run } = await collect(r, { perPage: 2 });
  assert.equal(run.state, 'failed');
  const r2 = routes();
  r2[CAT_URL] = { status: 503, body: 'down' };
  assert.equal((await collect(r2)).run.state, 'failed');
});

test('mazasdraugas: header variants seen on list page 2 (real excerpt text, reshaped into <p> lines)', () => {
  const saiksas = parseContent('<p>♥ Gimė: 2012-08-08,</p><p>♥Kastruotas, skiepytas, čipuotas.</p><p><strong>Apie Saiksą:</strong></p><p>Saiksas yra labai ramus, draugiškas ir</p>');
  assert.equal(saiksas.age_text, 'Gimė: 2012-08-08');
  assert.deepEqual(saiksas.facts, { neutered: true, vaccinated: true, chipped: true });
  const fiona = parseContent('<p>♥ Apie 2 metus</p><p>♥ Sterilizuota, skiepyta, čipuota</p><p>♠ Panevėžys</p><p>Jauna, švelni ir kukli katytė,</p>');
  assert.equal(fiona.age_text, 'Apie 2 metus');
  assert.deepEqual(fiona.facts, { neutered: true, vaccinated: true, chipped: true });
  assert.equal(fiona.bio, 'Jauna, švelni ir kukli katytė,');
});
