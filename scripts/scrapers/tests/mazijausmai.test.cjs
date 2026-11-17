'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/mazijausmai.cjs');
const N = require('../lib/normalize.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const LIST_HTML = fs.readFileSync(path.join(__dirname, '../fixtures/mazijausmai/ieskantys-namu.html'), 'utf8');
const LIST = 'https://mazijausmai.lt/ieskantys-namu/';
// Real robots.txt from the 2026-11-16 probe.
const ROBOTS_TXT = 'User-agent: *\r\nDisallow: /wp-admin/\r\nAllow: /wp-admin/admin-ajax.php\r\n\r\nSitemap: https://mazijausmai.lt/sitemap.xml\r\nSitemap: https://mazijausmai.lt/sitemap.rss\n';
const ROBOTS = { 'https://mazijausmai.lt/robots.txt': { body: ROBOTS_TXT, headers: { 'content-type': 'text/plain' } } };
const routes = (html = LIST_HTML) => ({ ...ROBOTS, [LIST]: { body: html, headers: { 'content-type': 'text/html' } } });

async function collect(r) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('mazijausmai: robots.txt first, then one GET of the listing, own host only', async () => {
  const { calls } = await collect(routes());
  assert.deepEqual(calls.map(c => c.url), ['https://mazijausmai.lt/robots.txt', LIST]);
  assert.ok(calls.every(c => c.method === 'GET'));
  assert.deepEqual(adapter.hosts, ['mazijausmai.lt', 'www.mazijausmai.lt']);
});

test('mazijausmai: parses linked cards; facts not on the list stay null', async () => {
  const { run } = await collect(routes());
  assert.equal(run.state, 'complete');
  const ids = run.animals.map(a => a.id);
  assert.deepEqual(ids, ['liepsnele', 'orionas', 'saris', 'micaras', 'arielis', 'klivija', 'kiras', 'ramunele'].map(s => `mazijausmai:${s}`));
  const a = run.animals[0];
  assert.equal(a.name, 'Liepsnelė');
  assert.equal(a.sourceUrl, 'https://mazijausmai.lt/liepsnele/');
  assert.deepEqual(a.photos, ['https://mazijausmai.lt/wp-content/uploads/2021/03/inbound551178545470449814-1-1024x766.jpg']);
  for (const f of ['species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
    assert.equal(a[f], null, `${f} unknown`);
  }
  const r = run.animals.find(x => x.id === 'mazijausmai:ramunele');
  assert.equal(r.name, 'Ramunėlė');
  assert.equal(r.sourceUrl, 'https://mazijausmai.lt/ramunele/', 'absolute link form also accepted');
});

test('mazijausmai: status comes from the page heading via normalize.status, never assumed', async () => {
  const { run } = await collect(routes());
  const expected = N.status('Namų ieškantys gyvūnai');
  for (const a of run.animals) {
    assert.equal(a.status, expected.status);
    assert.equal(a.statusEvidence, expected.statusEvidence);
  }
});

test('mazijausmai: placeholders ignored, unlinked "not offered" animal skipped with its own words', async () => {
  const { run } = await collect(routes());
  assert.deepEqual(run.skipped, [{ nativeId: 'Pusnė', reason: 'kol kas nedovanojama - gydoma' }]);
  assert.ok(!run.animals.some(a => a.name === '.' || a.name === 'Pusnė'));
});

test('mazijausmai: an explicit status word in a caption wins, with evidence', async () => {
  // Test-only cards (no real animal gets a made-up status): the real Kiras and Arielis cells are
  // relabelled TESTAS / TESTAS2 and given status notes in the site's own "Name (note)" caption style.
  const html = LIST_HTML.replace('href="/kiras"', 'href="/testas"').replace('>Kiras</figcaption>', '>TESTAS (rezervuotas)</figcaption>')
    .replace('href="/arielis"', 'href="/testas2"').replace('>Arielis</figcaption>', '>TESTAS2 (grįžo namo)</figcaption>');
  const { run } = await collect(routes(html));
  const k = run.animals.find(a => a.id === 'mazijausmai:testas');
  assert.equal(k.name, 'TESTAS');
  assert.equal(k.status, 'reserved');
  assert.equal(k.statusEvidence, 'rezervuotas');
  assert.ok(!run.animals.some(a => a.id === 'mazijausmai:testas2'));
  assert.ok(run.skipped.some(s => s.nativeId === 'testas2' && s.reason === 'grįžo namo'));
});

test('mazijausmai: single page = complete; pagination links appearing = not complete', async () => {
  const html = LIST_HTML.replace('</article>', '<nav class="nav-links"><a class="next page-numbers" href="/ieskantys-namu/page/2/">2</a></nav></article>');
  const { run } = await collect(routes(html));
  assert.equal(run.state, 'partial');
});

test('mazijausmai: a failing listing page makes the run failed', async () => {
  const { run } = await collect({ ...ROBOTS, [LIST]: { status: 500, body: 'error' } });
  assert.equal(run.state, 'failed');
  const { run: run2 } = await collect(ROBOTS); // 404
  assert.equal(run2.state, 'failed');
});

test('mazijausmai: a listing with no animal links fails instead of publishing an empty list', async () => {
  const { run } = await collect(routes('<html><body><main><h1>Namų ieškantys gyvūnai</h1></main></body></html>'));
  assert.equal(run.state, 'failed');
});
