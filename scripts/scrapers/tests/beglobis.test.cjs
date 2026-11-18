'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/beglobis.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const dir = path.join(__dirname, '../fixtures/beglobis');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const page1 = read('list-page1.html');
const page2 = read('list-page2.html');
const mylia = read('detail-3084.html');
const lota = read('detail-4101.html');
const O = 'http://www.beglobis.com';
const html = { 'content-type': 'text/html; charset=UTF-8' };

// SYNTHETIC minimal detail page for cards whose real detail page was not probed: only the real
// name and the real list status "Dovanojamas" (both from the list card), nothing else.
const minimalDetail = (name, status) => `<html><body><div id="middle"><h2 class="title">${name}</h2>
<div class="productParam"><span>Gyvūno statusas:</span> ${status}</div></div></body></html>`;

function routesFor({ details = {} } = {}) {
  const p1 = page1, p2 = page2;
  const routes = {
    [`${O}/robots.txt`]: { status: 404, body: 'Not Found', headers: html }, // real probe answer
    [`${O}/Dovanojami-684.html`]: { body: p1, headers: html },
    [`${O}/Dovanojami-684.html?productpage=1`]: { body: p2, headers: html },
  };
  for (const p of [p1, p2]) {
    for (const c of adapter._parseList(p, `${O}/Dovanojami-684.html`).cards) {
      routes[c.sourceUrl] = { body: minimalDetail(c.name, c.listStatus), headers: html };
    }
  }
  routes[`${O}/Mylia-684.html?productpage=1&productid=3084`] = { body: mylia, headers: html };
  routes[`${O}/Lota-684.html?productpage=0&productid=4101`] = { body: lota, headers: html };
  Object.assign(routes, details);
  return routes;
}

async function collect(routes = routesFor(), opts) {
  const calls = [];
  const a = opts ? adapter.createBeglobisAdapter(opts) : adapter;
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(routes, calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('beglobis: robots.txt first, then list pages, then one detail page per card; all GET', async () => {
  const { calls, run } = await collect();
  assert.equal(calls[0].url, `${O}/robots.txt`);
  assert.equal(calls[1].url, `${O}/Dovanojami-684.html`);
  assert.equal(calls[2].url, `${O}/Dovanojami-684.html?productpage=1`);
  assert.equal(calls.length, 3 + 27, 'robots + 2 list pages + 27 details');
  assert.equal(run.requests, 30);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'www.beglobis.com'));
});

test('beglobis: real detail page facts; contacts not read; unknown stays null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  const m = run.animals.find(a => a.id === 'beglobis:3084');
  assert.equal(m.name, 'Mylia');
  assert.equal(m.species, 'cat');
  assert.equal(m.sex, 'female');
  assert.equal(m.age_text, '7 metai');
  assert.equal(m.status, 'available');
  assert.equal(m.statusEvidence, 'Dovanojamas');
  assert.equal(m.photos.length, 6);
  assert.equal(m.photos[0], `${O}/page/upload/modproduct_5ccc8b6c24a26_b1.jpg`);
  assert.match(m.bio_lt, /^Šauni katytė Mylia/);
  for (const f of ['size', 'vaccinated', 'neutered', 'chipped', 'sourceUpdatedAt']) assert.equal(m[f], null, f);
  assert.doesNotMatch(JSON.stringify(m), /Vilnius|Skydo|@/);
});

test('beglobis: second real detail page (Lota): guardian Beglobis kept, health from bio text', async () => {
  const { run } = await collect();
  const l = run.animals.find(a => a.id === 'beglobis:4101');
  assert.equal(l.name, 'Lota');
  assert.equal(l.species, 'cat');
  assert.equal(l.sex, 'female');
  assert.equal(l.age_text, '7 metai');
  assert.equal(l.status, 'available');
  assert.match(l.bio_lt, /sterilizuota, skiepyta/);
  // The description states it plainly, so it counts (lib/labels.cjs fromProse): "sterilizuota, skiepyta,ženklinta mikroschema".
  assert.equal(l.neutered, true);
  assert.equal(l.vaccinated, true);
  assert.equal(l.chipped, true);
  assert.deepEqual(run.skipped, []);
});

