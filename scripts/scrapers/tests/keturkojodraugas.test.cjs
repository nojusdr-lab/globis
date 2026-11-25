'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/keturkojodraugas.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const fx = name => fs.readFileSync(path.join(__dirname, '../fixtures/keturkojodraugas', name), 'utf8');
const routes = {
  'https://keturkojodraugas.lt/robots.txt': { body: fx('robots.txt') },
  'https://keturkojodraugas.lt/kates/': { body: fx('kates.html') },
  'https://keturkojodraugas.lt/sunys/': { body: fx('sunys.html') },
};

async function collect(r = routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('keturkojodraugas: robots.txt first, then one GET per listing page, nothing else', async () => {
  const { calls } = await collect();
  assert.deepEqual(calls.map(c => c.url), [
    'https://keturkojodraugas.lt/robots.txt',
    'https://keturkojodraugas.lt/kates/',
    'https://keturkojodraugas.lt/sunys/',
  ]);
  assert.ok(calls.every(c => c.method === 'GET'));
});

test('keturkojodraugas: parses card tables and free text, unknowns stay null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), [
    'keturkojodraugas:kates-alfonsas', 'keturkojodraugas:kates-lape',
    'keturkojodraugas:kates-mike', 'keturkojodraugas:kates-zaibas',
  ]);
  const z = byId['keturkojodraugas:kates-zaibas'];
  assert.equal(z.name, 'Žaibas');
  assert.equal(z.species, 'cat', 'from heading "Dovanojamos Katės"');
  assert.equal(z.sex, 'male');
  assert.equal(z.age_text, '2026-07-30');
  assert.equal(z.neutered, false, 'Sterilizacija/kastracija: Neatlikta');
  assert.equal(z.vaccinated, true, '"Skiepytas"');
  assert.equal(z.chipped, true, '"ženklintas"');
  assert.deepEqual(z.photos, ['https://keturkojodraugas.lt/wp-content/uploads/2026/10/ZAIBAS.jpeg']);
  assert.equal(z.sourceUrl, 'https://keturkojodraugas.lt/kates/#zaibas');
  assert.equal(new Set(run.animals.map(a => a.sourceUrl)).size, run.animals.length); // DB needs unique listing URLs
  assert.match(z.bio_lt, /Charakteris: Atsargus/);

  const m = byId['keturkojodraugas:kates-mike'];
  assert.equal(m.sex, 'female', '"Patele"');
  assert.equal(m.neutered, true);
  assert.equal(m.vaccinated, true, '"Paskiepyta"');
  assert.equal(m.chipped, true, '"suženklinta"');

  const a = byId['keturkojodraugas:kates-alfonsas'];
  assert.equal(a.vaccinated, null, 'text does not mention vaccination');
  assert.equal(a.chipped, null);
  assert.equal(a.size, null, 'site has no size field');
  assert.equal(a.sourceUpdatedAt, null);
  for (const x of run.animals) assert.doesNotMatch(x.bio_lt || '', /\d{6,}|facebook|Jų istorijos/i, 'no page-level text or contacts');
});

test('keturkojodraugas: status comes from page text with evidence', async () => {
  const { run } = await collect();
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const a = byId['keturkojodraugas:kates-alfonsas'];
  assert.equal(a.status, 'available');
  assert.equal(a.statusEvidence, 'Dovanojamos Katės');
  const l = byId['keturkojodraugas:kates-lape'];
  assert.equal(l.status, 'unknown', '"Dar nedovanojama" = not offered yet');
  assert.equal(l.statusEvidence, null);
  assert.deepEqual(run.skipped, []);
});

test('keturkojodraugas: single-page lists; empty list notice gives zero dogs, complete', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.filter(a => a.species === 'dog').length, 0);
});

test('keturkojodraugas: a failing page makes the run failed', async () => {
  const broken = { ...routes };
  delete broken['https://keturkojodraugas.lt/sunys/'];
  const { run } = await collect(broken);
  assert.equal(run.state, 'failed');
  assert.equal(run.animals.length, 0);
});

test('keturkojodraugas: changed layout (no cards, no empty notice) fails instead of publishing empty', async () => {
  const changed = { ...routes, 'https://keturkojodraugas.lt/sunys/': { body: fx('sunys.html').replace('Informacija ruošiama', '') } };
  const { run } = await collect(changed);
  assert.equal(run.state, 'failed');
  const gone = { ...routes, 'https://keturkojodraugas.lt/kates/': { body: '<html><body><h1>Dovanojamos Katės</h1></body></html>' } };
  assert.equal((await collect(gone)).run.state, 'failed');
});

test('keturkojodraugas: table and card text that contradict each other give null, not the table value', () => {
  const card = (name, neut, text) => `<h1>Dovanojamos Katės</h1><div class="alm-listing"><div class="card"><img src="/a.jpg"><div class="card-body">
    <h4>${name}</h4><table><tr><th>Lytis</th><td>Patinas</td></tr><tr><th>Amžius</th><td>-</td></tr><tr><th>Sterilizacija/kastracija</th><td>${neut}</td></tr></table>
    <div class="col-12"><p><b>Kiti ypatumai</b></p><p>${text}</p></div></div></div></div>`;
  const page = { slug: 'kates', url: 'https://keturkojodraugas.lt/kates/' };
  // Live 2026-11-25 (LAPKRITIS): table "Neatlikta", text "Skiepytas, ženklintas, kastruotas."
  const [a] = adapter._parseListing(card('LAPKRITIS', 'Neatlikta', 'Skiepytas, ženklintas, kastruotas.'), page).animals;
  assert.equal(a.neutered, null, 'shelter says both: unknown');
  assert.equal(a.age_text, null, '"-" is an empty cell');
  assert.equal(a.chipped, true);
  const [b] = adapter._parseListing(card('X', 'Neatlikta', 'Skiepytas.'), page).animals;
  assert.equal(b.neutered, false, 'no contradiction: table value');
  const [c] = adapter._parseListing(card('Y', 'Atlikta', 'Kastruotas.'), page).animals;
  assert.equal(c.neutered, true);
});

test('keturkojodraugas: contradicted field is marked contested so record.cjs keeps it null', () => {
  const { makeAnimal } = require('../lib/record.cjs');
  const body = `<h1>Dovanojamos Katės</h1><div class="alm-listing"><div class="card"><img src="/a.jpg"><div class="card-body">
    <h4>LAPKRITIS</h4><table><tr><th>Sterilizacija/kastracija</th><td>Neatlikta</td></tr></table>
    <div class="col-12"><p><b>Kiti ypatumai</b></p><p>Skiepytas, ženklintas, kastruotas.</p></div></div></div></div>`;
  const [a] = adapter._parseListing(body, { slug: 'kates', url: 'https://keturkojodraugas.lt/kates/' }).animals;
  assert.deepEqual(a.contested, ['neutered']);
  assert.equal(makeAnimal('keturkojodraugas', a).neutered, null);
});
