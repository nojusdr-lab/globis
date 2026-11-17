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
const ROBOTS = 'https://jbu.lt/robots.txt';
const LIST = 'https://jbu.lt/beglobiai-gyvunai/';
const PAGE2 = 'https://jbu.lt/beglobiai-gyvunai/page/2/';

const html = body => ({ body, headers: { 'content-type': 'text/html; charset=UTF-8' } });
const routesFor = (body, extra = {}) => ({
  // Real probe answer (2026-11-16): robots.txt is just "User-agent: *".
  [ROBOTS]: { body: 'User-agent: *\n', headers: { 'content-type': 'text/plain' } },
  [LIST]: html(body),
  ...extra,
});

async function collect(routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(routes, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('jbu: robots.txt first, then one GET of the list page', async () => {
  const { calls } = await collect(routesFor(list));
  assert.deepEqual(calls.map(c => c.url), [ROBOTS, LIST]);
  assert.ok(calls.every(c => c.method === 'GET' && new URL(c.url).hostname === 'jbu.lt'));
});

test('jbu: parses the portfolio card; unknown facts stay null', async () => {
  const { run } = await collect(routesFor(list));
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.animals.map(a => a.id), ['jbu:beglobis-gyvunas-11']);
  const a = run.animals[0];
  assert.equal(a.sourceUrl, 'https://jbu.lt/portfolio/beglobis-gyvunas-11/');
  assert.deepEqual(a.photos, ['https://jbu.lt/wp-content/uploads/2026/10/20261014_104408-360x267.jpg']);
  assert.equal(a.name, null, '"Beglobis gyvūnas" is a generic label, not a name');
  assert.equal(a.status, 'unknown', 'the card has no status text');
  assert.equal(a.statusEvidence, null);
  for (const f of ['species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} is not written on the list page`);
  }
  assert.deepEqual(run.skipped, []);
});

test('jbu: status only from the card text, with evidence', async () => {
  // SYNTHETIC reshape: the real empty subtitle filled with a status word.
  const reserved = list.replace("<div class='subtitle text-center'></div>", "<div class='subtitle text-center'>Rezervuotas</div>");
  const { run } = await collect(routesFor(reserved));
  assert.equal(run.animals[0].status, 'reserved');
  assert.equal(run.animals[0].statusEvidence, 'Rezervuotas');
  // SYNTHETIC reshape: "Grįžo namo" -> excluded, goes to skipped.
  const home = list.replace("<div class='subtitle text-center'></div>", "<div class='subtitle text-center'>Grįžo namo</div>");
  const r2 = await collect(routesFor(home));
  assert.deepEqual(r2.run.animals, []);
  assert.deepEqual(r2.run.skipped, [{ nativeId: 'beglobis-gyvunas-11', reason: 'Grįžo namo' }]);
});

test('jbu: follows pagination links to the end', async () => {
  // SYNTHETIC: page 1 gets a link to page 2; page 2 is the real page with an empty grid.
  const p1 = list.replace("<div class='portfolio-pagination'></div>", `<div class='portfolio-pagination'><a href='${PAGE2}'>2</a></div>`);
  const p2 = list.replace(/<li class='isotope-item[\s\S]*?<\/li><\/ul>/, '</ul>');
  const { run, calls } = await collect(routesFor(p1, { [PAGE2]: html(p2) }));
  assert.deepEqual(calls.map(c => c.url), [ROBOTS, LIST, PAGE2]);
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
  // Layout change (no grid) is a failure, not an empty list.
  const r3 = await collect(routesFor('<html><body><p>nieko</p></body></html>'));
  assert.equal(r3.run.state, 'failed');
});
