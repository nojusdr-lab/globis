'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../adapters/penktakoja.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');
const routes = require('../fixtures/penktakoja/routes.json');

const FIELDS = 'id,link,title,modified_gmt,featured_media,content,product_cat,class_list';
const productUrl = (perPage, page) =>
  `https://penktakoja.lt/wp-json/wp/v2/product?product_cat=15&per_page=${perPage}&page=${page}&_fields=${FIELDS}`;
const PRODUCTS = routes[productUrl(100, 1)];
const MEDIA = 'https://penktakoja.lt/wp-json/wp/v2/media?include=23959,23964,23969,23923,23929&per_page=100&_fields=id,source_url';

async function collect(r = routes, a = adapter) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('penktakoja: robots.txt is read first, all requests are GETs to penktakoja.lt', async () => {
  const { calls } = await collect();
  assert.equal(calls[0].url, 'https://penktakoja.lt/robots.txt');
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'penktakoja.lt'));
  assert.equal(calls.length, 4, 'robots + product + media + missing-photo detail fallback');
});

test('penktakoja: reads name, link, photo, date; unknown facts stay null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.animals.map(a => a.name), ['TREPSĖ', 'VOLFAS', 'ZRAZAS', 'ŠACHAS', 'ŠMAKIS']);
  const t = run.animals[0];
  assert.equal(t.id, 'penktakoja:23944');
  assert.equal(t.sourceUrl, 'https://penktakoja.lt/beglobis/trepse/');
  assert.equal(t.species, 'dog', 'category "Šunys"');
  assert.deepEqual(t.photos, ['https://penktakoja.lt/wp-content/uploads/2026/10/trepse-3_2-680x920.jpg']);
  assert.equal(t.sourceUpdatedAt, '2026-10-27T17:41:26Z');
  for (const a of run.animals) {
    for (const f of ['sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt']) {
      assert.equal(a[f], null, `${a.id} ${f}`);
    }
    assert.doesNotMatch(JSON.stringify(a), /685/, 'no phone number');
  }
  assert.deepEqual(run.animals.find(a => a.name === 'ŠMAKIS').photos, [], 'no media = no photo');
});

test('penktakoja: no status text on the site = unknown with no evidence', async () => {
  const { run } = await collect();
  for (const a of run.animals) {
    assert.equal(a.status, 'unknown');
    assert.equal(a.statusEvidence, null);
  }
  assert.deepEqual(run.skipped, []);
});

test('penktakoja: missing API media falls back to the animals own WooCommerce gallery', async () => {
  const last = PRODUCTS.at(-1);
  const r = { ...routes, [last.link]: { body: `<img src="https://penktakoja.lt/logo.png">
    <div class="woocommerce-product-gallery__image"><a href="/wp-content/uploads/fixture-dog.jpg"><img></a></div>` } };
  const { run } = await collect(r);
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.animals.at(-1).photos, ['https://penktakoja.lt/wp-content/uploads/fixture-dog.jpg']);
  assert.equal(run.animals.at(-1).name, 'ŠMAKIS');
});

test('penktakoja: a verified generic donation form is not an animal even inside the dog category', async () => {
  const donation = { ...PRODUCTS.at(-1), id: 20793, title: { rendered: 'Parama' }, featured_media: 0,
    content: { rendered: '' }, link: 'https://penktakoja.lt/beglobis/parama/' };
  // Cropped visible widget text from the 2026-11-19 public detail probe;
  // no donation form is submitted and no financial/contact values are needed.
  const page = '<div class="summary"><h1>Parama</h1><noscript>Please activate JavaScript to continue with your donation.</noscript><label>Pasirinkite paramos tipą</label></div>';
  const r = { ...routes, [productUrl(100, 1)]: [...PRODUCTS, donation], [donation.link]: { body: page } };
  const { run, calls } = await collect(r);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);
  assert.deepEqual(run.skipped, [{ nativeId: '20793', reason: 'generic donation form, not an individual animal' }]);
  assert.ok(calls.every(c => c.method === 'GET'));

  const real = await collect({ ...r, [donation.link]: { body: page + '<div class="woocommerce-product-gallery__image"><a href="/own-dog.jpg"></a></div>' } });
  assert.equal(real.run.animals.length, 6, 'a dog with its own photo is not dropped just because its name is Parama');
  assert.equal(real.run.skipped.length, 0);
  const unverified = await collect({ ...r, [donation.link]: { status: 503, body: 'unavailable' } });
  assert.equal(unverified.run.animals.length, 6, 'a failed detail request is not evidence of a donation product');
});

