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
