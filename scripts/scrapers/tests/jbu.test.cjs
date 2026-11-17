'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/jbu.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const list = fs.readFileSync(path.join(__dirname, '../fixtures/jbu/list.html'), 'utf8');
const detail = fs.readFileSync(path.join(__dirname, '../fixtures/jbu/detail-beglobis-gyvunas-11.html'), 'utf8');
const ROBOTS = 'https://jbu.lt/robots.txt';
const LIST = 'https://jbu.lt/beglobiai-gyvunai/';
const PAGE2 = 'https://jbu.lt/beglobiai-gyvunai/page/2/';
const DETAIL = 'https://jbu.lt/portfolio/beglobis-gyvunas-11/';

const html = body => ({ body, headers: { 'content-type': 'text/html; charset=UTF-8' } });
const routesFor = (body, extra = {}, detailBody = detail) => ({
  // Real probe answer (2026-11-16): robots.txt is just "User-agent: *".
  [ROBOTS]: { body: 'User-agent: *\n', headers: { 'content-type': 'text/plain' } },
  [LIST]: html(body),
  [DETAIL]: html(detailBody),
  ...extra,
});

async function collect(routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(routes, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('jbu: robots.txt first, then the list page, then one detail page per animal', async () => {
  const { calls } = await collect(routesFor(list));
  assert.deepEqual(calls.map(c => c.url), [ROBOTS, LIST, DETAIL]);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'jbu.lt'));
});

test('jbu: parses list card + detail facts; unknown facts stay null', async () => {
  const { run } = await collect(routesFor(list));
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.animals.map(a => a.id), ['jbu:beglobis-gyvunas-11']);
  const a = run.animals[0];
  assert.equal(a.sourceUrl, 'https://jbu.lt/portfolio/beglobis-gyvunas-11/');
  assert.deepEqual(a.photos, ['https://jbu.lt/wp-content/uploads/2026/10/20261014_104408-scaled.jpg']);
  assert.equal(a.name, null, '"Beglobis gyvūnas" is a generic label, not a name');
  assert.equal(a.species, 'dog');
  assert.equal(a.sex, 'female');
  assert.equal(a.age_text, 'apie 3-4 m.');
  assert.equal(a.status, 'unknown', '"Gyvūno statusas: Beglobis" (stray) is not an adoption status');
  assert.equal(a.statusEvidence, null);
  for (const f of ['size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} is not written on the pages`);
  }
  assert.deepEqual(run.skipped, []);
});

test('jbu: status only from the detail status text, with evidence', async () => {
  // SYNTHETIC reshape: the real detail status value "Beglobis" replaced by a status word.
  const reserved = detail.replace('</strong>Beglobis</p>', '</strong>Rezervuotas</p>');
  const { run } = await collect(routesFor(list, {}, reserved));
  assert.equal(run.animals[0].status, 'reserved');
  assert.equal(run.animals[0].statusEvidence, 'Rezervuotas');
  // SYNTHETIC reshape: "Grįžo namo" -> excluded, goes to skipped.
  const home = detail.replace('</strong>Beglobis</p>', '</strong>Grįžo namo</p>');
  const r2 = await collect(routesFor(list, {}, home));
  assert.deepEqual(r2.run.animals, []);
  assert.deepEqual(r2.run.skipped, [{ nativeId: 'beglobis-gyvunas-11', reason: 'Grįžo namo' }]);
});

test('jbu: follows pagination links to the end', async () => {
  // SYNTHETIC: page 1 gets a link to page 2; page 2 is the real page with an empty grid.
  const p1 = list.replace("<div class='portfolio-pagination'></div>", `<div class='portfolio-pagination'><a href='${PAGE2}'>2</a></div>`);
  const p2 = list.replace(/<li class='isotope-item[\s\S]*?<\/li><\/ul>/, '</ul>');
  const { run, calls } = await collect(routesFor(p1, { [PAGE2]: html(p2) }));
  assert.deepEqual(calls.map(c => c.url), [ROBOTS, LIST, PAGE2, DETAIL]);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 1);
});

test('jbu: a full page without page links cannot prove the end -> partial', async () => {
  // SYNTHETIC reshape: per-page lowered to 1 so the one real card fills the page.
  const full = list.replace("data-per-page='20'", "data-per-page='1'");
  const { run } = await collect(routesFor(full));
  assert.equal(run.state, 'partial');
});

test('jbu: a failing page makes the run failed', async () => {
  const p1 = list.replace("<div class='portfolio-pagination'></div>", `<div class='portfolio-pagination'><a href='${PAGE2}'>2</a></div>`);
  const r1 = await collect(routesFor(p1, { [PAGE2]: { status: 500, body: 'error' } }));
  assert.equal(r1.run.state, 'failed');
  const r2 = await collect({ [ROBOTS]: { body: 'User-agent: *\n' }, [LIST]: { status: 503, body: 'down' } });
  assert.equal(r2.run.state, 'failed');
  // A failing detail page fails the run too.
  const r4 = await collect(routesFor(list, { [DETAIL]: { status: 500, body: 'error' } }));
  assert.equal(r4.run.state, 'failed');
  // Detail layout change is a failure.
  const r5 = await collect(routesFor(list, {}, '<html><body><p>nieko</p></body></html>'));
  assert.equal(r5.run.state, 'failed');
  assert.equal(r2.run.state, 'failed');
  // Layout change (no grid) is a failure, not an empty list.
  const r3 = await collect(routesFor('<html><body><p>nieko</p></body></html>'));
  assert.equal(r3.run.state, 'failed');
});
