'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fromRemote } = require('../src/data/appPet.cjs');

const shelters = [
  { id: 'naminukailt', name: 'Naminukai', city: 'Vilnius' },
  { id: 'leseltvilnius', name: 'Lesė Vilnius', city: 'Vilnius' },
  { id: 'leseltkaunas', name: 'Lesė Kaunas', city: 'Kaunas' },
];
const row = (o) => ({ animal_id: 'x', source: 'naminukai', source_url: 'https://n/1', name: 'Rex', species: 'dog',
  photos: [], status: 'available', status_evidence: null, shelter_hint: null, chipped: null, ...o });

test('fromRemote: server rows replace bundled rows of covered sources only', () => {
  const bundled = [{ id: 'old', source: 'naminukai' }, { id: 'keep', source: 'other' }];
  const pets = fromRemote([row({ animal_id: 'naminukai:1' })], shelters, bundled);
  assert.deepEqual(pets.map(p => p.id), ['keep', 'naminukai:1']);
  assert.equal(pets[1].url, 'https://n/1');
  assert.equal(pets[1].shelter.id, 'naminukailt');
  assert.equal(pets[1].medical.chipped, null); // unknown stays unknown
});

test('fromRemote: Lesė branch from shelter_hint; unknown branch and unmapped source are not shown', () => {
  const pets = fromRemote([
    row({ animal_id: 'lese:1', source: 'lese', shelter_hint: 'kaunas' }),
    row({ animal_id: 'lese:2', source: 'lese', shelter_hint: null }),
    row({ animal_id: 'beglobis:1', source: 'beglobis' }),
    row({ animal_id: 'naminukai:2', name: '  ' }),
  ], shelters, []);
  assert.deepEqual(pets.map(p => [p.id, p.shelter.id]), [['lese:1', 'leseltkaunas']]);
});

test('fetchPublishedRows: a server page cap below the limit does not truncate; failures throw', async () => {
  const { fetchPublishedRows } = require('../src/data/appPet.cjs');
  const all = Array.from({ length: 5 }, (_, i) => ({ animal_id: `x:${i}` }));
  const urls = [];
  const capped = async u => { // server returns at most 2 rows per request
    urls.push(u);
    const off = Number(new URL(u).searchParams.get('offset'));
    return { ok: true, json: async () => all.slice(off, off + 2) };
  };
  const rows = await fetchPublishedRows('https://db.example', 'k', capped, 1000);
  assert.deepEqual(rows.map(r => r.animal_id), all.map(r => r.animal_id));
  assert.equal(urls.length, 4);
  const failing = async u => (u.includes('offset=2') ? { ok: false, status: 503 } : capped(u));
  await assert.rejects(fetchPublishedRows('https://db.example', 'k', failing), /503/);
});

test('withoutBlocked: Maži jausmai rows are hidden from server and globok.lt copies', () => {
  const { withoutBlocked } = require('../src/data/appPet.cjs');
  const pets = [
    { id: 'mazijausmai:1', source: 'mazijausmai', shelter: { id: 'mazijausmailt' } },
    { id: 'globok:x', source: 'globok', shelter: { id: 'mazijausmailt' } },
    { id: 'kggn:1', source: 'kggn', shelter: { id: 'kggnlt' } },
  ];
  assert.deepEqual(withoutBlocked(pets).map(p => p.id), ['kggn:1']);
});
