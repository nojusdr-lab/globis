'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/sos-gyvunai.cjs');
const { createAdapter, _internal } = adapter;
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const dir = path.join(__dirname, '../fixtures/sos-gyvunai');
const data = require('../fixtures/sos-gyvunai/data.json');
const listingHtml = fs.readFileSync(path.join(dir, 'visi-gyvunai.html'), 'utf8');

const O = 'https://sos-gyvunai.lt';
const FIELDS = 'id,link,title,modified_gmt,featured_media,content,gyvunai';
const postsUrl = (perPage, page) => `${O}/wp-json/wp/v2/gyvunas?per_page=${perPage}&page=${page}&_fields=${FIELDS}`;
const mediaUrl = `${O}/wp-json/wp/v2/media?include=${data.posts.map(p => p.featured_media).join(',')}&per_page=100&_fields=id,source_url`;
// Media for any subset of ids, answered like WordPress does for ?include=.
const mediaFor = url => {
  const u = new URL(url);
  if (u.pathname !== '/wp-json/wp/v2/media') return null;
  const ids = u.searchParams.get('include').split(',').map(Number);
  return { body: data.media.filter(m => ids.includes(m.id)) };
};
const asFn = r => url => (url in r ? r[url] : (r.allowAnyMedia && mediaFor(url)) || undefined);

// perPage splits the real 5-post page into WordPress-style pages; past the end WP answers 400.
function routes(perPage = 100) {
  const r = {
    [`${O}/robots.txt`]: { body: data.robots, headers: { 'content-type': 'text/plain' } },
    [`${O}/visi-gyvunai/`]: { body: listingHtml, headers: { 'content-type': 'text/html' } },
    [`${O}/wp-json/wp/v2/gyvunai?per_page=100&page=1&_fields=id,name,slug,parent`]: { body: data.terms },
    [mediaUrl]: { body: data.media },
  };
  const pages = Math.ceil(data.posts.length / perPage);
  for (let p = 1; p <= pages; p++) r[postsUrl(perPage, p)] = { body: data.posts.slice((p - 1) * perPage, p * perPage) };
  r[postsUrl(perPage, pages + 1)] = { status: 400, body: { code: 'rest_post_invalid_page_number' } };
  Object.defineProperty(r, 'allowAnyMedia', { value: true, writable: true, enumerable: false });
  return r;
}

async function collect(r = routes(), a = adapter) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: a.hosts, ...fakeClock(), fetchImpl: fakeFetch(asFn(r), calls) });
  const run = await runSource(a, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('sos-gyvunai: robots.txt first, only GETs to sos-gyvunai.lt, no per-animal pages', async () => {
  const { run, calls } = await collect();
  assert.equal(calls[0].url, `${O}/robots.txt`);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'sos-gyvunai.lt'));
  assert.equal(calls.length, 5, 'robots, listing, terms, gyvunas page 1, media');
  assert.equal(run.requests, 5);
  assert.deepEqual(adapter.hosts, ['sos-gyvunai.lt', 'www.sos-gyvunai.lt']);
});

test('sos-gyvunai: parses REST fields, unknowns stay null, donation block not in bio', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.errors, []);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), ['sos-gyvunai:4427', 'sos-gyvunai:4432', 'sos-gyvunai:4433', 'sos-gyvunai:4436', 'sos-gyvunai:4468']);

  const im = byId['sos-gyvunai:4468'];
  assert.equal(im.name, 'Imbieras');
  assert.equal(im.sourceUrl, 'https://sos-gyvunai.lt/imbieras/');
  assert.equal(im.species, 'cat');
  assert.equal(im.age_text, 'Suaugusios (2 - 7 m.)');
  assert.deepEqual(im.photos, ['https://sos-gyvunai.lt/wp-content/uploads/667aa5a8-56e6-405e-b386-1272860f0b98.jpg']);
  assert.equal(im.sourceUpdatedAt, '2026-11-13T14:46:54Z');
  assert.match(im.bio_lt, /Jis atvyko jau kastruotas/);
  assert.doesNotMatch(im.bio_lt, /Mokėjimo paskirtis/);

  const iz = byId['sos-gyvunai:4436'];
  assert.equal(iz.species, 'dog');
  assert.equal(iz.age_text, 'Jauni (6 mėn. - 2 m.)');

  // No structured sex/size/health fields. Health words stated in the description count (fromProse).
  assert.equal(im.neutered, true); // "Jis atvyko jau kastruotas"
  // Sex only from a singular noun in the story: "ryžas katinas" (Imbieras).
  for (const a of run.animals) assert.equal(a.sex, a === im ? 'male' : null, `${a.id} sex`);
  // Size only where the text states "<word> ūgio/dydžio".
  for (const a of run.animals) assert.equal(a.size, /(mažo|nedidelio|vidutinio|didelio|stambaus)\s+(ūgio|dydžio)/i.test(a.bio_lt || '') ? a.size : null, `${a.id} size`);
});

