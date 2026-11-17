'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/mgma.cjs');
const { createMgmaAdapter } = adapter;
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const dir = path.join(__dirname, '../fixtures/mgma');
const robots = fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8');
const products = require('../fixtures/mgma/products.json');
const media = require('../fixtures/mgma/media.json');
const cats = require('../fixtures/mgma/product_cat.json');

const API = 'https://mgma.lt/wp-json/wp/v2/';
const FIELDS = 'id,link,title,modified_gmt,featured_media,excerpt,product_cat';
const catUrl = (per, page) => `${API}product_cat?per_page=${per}&page=${page}&_fields=id,name,slug`;
const productUrl = (per, page) => `${API}product?product_cat=20,21,23,24&per_page=${per}&page=${page}&_fields=${FIELDS}`;
const mediaUrl = ids => `${API}media?include=${ids.join(',')}&per_page=100&_fields=id,source_url`;
const PAST_END = { status: 400, body: { code: 'rest_post_invalid_page_number' } };

function routes(per = 100, productPages = [products]) {
  const r = {
    'https://mgma.lt/robots.txt': { body: robots, headers: { 'content-type': 'text/plain' } },
  };
  for (let page = 1; (page - 1) * per <= cats.length; page++) r[catUrl(per, page)] = cats.slice((page - 1) * per, page * per);
  productPages.forEach((items, i) => { r[productUrl(per, i + 1)] = items; });
  const served = productPages.flat().map(p => p.featured_media);
  r[mediaUrl(served)] = media.filter(m => served.includes(m.id));
  return r;
}

async function collect(r, opts) {
  const calls = [];
  const a = opts ? createMgmaAdapter(opts) : adapter;
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('mgma: robots.txt is read first; only GETs to mgma.lt; adopted category list is not requested', async () => {
  const { run, calls } = await collect(routes());
  assert.equal(run.state, 'complete');
  assert.equal(calls[0].url, 'https://mgma.lt/robots.txt');
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'mgma.lt'));
  assert.ok(calls.every(c => !/product_cat=[\d,]*22/.test(c.url)), 'category 22 (given away) is never read');
  assert.equal(calls.length, 4, 'robots + categories + one product page + one media request');
});

test('mgma: parses title, excerpt and photo; unknown stays null; contacts removed', async () => {
  const { run } = await collect(routes());
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), ['mgma:27252', 'mgma:27263', 'mgma:27270', 'mgma:27291']);
  const soja = byId['mgma:27291'];
  assert.equal(soja.name, 'Soja');
  assert.equal(soja.species, 'cat');
  assert.equal(soja.sourceUrl, 'https://mgma.lt/gyvunas/soja-skiepyta-cipuota/');
  assert.equal(soja.age_text, 'gimusi apie 2026 metų rugsėjo pradžią');
  assert.equal(soja.vaccinated, true);
  assert.equal(soja.chipped, true);
  assert.equal(soja.neutered, null, 'not written anywhere');
  assert.equal(soja.sex, null);
  assert.equal(soja.size, null);
  assert.equal(soja.status, 'available');
  assert.equal(soja.statusEvidence, 'Kačiukai Dovanojami', 'list name is the evidence');
  assert.deepEqual(soja.photos, ['https://mgma.lt/wp-content/uploads/2026/11/906897828_1128581353360129_1143818050288977103_n.jpg']);
  assert.equal(soja.sourceUpdatedAt, '2026-11-14T10:46:28Z');
  assert.match(soja.bio_lt, /^SOJA – mažas baltas pūkuotas kamuoliukas/);
  assert.doesNotMatch(soja.bio_lt, /skambinti|tel\.|pašalint/);
  const pudra = byId['mgma:27252'];
  assert.equal(pudra.age_text, 'gimusi apie 2026 m. rugpjūčio pabaigą', '"m." abbreviation does not cut the phrase');
});

test('mgma: status only from page words, with evidence; facts from excerpt when title has none', async () => {
  const { run } = await collect(routes());
  const pukene = run.animals.find(a => a.id === 'mgma:27270');
  assert.equal(pukene.name, 'Pūkenė');
  assert.equal(pukene.status, 'confirmed_adopted');
  assert.equal(pukene.statusEvidence, 'padovanota 2026 11 11');
  assert.equal(pukene.species, null, 'its category (22) is not an animal-kind category we read');
  assert.equal(pukene.neutered, true, '"Sterilizuota." in excerpt');
  assert.equal(pukene.vaccinated, true);
  assert.equal(pukene.chipped, true, '"Paženklinta mikroschema."');
  assert.equal(pukene.age_text, 'Gimusi apie 2026 m. gegužės vidurį');
  assert.deepEqual(adapter.parseTitle('Rastas Marijampolėje').statusText, 'Rastas Marijampolėje');
});

test('mgma: pagination walks to a short page and stops', async () => {
  const pages = [products.slice(0, 2), products.slice(2, 3)];
  const { run, calls } = await collect(routes(2, pages), { perPage: 2 });
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 3);
  assert.ok(!calls.some(c => c.url === productUrl(2, 3)), 'no request after the short page');
});

test('mgma: pagination treats WordPress 400 after a full page as the end', async () => {
  const r = routes(2, [products.slice(0, 2), products.slice(2, 4)]);
  r[productUrl(2, 3)] = PAST_END;
  const { run } = await collect(r, { perPage: 2 });
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 4);
});

test('mgma: hitting maxPages is reported as not complete', async () => {
  const r = routes(2, [products.slice(0, 2), products.slice(2, 4)]);
  // Only the first 2 category pages are read, so the product filter has the categories seen so far.
  for (const [k, v] of Object.entries(r)) if (k.includes('product_cat=20,21,23,24')) r[k.replace('20,21,23,24', '20,21,23')] = v;
  const { run } = await collect(r, { perPage: 2, maxPages: 2 });
  assert.equal(run.state, 'partial');
});

test('mgma: a failing page makes the whole run failed', async () => {
  const broken = routes();
  delete broken[mediaUrl(products.map(p => p.featured_media))];
  assert.equal((await collect(broken)).run.state, 'failed');
  const r500 = routes();
  r500[productUrl(100, 1)] = { status: 500, body: 'error' };
  assert.equal((await collect(r500)).run.state, 'failed');
});

test('mgma: no animal category found = failed, not an empty success', async () => {
  const r = routes();
  r[catUrl(100, 1)] = cats.filter(c => c.id === 22);
  assert.equal((await collect(r)).run.state, 'failed');
});
