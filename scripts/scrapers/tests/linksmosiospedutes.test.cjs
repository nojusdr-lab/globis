'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../adapters/linksmosiospedutes.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const fx = name => fs.readFileSync(path.join(__dirname, '../fixtures/linksmosiospedutes', name), 'utf8');
const B = 'https://www.linksmosiospedutes.lt';
const routes = {
  [`${B}/robots.txt`]: { body: fx('robots.txt') },
  [`${B}/lt/suniukai/`]: { body: fx('suniukai.html') },
  [`${B}/lt/kaciukai/`]: { body: fx('kaciukai.html') },
  [`${B}/lt/suniukai/oronas-18181.html`]: { body: fx('detail-18181.html') },
};

async function collect(r = routes) {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(r, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null) });
  return { run, calls };
}

test('linksmosiospedutes: robots.txt first, listing pages, then one GET per animal page', async () => {
  const { calls, run } = await collect();
  assert.deepEqual(calls.slice(0, 3).map(c => c.url), [`${B}/robots.txt`, `${B}/lt/suniukai/`, `${B}/lt/kaciukai/`]);
  assert.deepEqual(calls.slice(3).map(c => c.url).sort(), run.animals.map(a => a.sourceUrl).sort());
  assert.ok(calls.every(c => c.method === 'GET'));
});

test('linksmosiospedutes: parses cards, unknown facts stay null', async () => {
  const { run } = await collect();
  assert.equal(run.state, 'complete');
  const byId = Object.fromEntries(run.animals.map(a => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), [
    'linksmosiospedutes:17636', 'linksmosiospedutes:17794', 'linksmosiospedutes:18179',
    'linksmosiospedutes:18180', 'linksmosiospedutes:18181', 'linksmosiospedutes:18204', 'linksmosiospedutes:18209',
  ]);
  const o = byId['linksmosiospedutes:18181'];
  assert.equal(o.name, 'Oronas');
  assert.equal(o.species, 'dog', 'from h1 "Šuniukai"');
  assert.equal(o.sourceUrl, `${B}/lt/suniukai/oronas-18181.html`);
  assert.deepEqual(o.photos, [`${B}/index.php?module=products&method=show_image&column=image&id=18181&w=220&h=220&t=crop`]);
  // From the detail page; "DYDIS: Nedidukas, 10 kg" is not a size word we map, no sex line, text not kept.
  assert.equal(o.age_text, '2018 10 14');
  assert.equal(o.vaccinated, true);
  assert.equal(o.chipped, true);
  assert.equal(o.neutered, true);
  for (const f of ['sex', 'size', 'bio_lt', 'sourceUpdatedAt']) assert.equal(o[f], null, f);
  // Detail pages missing in this fixture set (404) keep the list-card facts.
  assert.equal(byId['linksmosiospedutes:18180'].vaccinated, null);
  assert.equal(byId['linksmosiospedutes:17794'].name, 'Salsa', '"(VIDEO)" tag is not part of the name');
  assert.equal(byId['linksmosiospedutes:18179'].name, 'Šyra');
  const d = byId['linksmosiospedutes:18204'];
  assert.equal(d.name, 'Džoja');
  assert.equal(d.species, 'cat', 'from h1 "Kačiukai"');
  assert.deepEqual(run.skipped, []);
});

test('linksmosiospedutes: status comes from the site navigation label, with evidence', async () => {
  const { run } = await collect();
  for (const a of run.animals) {
    assert.equal(a.status, 'available');
    assert.equal(a.statusEvidence, a.species === 'dog' ? 'Šuniukai ieškantys namų' : 'Kačiukai ieškantys namų');
  }
  // Without the label the page does not say anything about status: unknown, no evidence.
  const noLabel = { ...routes, [`${B}/lt/suniukai/`]: { body: fx('suniukai.html').replace('Šuniukai ieškantys namų', 'Šuniukai') } };
  const r2 = (await collect(noLabel)).run;
  for (const a of r2.animals.filter(x => x.species === 'dog')) {
    assert.equal(a.status, 'unknown');
    assert.equal(a.statusEvidence, null);
  }
});

test('linksmosiospedutes: follows pagination links to the end (synthetic paging)', async () => {
  const paged = {
    ...routes,
    [`${B}/lt/kaciukai/`]: { body: fx('kaciukai-paged-1.html') },
    [`${B}/lt/kaciukai/?page=2`]: { body: fx('kaciukai-paged-2.html') },
  };
  const { run, calls } = await collect(paged);
  assert.equal(run.state, 'complete');
  assert.deepEqual(calls.map(c => c.url).filter(u => !u.endsWith(".html")), [`${B}/robots.txt`, `${B}/lt/suniukai/`, `${B}/lt/kaciukai/`, `${B}/lt/kaciukai/?page=2`]);
  assert.equal(run.animals.filter(a => a.species === 'cat').length, 3);
});

test('linksmosiospedutes: a failing page makes the run failed', async () => {
  const broken = { ...routes };
  delete broken[`${B}/lt/kaciukai/`];
  const { run } = await collect(broken);
  assert.equal(run.state, 'failed');
  assert.equal(run.animals.length, 0);
  const paged = { ...routes, [`${B}/lt/kaciukai/`]: { body: fx('kaciukai-paged-1.html') } }; // page 2 missing
  assert.equal((await collect(paged)).run.state, 'failed');
});

test('linksmosiospedutes: changed layout (no cards) fails instead of publishing empty', async () => {
  const gone = { ...routes, [`${B}/lt/kaciukai/`]: { body: '<html><body><h1 class="title">Kačiukai</h1></body></html>' } };
  assert.equal((await collect(gone)).run.state, 'failed');
});