test('sos-gyvunai: status comes from the real "Dovanojami gyvūnai" heading, with evidence', async () => {
  assert.equal(_internal.listingHeading(listingHtml), 'Dovanojami gyvūnai');
  const { run } = await collect();
  for (const a of run.animals) {
    assert.equal(a.status, 'available');
    assert.equal(a.statusEvidence, 'Dovanojami gyvūnai');
  }
  assert.deepEqual(run.skipped, []);
});

test('sos-gyvunai: without the heading or outside "Visi gyvūnai" the status is unknown', async () => {
  const r = routes();
  r[`${O}/visi-gyvunai/`] = { body: '<html><body><p>Visi gyvūnai</p></body></html>' };
  let { run } = await collect(r);
  assert.ok(run.animals.every(a => a.status === 'unknown' && a.statusEvidence === null));

  const r2 = routes();
  r2[`${O}/wp-json/wp/v2/gyvunai?per_page=100&page=1&_fields=id,name,slug,parent`] = { body: data.terms.filter(t => t.slug !== 'visi-gyvunai') };
  ({ run } = await collect(r2));
  assert.ok(run.animals.every(a => a.status === 'unknown'));
});

test('sos-gyvunai: explicit status words need standalone text and keep it as evidence', () => {
  const s = _internal.explicitStatus;
  assert.deepEqual(s('X – Rezervuota', ''), { status: 'reserved', statusEvidence: 'Rezervuota' });
  assert.deepEqual(s('X', '<p>Rado namus!</p>'), { status: 'confirmed_adopted', statusEvidence: 'Rado namus' });
  assert.equal(s('X', '<p>Rasta pakelėje</p><p>Ieško namų!</p>'), null, 'story lines never drop or set status');
  for (const p of data.posts) assert.equal(s(p.title.rendered, p.content.rendered), null, `real post ${p.id}`);
});

test('sos-gyvunai: pagination walks to a short page and stops', async () => {
  const a = createAdapter({ perPage: 2 });
  const { run, calls } = await collect(routes(2), a);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);
  const pageCalls = calls.filter(c => c.url.includes('/gyvunas?'));
  assert.deepEqual(pageCalls.map(c => new URL(c.url).searchParams.get('page')), ['1', '2', '3']);
});

test('sos-gyvunai: a full last page ends on the WordPress 400 answer', async () => {
  const a = createAdapter({ perPage: 5 });
  const { run, calls } = await collect(routes(5), a);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 5);
  assert.equal(calls.filter(c => c.url.includes('/gyvunas?')).length, 2);
});

test('sos-gyvunai: hitting the page limit is not complete', async () => {
  const a = createAdapter({ perPage: 2, maxPages: 2 });
  const { run } = await collect(routes(2), a);
  assert.equal(run.state, 'partial');
});

test('sos-gyvunai: a failing page makes the whole run failed', async () => {
  const noMedia = routes();
  delete noMedia[mediaUrl];
  noMedia.allowAnyMedia = false;
  assert.equal((await collect(noMedia)).run.state, 'failed');

  const page2Down = routes(2);
  page2Down[postsUrl(2, 2)] = { status: 500, body: 'error' };
  const { run } = await collect(page2Down, createAdapter({ perPage: 2 }));
  assert.equal(run.state, 'failed');
  assert.equal(run.animals.length, 0);

  const noListing = routes();
  delete noListing[`${O}/visi-gyvunai/`];
  assert.equal((await collect(noListing)).run.state, 'failed');
});

test('sos-gyvunai: species and age survive the 2026-11-18 term layout (Katės/Šunys under "Visi gyvūnai")', async () => {
  // Real live term list of 2026-11-18, ids unchanged; only parents and age names moved.
  const live = [
    { id: 51, name: 'Visi gyvūnai', slug: 'visi-gyvunai', parent: 0 },
    { id: 40, name: 'Katės', slug: 'kates', parent: 51 },
    { id: 42, name: 'Katės jaunos', slug: 'kates-jaunos', parent: 40 },
    { id: 43, name: 'Katės suaugusios', slug: 'kates-suaugusios', parent: 40 },
    { id: 45, name: 'Šunys', slug: 'sunys', parent: 51 },
    { id: 47, name: 'Šunys jauni', slug: 'sunys-jauni', parent: 45 },
  ];
  const r = routes();
  r[`${O}/wp-json/wp/v2/gyvunai?per_page=100&page=1&_fields=id,name,slug,parent`] = { body: live };
  const { run } = await collect(r);
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.equal(byId['sos-gyvunai:4436'].species, 'dog');
  assert.equal(byId['sos-gyvunai:4436'].age_text, 'Šunys jauni');
  assert.ok(run.animals.every(a => a.species), 'every fixture post carries Katės or Šunys');
});
