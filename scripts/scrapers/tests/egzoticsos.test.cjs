'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/egzoticsos.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');
// Taxonomies are cropped from the public 2026-11-19 API probe. Animal bodies
// below are synthetic variants of the observed schema, without real contacts.
const fixture = file => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/egzoticsos', file), 'utf8'));
const product = (id, extra = {}) => ({ id, link: `https://egzoticsos.lt/gyvūnėlis/sinsila-${id}/`,
  title: { rendered: 'Šinšila' }, content: { rendered: '<p>Patelė, amžius nežinomas</p>' },
  product_cat: [20], product_tag: [49, 66], class_list: ['product', 'product_cat-iesko-namu'],
  featured_media: id + 1000, modified_gmt: '2026-11-14T22:33:58', ...extra });

async function collect({ pages = [[product(1), product(2, { product_tag: [100], content: { rendered: '' } })]],
  cats = fixture('categories.json'), failPage, maxPages = 5, cache = createParseCache(null) } = {}) {
  const a = adapter.create({ perPage: 2, maxPages });
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(url => {
    const u = new URL(url), p = u.pathname, page = Number(u.searchParams.get('page') || 1);
    if (p === '/robots.txt') return { body: 'User-agent: *\nDisallow: /wp-admin/\n' };
    if (p.endsWith('/product_cat')) return { body: cats, headers: { 'x-wp-totalpages': '1' } };
    if (p.endsWith('/product_tag')) return { body: fixture('tags.json'), headers: { 'x-wp-totalpages': '1' } };
    if (p.endsWith('/product')) {
      assert.equal(u.searchParams.get('product_cat'), '20', 'only the public Ieško namų category');
      assert.equal(u.searchParams.get('orderby'), 'id');
      if (failPage === page) return { status: 503, body: 'temporarily unavailable' };
      return { body: pages[page - 1] || [], headers: { 'x-wp-totalpages': String(pages.length) } };
    }
    if (p.endsWith('/media')) return { body: u.searchParams.get('include').split(',').map(id =>
      ({ id: Number(id), source_url: `https://egzoticsos.lt/wp-content/uploads/${id}.jpg` })) };
    return null;
  }, calls) });
  return { run: await runSource(a, { fetcher, cache }), calls };
}

test('EgzoticSOS: complete filtered REST collection, own media, source facts and unknowns', async () => {
  const { run, calls } = await collect();
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 2);
  assert.equal(run.animals[0].species, 'other', 'explicit Šinšilos tag');
  assert.equal(run.animals[0].sex, 'female', 'explicit Patelė in this animal description');
  assert.equal(run.animals[0].age_text, null, 'unknown age stays unknown');
  assert.equal(run.animals[0].status, 'available');
  assert.equal(run.animals[0].statusEvidence, 'Ieško namų');
  assert.deepEqual(run.animals[0].photos, ['https://egzoticsos.lt/wp-content/uploads/1001.jpg']);
  assert.equal(run.animals[1].species, null, 'unexplained abbreviated tag does not imply an animal kind');
  assert.equal(run.animals[1].sex, null, 'no inference from a generic animal title');
  for (const a of run.animals) for (const field of ['chipped', 'vaccinated', 'neutered', 'size']) assert.equal(a[field], null);
  assert.ok(calls[0].url.endsWith('/robots.txt'));
  assert.ok(calls.every(c => c.method === 'GET'));
  assert.equal(calls.filter(c => new URL(c.url).pathname.endsWith('/product')).length, 1,
    'a full final page with a declared page count does not request an invalid extra page');
});

test('EgzoticSOS: reaches the last page; cap and a failed later page cannot publish partial data', async () => {
  const pages = [[product(1), product(2)], [product(3)]];
  assert.equal((await collect({ pages })).run.animals.length, 3);
  assert.equal((await collect({ pages, maxPages: 1 })).run.state, 'partial');
  assert.equal((await collect({ pages, failPage: 2 })).run.state, 'failed');
});

test('EgzoticSOS: changed taxonomy or an out-of-scope product fails closed', async () => {
  const renamed = fixture('categories.json').map(c => c.id === 20 ? { ...c, name: 'Parduotuvė' } : c);
  assert.equal((await collect({ cats: renamed })).run.state, 'failed');
  assert.equal((await collect({ pages: [[product(1, { product_cat: [21], class_list: ['product_cat-gydomi-karantinuojami'] })]] })).run.state, 'failed');
});

test('EgzoticSOS: category conflicts never turn found, adopted or quarantined animals into available ones', async () => {
  const { run } = await collect({ pages: [[product(1, { product_cat: [20, 22] }),
    product(2, { product_cat: [20, 21] })], [product(3, { product_cat: [20, 33] })]] });
  assert.equal(run.state, 'complete');
  assert.equal(run.animals[0].status, 'confirmed_adopted');
  assert.equal(run.animals[0].statusEvidence, 'Rado namus');
  assert.equal(run.animals[1].status, 'unknown');
  assert.equal(run.animals[1].statusEvidence, null);
  assert.equal(run.skipped.length, 1);
  assert.equal(run.skipped[0].reason, 'Rasti');
});

test('EgzoticSOS: a shifted/repeated product across pages makes collection partial', async () => {
  const { run } = await collect({ pages: [[product(1), product(2)], [product(2)]] });
  assert.equal(run.state, 'partial');
});

test('EgzoticSOS: a published row joins the verified organization instead of disappearing as unmapped', async () => {
  const { run } = await collect();
  const { build } = require('../to-app-data.cjs');
  const catalog = require('../../../src/data/shelters.json');
  const { pets, report } = build([{ source: run.source, animals: run.animals }], catalog, []);
  assert.equal(pets.length, 2);
  assert.equal(report[0].state, 'ok');
  assert.equal(pets[0].shelter.id, 'egzoticsoslt');
  assert.equal(pets[0].shelter.url, 'https://egzoticsos.lt/');
});