test('beglobis: list-only cards keep real list name (with Lithuanian letters) and thumbnail; rest null', async () => {
  const { run } = await collect();
  assert.equal(run.animals.length, 27);
  assert.equal(run.animals.filter(a => a.status === 'available').length, 27);
  const r = run.animals.find(a => a.id === 'beglobis:4068');
  assert.equal(r.name, 'Ryžu');
  assert.equal(r.sourceUrl, `${O}/Ryzu-684.html?productpage=0&productid=4068`);
  assert.deepEqual(r.photos, [`${O}/page/upload/modproduct_6a4140a131170_s1.jpg`]);
  for (const f of ['species', 'sex', 'age_text', 'bio_lt']) assert.equal(r[f], null, f);
  assert.equal(run.animals.find(a => a.id === 'beglobis:3828').name, 'Činas');
  assert.equal(run.animals.find(a => a.id === 'beglobis:4046').name, 'Šeltis', 'page 2 card');
});

test('beglobis: status rules (contradiction = unknown; reserved keeps evidence)', () => {
  assert.deepEqual(adapter._pickStatus('Dovanojamas', 'Dovanojamas'), { status: 'available', statusEvidence: 'Dovanojamas' });
  assert.deepEqual(adapter._pickStatus('Dovanojamas', 'Rezervuotas'), { status: 'unknown', statusEvidence: null });
  assert.deepEqual(adapter._pickStatus(null, 'Rezervuotas'), { status: 'reserved', statusEvidence: 'Rezervuotas' });
  assert.deepEqual(adapter._pickStatus(null, null), { status: 'unknown', statusEvidence: null });
});

test('beglobis: animals of another guardian are skipped, not shown under Beglobis', async () => {
  // SYNTHETIC reshape: Mylia's guardian set to a real option of the list's "Globėjas" filter.
  const other = mylia.replace('Globėjas/prieglauda:</span> Beglobis', 'Globėjas/prieglauda:</span> Grinda, Vilniaus gyvūnų globos namai');
  const { run } = await collect(routesFor({ details: { [`${O}/Mylia-684.html?productpage=1&productid=3084`]: { body: other, headers: html } } }));
  assert.equal(run.state, 'complete');
  assert.ok(!run.animals.some(a => a.id === 'beglobis:3084'));
  assert.deepEqual(run.skipped, [{ nativeId: '3084', reason: 'Globėjas/prieglauda: Grinda, Vilniaus gyvūnų globos namai' }]);
});

test('beglobis: pagination follows "»" and stops on the page without it', async () => {
  assert.equal(adapter._parseList(page1, `${O}/Dovanojami-684.html`).next, `${O}/Dovanojami-684.html?productpage=1`);
  assert.equal(adapter._parseList(page2, `${O}/Dovanojami-684.html?productpage=1`).next, null);
  assert.equal(adapter._parseList(page1, `${O}/Dovanojami-684.html`).cards.length, 18);
  assert.equal(adapter._parseList(page2, `${O}/Dovanojami-684.html?productpage=1`).cards.length, 9);
});

test('beglobis: page limit reached -> partial, never published', async () => {
  const { run, calls } = await collect(routesFor(), { maxPages: 1 });
  assert.equal(run.state, 'partial');
  assert.ok(!calls.some(c => c.url.endsWith('productpage=1')));
});

test('beglobis: a failing list or detail page makes the run failed', async () => {
  const r1 = routesFor();
  r1[`${O}/Dovanojami-684.html?productpage=1`] = { status: 500, body: 'error' };
  assert.equal((await collect(r1)).run.state, 'failed');
  const r2 = routesFor();
  delete r2[`${O}/Lota-684.html?productpage=0&productid=4101`];
  assert.equal((await collect(r2)).run.state, 'failed');
});

test('beglobis: layout change fails instead of returning nothing', async () => {
  const routes = routesFor();
  routes[`${O}/Dovanojami-684.html`] = { body: '<html><body><div id="middle"></div></body></html>', headers: html };
  const { run } = await collect(routes);
  assert.equal(run.state, 'failed');
});
