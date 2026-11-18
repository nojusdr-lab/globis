'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/rozinepedute.cjs');
const N = require('../lib/normalize.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const LIST_HTML = fs.readFileSync(path.join(__dirname, '../fixtures/rozinepedute/gyvunai.html'), 'utf8');
const LIST = 'https://rozinepedute.lt/gyvunai/';
const PAGE2 = 'https://rozinepedute.lt/gyvunai/page/2/';
// Real robots.txt from the 2026-11-16 probe (probe-output/rozinepedute/index.json).
const ROBOTS_TXT = 'User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nUser-agent: Amazonbot\nUser-agent: Applebot-Extended\nUser-agent: CCBot\nUser-agent: ClaudeBot\nUser-agent: GPTBot\nUser-agent: Google-Extended\nUser-agent: GoogleOther\nUser-agent: Meta-ExternalAgent\nUser-agent: FacebookBot\nDisallow: /\n\nUser-agent: AhrefsBot\nUser-agent: AhrefsSiteAudit\nUser-agent: barkrowler\nUser-agent: DataForSeoBot\nUser-agent: dotbot\nUser-agent: rogerbot\nUser-agent: SemrushBot\nUser-agent: SiteAuditBot\nUser-agent: SemrushBot-BA\nDisallow: /\n\nSitemap: https://rozinepedute.lt/sitemap.xml\n';
const ROBOTS = { 'https://rozinepedute.lt/robots.txt': { body: ROBOTS_TXT, headers: { 'content-type': 'text/plain' } } };
const html = body => ({ body, headers: { 'content-type': 'text/html' } });
const ELVIS = { 'https://rozinepedute.lt/gyvunai/elvis/': html(fs.readFileSync(path.join(__dirname, '../fixtures/rozinepedute/detail-elvis.html'), 'utf8')) };
const routes = (list = LIST_HTML, extra = {}) => ({ ...ROBOTS, [LIST]: html(list), ...ELVIS, ...extra });

const REAL_SLUGS = ['emaja', 'frontis', 'fronkis', 'sansa', 'verona', 'cipsas', 'kometa', 'vava', 'elvis',
  'emkis', 'leke', 'minerva', 'savana', 'zuza', 'tigriuke', 'persiladas', 'kanapele', 'hebe'];

async function collect(r) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

// Synthetic two-page split of the REAL page: the same 18 real cards, 9 per page, and the loop
// query trail rewritten as if the site used posts_per_page 9 (only paging values are changed).
function splitPages() {
  const cards = LIST_HTML.match(/<li class="brxe-osapmh[\s\S]*?<\/article><\/li>\n?/g);
  assert.equal(cards.length, 18);
  const all = cards.join('');
  const trail = (page) => LIST_HTML.match(/<li class="brx-query-trail"[^>]*><\/li>/)[0]
    .replace('&quot;posts_per_page&quot;:-1', '&quot;posts_per_page&quot;:9')
    .replace('&quot;paged&quot;:1', `&quot;paged&quot;:${page}`)
    .replace('data-page="1"', `data-page="${page}"`)
    .replace('data-max-pages="-18"', 'data-max-pages="2"')
    .replace('data-end="18"', `data-end="${page * 9}"`);
  const realTrail = LIST_HTML.match(/<li class="brx-query-trail"[^>]*><\/li>/)[0];
  const make = (page, part) => LIST_HTML.replace(all, part.join('')).replace(realTrail, trail(page));
  return { p1: make(1, cards.slice(0, 9)), p2: make(2, cards.slice(9)) };
}

test('rozinepedute: robots.txt first, then one GET of the listing, own host only', async () => {
  const { calls } = await collect(routes());
  assert.deepEqual(calls.slice(0, 2).map(c => c.url), ['https://rozinepedute.lt/robots.txt', LIST]);
  assert.deepEqual(calls.slice(2).map(c => c.url), REAL_SLUGS.map(s => `${LIST}${s}/`), 'then one GET per animal page');
  assert.ok(calls.every(c => c.method === 'GET'));
  assert.deepEqual(adapter.hosts, ['rozinepedute.lt', 'www.rozinepedute.lt']);
});

test('rozinepedute: parses all 18 real cards; facts not on the list stay null', async () => {
  const { run } = await collect(routes());
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.animals.map(a => a.id), REAL_SLUGS.map(s => `rozinepedute:${s}`));
  const a = run.animals.find(x => x.id === 'rozinepedute:sansa');
  assert.equal(a.name, 'SANSA');
  assert.equal(a.sex, 'female');
  assert.equal(a.sourceUrl, 'https://rozinepedute.lt/gyvunai/sansa/');
  assert.equal(a.photos.length, 1);
  assert.match(a.photos[0], /^https:\/\/rozinepedute\.lt\/wp-content\/uploads\/.+\.(jpe?g|png|webp)$/i);
  assert.equal(run.animals.find(x => x.id === 'rozinepedute:cipsas').sex, 'male');
  assert.equal(run.animals.find(x => x.id === 'rozinepedute:cipsas').name, 'ČIPSAS');
  assert.equal(run.animals.filter(x => x.sex === 'female').length, 12);
  assert.equal(run.animals.filter(x => x.sex === 'male').length, 6);
  for (const x of run.animals.filter(a => a.id !== 'rozinepedute:elvis')) { // elvis: real detail page, own test
    for (const f of ['species', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt', 'sourceUpdatedAt']) {
      assert.equal(x[f], null, `${x.id} ${f} unknown`);
    }
  }
  // "Prieglaudoje: 1mėn. 14d." is time in the shelter, never age.
  assert.ok(!run.animals.some(x => /mėn|d\./.test(x.age_text ?? '')));
});

test('rozinepedute: status comes from the heading "Dovanojami gyvūnai" via normalize.status', async () => {
  const { run } = await collect(routes());
  const expected = N.status('Dovanojami gyvūnai');
  assert.equal(expected.status, 'available');
  for (const a of run.animals) {
    assert.equal(a.status, 'available');
    assert.equal(a.statusEvidence, 'Dovanojami gyvūnai');
  }
});

test('rozinepedute: a status word on a card wins, with evidence; unknown words -> unknown; excluded -> skipped', async () => {
  // Test-only reshaping of real cards: names replaced by TESTAS/TESTAS2/TESTAS3 with notes in
  // "NAME (note)" form. No real animal gets a made-up status.
  const h = LIST_HTML
    .replace('gyvunai/sansa/">SANSA<', 'gyvunai/testas/">TESTAS (rezervuota)<')
    .replace('gyvunai/verona/">VERONA<', 'gyvunai/testas2/">TESTAS2 (grįžo namo)<')
    .replace('gyvunai/vava/">VAVA<', 'gyvunai/testas3/">TESTAS3 (gydoma)<');
  const { run } = await collect(routes(h));
  const r = run.animals.find(a => a.id === 'rozinepedute:testas');
  assert.equal(r.name, 'TESTAS');
  assert.equal(r.status, 'reserved');
  assert.equal(r.statusEvidence, 'rezervuota');
  const u = run.animals.find(a => a.id === 'rozinepedute:testas3');
  assert.equal(u.status, 'unknown');
  assert.equal(u.statusEvidence, null);
  assert.ok(!run.animals.some(a => a.id === 'rozinepedute:testas2'));
  assert.deepEqual(run.skipped, [{ nativeId: 'testas2', reason: 'grįžo namo' }]);
});

test('rozinepedute: loop shows all (-1) -> rel=next in <head> is not followed, run complete', async () => {
  assert.match(LIST_HTML, /<link rel="next" href="https:\/\/rozinepedute\.lt\/gyvunai\/page\/2\/">/);
  const { run, calls } = await collect(routes());
  assert.equal(run.state, 'complete');
  assert.ok(!calls.some(c => c.url === PAGE2));
});

test('rozinepedute: paged loop is walked to data-max-pages and stops there', async () => {
  const { p1, p2 } = splitPages();
  const { run, calls } = await collect(routes(p1, { [PAGE2]: html(p2) }));
  assert.equal(run.state, 'complete');
  assert.deepEqual(calls.map(c => c.url).filter(u => !REAL_SLUGS.some(s => u === `${LIST}${s}/`)), ['https://rozinepedute.lt/robots.txt', LIST, PAGE2]);
  assert.deepEqual(run.animals.map(a => a.id), REAL_SLUGS.map(s => `rozinepedute:${s}`));
});

test('rozinepedute: cannot prove the end -> partial', async () => {
  const noTrail = LIST_HTML.replace(/<li class="brx-query-trail"[^>]*><\/li>/, '');
  assert.equal((await collect(routes(noTrail))).run.state, 'partial');
  const fewer = LIST_HTML.replace('data-end="18"', 'data-end="19"');
  assert.equal((await collect(routes(fewer))).run.state, 'partial');
});

test('rozinepedute: a failing page makes the run failed', async () => {
  assert.equal((await collect({ ...ROBOTS, [LIST]: { status: 500, body: 'error' } })).run.state, 'failed');
  assert.equal((await collect(ROBOTS)).run.state, 'failed'); // listing 404
  const { p1 } = splitPages();
  assert.equal((await collect(routes(p1))).run.state, 'failed', 'page 2 missing (404)');
});

test('rozinepedute: a listing with no animal links fails instead of publishing an empty list', async () => {
  const { run } = await collect(routes('<html><body><main><h1>Dovanojami gyvūnai</h1></main></body></html>'));
  assert.equal(run.state, 'failed');
});

test('rozinepedute: real detail page table gives birth date, sex and health facts', async () => {
  const { run } = await collect(routes());
  const e = run.animals.find(a => a.id === 'rozinepedute:elvis');
  assert.deepEqual([e.age_text, e.sex, e.neutered, e.chipped, e.vaccinated], ['2026 06 20', 'male', false, true, true]);
  assert.equal(e.species, null, 'no species row on the page');
  assert.equal(e.bio_lt, null, 'empty description block');
  const other = run.animals.find(a => a.id === 'rozinepedute:sansa');
  assert.equal(other.vaccinated, null, 'detail page not in fixtures (404): card facts stay');
});
