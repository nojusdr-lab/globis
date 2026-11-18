'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseRobots, isAllowed, crawlDelay } = require('../lib/robots.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');
const { makeAnimal } = require('../lib/record.cjs');
const { publish } = require('../lib/snapshot.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

test('robots: longest match, allow wins ties, wildcards, specific agent groups', () => {
  const r = parseRobots(`User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nDisallow: /*?add-to-cart=\n\nUser-agent: ClaudeBot\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: Slurp\nCrawl-delay: 604800`);
  assert.equal(isAllowed(r, 'GlobisBot/0.1', '/'), true);
  assert.equal(isAllowed(r, 'GlobisBot/0.1', '/wp-admin/x'), false);
  assert.equal(isAllowed(r, 'GlobisBot/0.1', '/wp-admin/admin-ajax.php'), true);
  assert.equal(isAllowed(r, 'GlobisBot/0.1', '/shop/?add-to-cart=5'), false);
  assert.equal(isAllowed(r, 'ClaudeBot/1.0', '/'), false);
  assert.equal(crawlDelay(parseRobots('User-agent: *\nCrawl-delay: 10'), 'GlobisBot/0.1'), 10);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:'), 'GlobisBot', '/anything'), true);
  assert.equal(isAllowed(parseRobots('User-agent: globisbot\nDisallow: /'), 'GlobisBot/0.1 (+x)', '/a'), false);
});

test('fetcher: reads robots first, respects disallow, crawl-delay and host allowlist', async () => {
  const calls = [];
  const clock = fakeClock();
  const f = createFetcher({
    allowedHosts: ['a.lt'], minDelayMs: 5000, ...clock,
    fetchImpl: fakeFetch({
      'https://a.lt/robots.txt': { body: 'User-agent: *\nDisallow: /private\nCrawl-delay: 10' },
      'https://a.lt/x': { body: 'X' },
      'https://a.lt/y': { body: 'Y' },
    }, calls),
  });
  assert.equal((await f.get('https://a.lt/x')).body, 'X');
  assert.equal((await f.get('https://a.lt/y')).body, 'Y');
  assert.equal(calls[0].url, 'https://a.lt/robots.txt');
  assert.match(calls[0].ua, /^GlobisBot\//);
  assert.ok(calls.every(c => c.method === 'GET'));
  assert.ok(clock.sleeps.every(ms => ms >= 5000));
  assert.ok(clock.sleeps.includes(10000), 'crawl-delay 10s honoured');
  await assert.rejects(f.get('https://a.lt/private/1'), e => e.code === 'robots');
  await assert.rejects(f.get('https://evil.example/'), e => e.code === 'host');
  assert.equal(calls.length, 3, 'blocked URLs are never requested');
});

test('fetcher: robots.txt error = deny all (fail-closed); 404 = no rules', async () => {
  const clock = fakeClock();
  const f = createFetcher({ allowedHosts: ['a.lt', 'b.lt'], ...clock, fetchImpl: fakeFetch({
    'https://a.lt/robots.txt': { status: 500, body: 'err' },
    'https://b.lt/page': { body: 'ok' },
  }) });
  await assert.rejects(f.get('https://a.lt/page'), e => e.code === 'robots');
  assert.equal((await f.get('https://b.lt/page')).body, 'ok');
});

test('fetcher: 401/403 is treated as restricted and not retried or bypassed', async () => {
  const f = createFetcher({ allowedHosts: ['a.lt'], ...fakeClock(), fetchImpl: fakeFetch({
    'https://a.lt/robots.txt': { status: 404, body: '' },
    'https://a.lt/members': { status: 403, body: 'login' },
  }) });
  await assert.rejects(f.get('https://a.lt/members'), e => e.code === 'restricted');
});

test('fetcher: redirect to another host is refused', async () => {
  const f = createFetcher({ allowedHosts: ['a.lt'], ...fakeClock(), fetchImpl: fakeFetch({
    'https://a.lt/robots.txt': { status: 404, body: '' },
    'https://a.lt/go': { status: 302, body: '', headers: { location: 'https://other.lt/' } },
  }) });
  await assert.rejects(f.get('https://a.lt/go'), e => e.code === 'host');
});

test('normalize: Lithuanian labels map to schema values, anything unclear is null', () => {
  assert.equal(N.species('Šuo'), 'dog');
  assert.equal(N.species('Katė'), 'cat');
  assert.equal(N.species('Mišrūnas'), null);
  assert.equal(N.sex('Patinas'), 'male');
  assert.equal(N.sex('Patelė'), 'female');
  assert.equal(N.sex('nežinoma'), null);
  assert.equal(N.yesNo('Atlikta'), true);
  assert.equal(N.yesNo('Neatlikta'), false);
  assert.equal(N.yesNo('planuojama'), null);
  assert.deepEqual(N.status('Rezervuotas 2026-11-10'), { status: 'reserved', statusEvidence: 'Rezervuotas 2026-11-10' });
  assert.equal(N.status('Padovanota').status, 'confirmed_adopted');
  assert.equal(N.status('Dovanojama(-as)').status, 'available');
  assert.equal(N.status('Grįžo namo').status, 'excluded');
  assert.equal(N.status('Karantinuojamas 2026-11-10').status, 'unknown');
  assert.equal(N.status('').status, 'unknown');
});

test('normalize: phone numbers and emails are removed from free text', () => {
  const t = N.stripPrivate('Skambinti tel. +370 656 14 950 arba 064064466, rašyti jonas@example.lt. Gimęs 2022.');
  assert.doesNotMatch(t, /656|064064466|example\.lt/);
  assert.match(t, /Gimęs 2022/);
});

test('labels: table pairs and "Label: value" lines', () => {
  const a = L.fromPairs([['Lytis', 'Patinas'], ['Amžius', 'Apie 3 metai'], ['Sterilizacija/kastracija', 'Atlikta'], ['Kailio spalva', 'Juoda']]);
  assert.deepEqual(a, { sex: 'male', age_text: 'Apie 3 metai', neutered: true });
  const b = L.fromPairs(L.pairsFromText('<p>Statusas: Padovanota</p><p>Lytis: Patelė</p><p>Atlikta sterilizacija: Ne</p>'));
  assert.deepEqual(b, { status: 'confirmed_adopted', statusEvidence: 'Padovanota', sex: 'female', neutered: false });
});

test('record: reserved/adopted need evidence; unknown fields stay null', () => {
  assert.throws(() => makeAnimal('s', { nativeId: '1', sourceUrl: 'https://a.lt/1', status: 'reserved' }), /evidence/);
  const a = makeAnimal('s', { nativeId: '1', sourceUrl: 'https://a.lt/1', name: 'Rex' });
  assert.equal(a.id, 's:1');
  assert.equal(a.status, 'unknown');
  for (const k of ['species', 'sex', 'age_text', 'size', 'chipped', 'vaccinated', 'neutered', 'bio_lt']) assert.equal(a[k], null, k);
  assert.throws(() => makeAnimal('s', { nativeId: '1', sourceUrl: 'https://a.lt/1', status: 'adopted' }), /status/);
});

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'globis-scr-')); }
const run = (ids, state = 'complete', extra = {}) => ({ source: 'x', state, startedAt: 't0', finishedAt: 't1', skipped: [], errors: [], requests: 1,
  animals: ids.map(id => makeAnimal('x', { nativeId: String(id), sourceUrl: `https://a.lt/${id}`, ...(extra[id] || {}) })) });

