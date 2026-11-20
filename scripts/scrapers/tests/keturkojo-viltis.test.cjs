'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../adapters/keturkojo-viltis.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');
const routes = require('../fixtures/keturkojo-viltis/routes.json');

test('keturkojo-viltis: missing API image uses only the own gallery, never a related animal', async () => {
  const posts = Object.values(routes).flatMap(v => Array.isArray(v) ? v : Array.isArray(v.body) ? v.body : []);
  const missing = posts.find(p => p.id === 2050 && p.link);
  const r = { ...routes, [missing.link]: { body: `<div class="kv-gallery__main"><img src="/own-dog.jpg"></div>
    <div class="kv-card__img"><img src="/different-animal.jpg"></div>` } };
  const run = await runSource(adapter, { fetcher: createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, []) }), cache: createParseCache(null) });
  assert.deepEqual(run.animals.find(a => a.id === 'keturkojo-viltis:2050').photos, ['https://keturkojo-viltis.lt/own-dog.jpg']);
});

test('keturkojo-viltis: species from rusis, age from "Spėjama gimimo data", status unknown', async () => {
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(routes, []) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  assert.equal(run.state, 'complete');
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  const m = byId['keturkojo-viltis:2077'];
  assert.equal(m.name, 'Morana');
  assert.equal(m.species, 'cat');
  assert.equal(m.age_text, 'Spėjama gimimo data: 2025-10-01');
  assert.equal(m.sex, null);
  assert.equal(m.status, 'unknown');
  assert.deepEqual(m.photos, ['https://keturkojo-viltis.lt/wp-content/uploads/2026/11/morana.jpg']);
  const t = byId['keturkojo-viltis:2050'];
  assert.equal(t.species, 'dog');
  assert.equal(t.age_text, null);
  assert.deepEqual(t.photos, []);
});

test('keturkojo-viltis: Žvirbliukas page gives birth date, health facts and a clean description', async () => {
  const key = Object.keys(routes).find(k => k.includes('/gyvunas?'));
  // Trimmed from https://keturkojo-viltis.lt/gyvunai/zvirbliukas/ (REST content, 2026-11-19).
  const content = '<p><a href="https://www.facebook.com/share/p/1KWB1vBWHB/">Facebook nuoroda</a></p>\n'
    + '<p><b>Gimimo data – 2018-06-05<br /></b></p>\n<p><b>Svoris – 9 kg.</b></p>\n'
    + '<p><b>Ženklintas, skiepytas, kastruotas.</b></p>\n<p> Žvirbliukas toks kietas. Kitų gyvūnų draugijos nemėgsta. </p>\n'
    + '<p> Prieglaudoje nuo: 2026 m. birželio mėn. </p>\n<p> ☎️ +37065782030 </p>\n<p> www.keturkojo-viltis.lt </p>\n'
    + '<p> Šuneliai: Stoties g. 12, Alytus Katinėliai: Studentų g. 13, Alytus </p>';
  const post = { id: 49, link: 'https://keturkojo-viltis.lt/gyvunai/zvirbliukas/', title: { rendered: 'Žvirbliukas' },
    modified_gmt: '2026-11-04T09:32:33', featured_media: 0, content: { rendered: content }, rusis: routes[key].body[1].rusis };
  const r = { ...routes, [key]: { ...routes[key], body: [post] } };
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, []) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  const z = run.animals[0];
  assert.equal(z.age_text, 'Gimimo data: 2018-06-05');
  assert.deepEqual([z.chipped, z.vaccinated, z.neutered], [true, true, true]);
  assert.equal(z.sex, null); // the page never states it
  assert.match(z.bio_lt, /^Gimimo data/);
  assert.match(z.bio_lt, /Prieglaudoje nuo: 2026 m\. birželio mėn\.$/);
  assert.doesNotMatch(z.bio_lt, /Facebook|☎|Stoties|keturkojo-viltis\.lt/);
});

test('keturkojo-viltis: detail page gives sex and status from its fact list', async () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '../fixtures/keturkojo-viltis/morana.html'), 'utf8');
  const r = { ...routes, 'https://keturkojo-viltis.lt/gyvunai/morana/': { body: html } };
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, []) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  assert.equal(run.state, 'complete');
  const m = run.animals.find(a => a.id === 'keturkojo-viltis:2077');
  assert.equal(m.sex, 'female', '<dt>Lytis</dt><dd>Patelė</dd>');
  assert.equal(m.status, 'available', '"Ieško namų"');
  assert.equal(m.statusEvidence, 'Ieško namų');
  assert.equal(m.age_text, 'Spėjama gimimo data: 2025-10-01');
  // No detail page for the other fixture animal: its REST facts stay, nothing is guessed.
  const t = run.animals.find(a => a.id === 'keturkojo-viltis:2050');
  assert.equal(t.sex, null);
  assert.equal(t.status, 'unknown');
});

test('keturkojo-viltis: a returned/deceased detail is excluded without failing every other animal', async () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '../fixtures/keturkojo-viltis/morana.html'), 'utf8');
  const r = { ...routes, 'https://keturkojo-viltis.lt/gyvunai/morana/': { body: html.replace('Ieško namų', 'Grįžo namo') } };
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, []) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 1);
  assert.equal(run.animals[0].id, 'keturkojo-viltis:2050');
  assert.deepEqual(run.skipped, [{ nativeId: '2077', reason: 'Grįžo namo' }]);
});

test('keturkojo-viltis: own facts and missing photo use one request and ignore related facts', async () => {
  const calls = [];
  const post = Object.values(routes).flatMap(r => r?.body || []).find(p => p?.id === 2050);
  const r = { ...routes, [post.link]: { body: '<aside class="kv-animal__panel"><dl class="kv-facts"><dt>Lytis</dt><dd>Patinas</dd></dl></aside>'
    + '<div class="kv-gallery__main"><img src="/own-photo.jpg"><img src="https://different.example/foreign.jpg"></div>'
    + '<section class="related"><dl><dt>Lytis</dt><dd>Patelė</dd></dl><img src="/related.jpg"></section>' } };
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  const a = run.animals.find(a => a.id === 'keturkojo-viltis:2050');
  assert.equal(a.sex, 'male');
  assert.deepEqual(a.photos, ['https://keturkojo-viltis.lt/own-photo.jpg']);
  assert.equal(calls.filter(c => c.url === post.link).length, 1, 'no duplicate gallery/detail request');
});