test('penktakoja: walks pages until a short page', async () => {
  const r = { ...routes };
  delete r[productUrl(100, 1)];
  r[productUrl(2, 1)] = PRODUCTS.slice(0, 2);
  r[productUrl(2, 2)] = PRODUCTS.slice(2, 4);
  r[productUrl(2, 3)] = PRODUCTS.slice(4);
  const { run, calls } = await collect(r, adapter.create({ perPage: 2 }));
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);
  assert.ok(!calls.some(c => c.url === productUrl(2, 4)), 'stops after the short page');
});

test('penktakoja: a full last page then HTTP 400 is the end', async () => {
  const r = { ...routes };
  delete r[productUrl(100, 1)];
  r[productUrl(5, 1)] = PRODUCTS;
  r[productUrl(5, 2)] = { status: 400, body: { code: 'rest_post_invalid_page_number' } };
  const { run } = await collect(r, adapter.create({ perPage: 5 }));
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);
});

test('penktakoja: invalid page-two parameters and shifted duplicate rows cannot silently shrink the dog list', async () => {
  const r = { ...routes, [productUrl(2, 1)]: PRODUCTS.slice(0, 2),
    [productUrl(2, 2)]: { status: 400, body: { code: 'rest_invalid_param' } },
    'https://penktakoja.lt/wp-json/wp/v2/media?include=23959,23964&per_page=100&_fields=id,source_url': routes[MEDIA].slice(0, 2) };
  const a = adapter.create({ perPage: 2 });
  assert.equal((await collect(r, a)).run.state, 'failed');
  const headers = { 'x-wp-total': '3', 'x-wp-totalpages': '2' };
  r[productUrl(2, 1)] = { body: PRODUCTS.slice(0, 2), headers };
  r[productUrl(2, 2)] = { body: [PRODUCTS[1]], headers };
  assert.equal((await collect(r, a)).run.state, 'partial');
});

test('penktakoja: page limit reached = partial, never complete', async () => {
  const r = { ...routes };
  r[productUrl(2, 1)] = PRODUCTS.slice(0, 2);
  r['https://penktakoja.lt/wp-json/wp/v2/media?include=23959,23964&per_page=100&_fields=id,source_url'] = routes[MEDIA].slice(0, 2);
  const { run } = await collect(r, adapter.create({ perPage: 2, maxPages: 1 }));
  assert.equal(run.animals.length, 2);
  assert.equal(run.state, 'partial');
});

test('penktakoja: a failing page makes the run failed', async () => {
  const noMedia = { ...routes };
  delete noMedia[MEDIA];
  assert.equal((await collect(noMedia)).run.state, 'failed');
  const serverError = { ...routes, [productUrl(100, 1)]: { status: 500, body: 'error' } };
  assert.equal((await collect(serverError)).run.state, 'failed');
});

test('penktakoja: a non-dog product (category changed) fails the run', async () => {
  const merch = PRODUCTS.map((p, i) => (i === 0 ? { ...p, class_list: { 0: 'product', 1: 'product_cat-rubai' } } : p));
  const { run } = await collect({ ...routes, [productUrl(100, 1)]: merch });
  assert.equal(run.state, 'failed');
});

test('penktakoja: donation, event and gift-card products in the dog category are skipped', async () => {
  // Real items seen 2026-11-20 in product_cat=15: 19175 (variable, event), 20793 (grouped "Parama"),
  // 20805 (simple+virtual "VIENKARTINĖ PARAMA"), 15856 (gift-card "Produktas").
  const extra = (id, title, ...cls) => ({
    ...PRODUCTS[0], id, title: { rendered: title }, featured_media: 0,
    class_list: Object.assign({}, ['product', 'product_cat-sunys', ...cls]),
  });
  const items = [
    ...PRODUCTS,
    extra(19175, 'Gyvūnų gerovės žygis su beglobiais šunimis &#8211; spalio 4d.', 'product-type-variable'),
    extra(20793, 'Parama', 'product-type-grouped'),
    extra(20805, 'VIENKARTINĖ PARAMA', 'virtual', 'product-type-simple'),
    extra(20808, 'LABAI REIKALINGA: KASMĖNESINĖ PARAMA', 'virtual', 'product-type-simple'),
    extra(15856, 'Produktas', 'virtual', 'product-type-gift-card'),
    extra(99001, 'IKAS', 'virtual', 'product-type-simple'), // many real dogs are virtual simple products
  ];
  const { run } = await collect({ ...routes, [productUrl(100, 1)]: items });
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.animals.map(a => a.name), ['TREPSĖ', 'VOLFAS', 'ZRAZAS', 'ŠACHAS', 'ŠMAKIS', 'IKAS']);
  assert.deepEqual(run.skipped.map(s => s.nativeId).sort(), ['15856', '19175', '20793', '20805', '20808']);
});