test('snapshot: failed, partial or empty runs never replace the last good copy', () => {
  const dir = tmp();
  assert.equal(publish(run([1, 2, 3]), { outDir: dir }).published, true);
  const good = fs.readFileSync(path.join(dir, 'x/published.json'), 'utf8');
  assert.equal(publish(run([1], 'failed'), { outDir: dir }).published, false);
  assert.equal(publish(run([1], 'partial'), { outDir: dir }).published, false);
  assert.equal(publish(run([]), { outDir: dir }).published, false);
  assert.equal(fs.readFileSync(path.join(dir, 'x/published.json'), 'utf8'), good);
});

test('snapshot: a big drop waits for 3 identical runs; disappeared = no_longer_listed, not adopted', () => {
  const dir = tmp();
  const ids = Array.from({ length: 20 }, (_, i) => i + 1);
  publish(run(ids), { outDir: dir });
  const smaller = ids.slice(0, 10);
  assert.equal(publish(run(smaller), { outDir: dir }).published, false);
  assert.equal(publish(run(smaller), { outDir: dir }).published, false);
  assert.equal(publish(run(smaller), { outDir: dir }).published, true);
  const hist = fs.readFileSync(path.join(dir, 'x/history.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const gone = hist.filter(h => h.status === 'no_longer_listed');
  assert.equal(gone.length, 10);
  assert.ok(!hist.some(h => h.status === 'confirmed_adopted'));
});

test('snapshot: small normal changes publish at once and record status changes', () => {
  const dir = tmp();
  publish(run([1, 2, 3, 4, 5]), { outDir: dir });
  const r = publish(run([1, 2, 3, 4, 6], 'complete', { 1: { status: 'reserved', statusEvidence: 'Rezervuotas' } }), { outDir: dir });
  assert.equal(r.published, true);
  const hist = fs.readFileSync(path.join(dir, 'x/history.jsonl'), 'utf8').trim().split('\n').map(JSON.parse).slice(5);
  assert.deepEqual(hist.map(h => [h.id, h.status]).sort(), [['x:1', 'reserved'], ['x:5', 'no_longer_listed'], ['x:6', 'unknown']]);
});

test('runSource: adapter error = failed run; invalid animal = partial run', async () => {
  const boom = await runSource({ id: 'x', collect: async () => { throw new Error('site down'); } }, {});
  assert.equal(boom.state, 'failed');
  const bad = await runSource({ id: 'x', collect: async () => ({ complete: true, animals: [{ nativeId: '1', sourceUrl: 'https://a.lt/1' }, { nativeId: '', sourceUrl: 'https://a.lt/2' }] }) }, {});
  assert.equal(bad.state, 'partial');
  const notDone = await runSource({ id: 'x', collect: async () => ({ complete: false, animals: [{ nativeId: '1', sourceUrl: 'https://a.lt/1' }] }) }, {});
  assert.equal(notDone.state, 'partial');
});

test('fetcher: follows robots.txt redirect http -> https on a declared host', async () => {
  const f = createFetcher({ allowedHosts: ['a.lt'], ...fakeClock(), fetchImpl: fakeFetch({
    'http://a.lt/robots.txt': { status: 301, body: '', headers: { location: 'https://a.lt/robots.txt' } },
    'https://a.lt/robots.txt': { body: 'User-agent: *\nDisallow: /x' },
    'http://a.lt/page': { body: 'ok' },
  }) });
  assert.equal((await f.get('http://a.lt/page')).body, 'ok');
  await assert.rejects(f.get('http://a.lt/x'), e => e.code === 'robots');
});

test('cleanText decodes numeric and named HTML entities in one pass', () => {
  const { cleanText } = require('../lib/normalize.cjs');
  assert.equal(cleanText('naujokus&#8230; &#x41;&scaron;&nbsp;&amp;#8230;'), 'naujokus… Aš &#8230;');
  assert.equal(cleanText('a &bogus; b &#0; c'), 'a &bogus; b &#0; c');
});

test('record: http photos on an https page become https only for the same host', () => {
  const a = makeAnimal('s', { nativeId: '1', sourceUrl: 'https://www.a.lt/1',
    photos: ['http://www.a.lt/x.jpg', 'http://cdn.other.lt/y.jpg', '/z.jpg'] });
  assert.deepEqual(a.photos, ['https://www.a.lt/x.jpg', 'http://cdn.other.lt/y.jpg', 'https://www.a.lt/z.jpg']);
});

test('size: the word before a bracket or comma counts; other words stay unknown', () => {
  const N = require('../lib/normalize.cjs');
  assert.equal(N.size('Mažas (iki 30cm ties ketera)'), 'small');
  assert.equal(N.size('Vidutinis, 15 kg'), 'medium');
  assert.equal(N.size('Nedidukas, 10 kg svorio'), null);
  assert.equal(require('../lib/labels.cjs').fieldFor('Ūgio kategorija'), 'size');
});
