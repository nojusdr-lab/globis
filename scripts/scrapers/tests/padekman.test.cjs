'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/padekman.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const dir = path.join(__dirname, '../fixtures/padekman');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const FEED = 'https://padekman.lt/portfolio-category/ishchut-dom/feed/';
const item = slug => `https://padekman.lt/portfolio-item/${slug}/`;

function baseRoutes() {
  return {
    'https://padekman.lt/robots.txt': { body: read('robots.txt'), headers: { 'content-type': 'text/plain' } },
    [FEED]: { body: read('feed-1.xml') },
    [`${FEED}?paged=2`]: { body: read('feed-2.xml') },
    [item('nr-121-moisej')]: { body: read('detail-nr-121-moisej.html') },
    [item('nr-99-bocman')]: { body: read('detail-nr-99-bocman.html') },
    [item('nr-94-viola')]: { body: read('detail-nr-94-viola.html') },
  };
}

async function collect(routes = baseRoutes()) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(routes, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('padekman: robots.txt first, feed pages in order, then one GET per animal page', async () => {
  const { calls } = await collect();
  assert.deepEqual(calls.map(c => c.url), [
    'https://padekman.lt/robots.txt', FEED, `${FEED}?paged=2`,
    item('nr-121-moisej'), item('nr-99-bocman'), item('nr-94-viola'),
  ]);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'padekman.lt'));
});

test('padekman: walks the feed to its short last page -> complete run', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.animals.map(a => a.id), ['padekman:7440', 'padekman:7311', 'padekman:7298']);
});

test('padekman: labelled facts from the animal page; contacts never copied', async () => {
  const { run } = await collect();
  const b = run.animals.find(a => a.id === 'padekman:7311');
  assert.equal(b.name, 'Nr.99 Bocman');
  assert.equal(b.sourceUrl, item('nr-99-bocman'));
  assert.equal(b.species, 'cat');
  assert.equal(b.sex, 'male');
  assert.equal(b.age_text, '3 metai');
  assert.equal(b.neutered, true);
  assert.equal(b.chipped, true);
  assert.equal(b.vaccinated, true);
  assert.equal(b.status, 'available');
  assert.equal(b.statusEvidence, 'Ieško namų');
  assert.deepEqual(b.photos, ['https://padekman.lt/wp-content/uploads/2022/07/Bocman-2-mini.jpg']);
  assert.match(b.bio_lt, /^Geras katinas\./);
  assert.doesNotMatch(b.bio_lt, /Daugiau informacij|Vardas|Lytis/);
  assert.equal(b.size, null, 'size is not written on the page');
  assert.equal(b.sourceUpdatedAt, null);
});

test('padekman: dashes in a fact mean unknown (null), not "no"', async () => {
  const lika = adapter._parseDetail(read('detail-lika.html'), item('lika'));
  assert.deepEqual(lika.labels, ['Ieško namų', 'Šunys']);
  assert.equal(lika.facts.sex, 'female');
  assert.equal(lika.facts.neutered, true);
  assert.equal(lika.facts.chipped, true);
  assert.equal(lika.facts.vaccinated, undefined, 'Lika page has no vaccination line');
  assert.equal(lika.facts.birth, 'Gimimo metai: 2020/09');
  assert.equal(lika.bio, 'Jaunas, labai draugiškas!');
  assert.deepEqual(lika.photos, ['https://padekman.lt/wp-content/uploads/2021/11/LIKA.jpg']);
  // Real line shapes from the feed (Nr.120): "Sterilizacija: ————-"
  const html = '<div class="mkdf-portfolio-single-holder"><div class="mkdf-ps-content-item"><div><strong>Sterilizacija</strong>: &#8212;&#8212;&#8212;&#8212;-</div><div><strong>Čipizacija: </strong> &#8212;&#8212;&#8212;&#8212;</div></div><div class="mkdf-ps-categories"><a class="mkdf-ps-info-category">Ieško namų</a></div></div>';
  const d = adapter._parseDetail(html, item('nr-120'));
  // A dash-only cell is blank (labels.cjs): no fact, so the field stays unknown.
  assert.equal(d.facts.neutered ?? null, null);
  assert.equal(d.facts.chipped ?? null, null);
});

test('padekman: contradicting status labels give unknown; adopted needs evidence', async () => {
  const { run } = await collect();
  const viola = run.animals.find(a => a.id === 'padekman:7298');
  assert.equal(viola.status, 'unknown', 'page has both "Ieško namų" and "Rado namus"');
  assert.equal(viola.statusEvidence, null);
  assert.equal(viola.sex, 'female');
  assert.deepEqual(adapter._fromLabels(['Rado namus', 'Šunys']), { status: 'confirmed_adopted', statusEvidence: 'Rado namus', species: 'dog' });
  assert.equal(adapter._fromLabels(['Ieško namų', 'Šunys', 'Katės']).species, null);
});

test('padekman: a 404 after a full page ends the feed (complete)', async () => {
  const r = baseRoutes();
  delete r[`${FEED}?paged=2`];
  r[`${FEED}?paged=2`] = { status: 404, body: 'not found' };
  const { run } = await collect(r);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 2);
});

test('padekman: a feed page that repeats items (paging ignored) fails the run', async () => {
  const r = baseRoutes();
  r[`${FEED}?paged=2`] = { body: read('feed-1.xml') };
  const { run } = await collect(r);
  assert.equal(run.state, 'failed');
});

test('padekman: a failing animal page or feed page makes the run failed', async () => {
  const r1 = baseRoutes();
  r1[item('nr-99-bocman')] = { status: 500, body: 'error' };
  assert.equal((await collect(r1)).run.state, 'failed');
  const r2 = baseRoutes();
  r2[`${FEED}?paged=2`] = { status: 500, body: 'error' };
  assert.equal((await collect(r2)).run.state, 'failed');
});
