'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../to-app-data.cjs');
const { mergeDirect, eligible } = require('../../../src/data/integrity.cjs');

const shelters = [{ id: 'kggnlt', name: 'KGGN', city: 'Kaunas', address: 'A', url: 'u' }];
const animal = { id: 'kggn:1', source: 'kggn', sourceUrl: 'https://kggn.lt/x/', name: 'Kovas', species: 'dog',
  sex: null, age_text: null, photos: [], status: 'available', statusEvidence: 'Dovanojamas' };

test('maps a published snapshot to app rows, unknown stays null', () => {
  const { pets, report } = build([{ source: 'kggn', animals: [animal] }], shelters, []);
  assert.equal(pets.length, 1);
  assert.equal(pets[0].shelter.id, 'kggnlt');
  assert.equal(pets[0].url, 'https://kggn.lt/x/');
  assert.equal(pets[0].sex, null);
  assert.deepEqual(report, [{ source: 'kggn', state: 'ok', animals: 1, unnamed: 0 }]);
});

test('unnamed animals are not shown', () => {
  assert.equal(build([{ source: 'kggn', animals: [{ ...animal, name: ' ' }] }], shelters, []).pets.length, 0);
});

test('unmapped source is skipped, nothing invented', () => {
  const { pets, report } = build([{ source: 'beglobis', animals: [{ ...animal, source: 'beglobis' }] }], shelters, []);
  assert.equal(pets.length, 0);
  assert.equal(report[0].state, 'unmapped');
});

test('lese: each animal joins its branch; unknown branch is not shown', () => {
  const both = [...shelters, { id: 'leseltvilnius', city: 'Vilnius' }, { id: 'leseltkaunas', city: 'Kaunas' }];
  const lese = h => ({ ...animal, id: `lese:${h}`, source: 'lese', shelterHint: h });
  const { pets } = build([{ source: 'lese', animals: [lese('vilnius'), lese('kaunas'), lese(null)] }], both, []);
  assert.deepEqual(pets.map(p => [p.id, p.shelter.id, p.city]),
    [['lese:vilnius', 'leseltvilnius', 'Vilnius'], ['lese:kaunas', 'leseltkaunas', 'Kaunas']]);
});

test('source missing from this run keeps its previous rows', () => {
  const prev = build([{ source: 'kggn', animals: [animal] }], shelters, []).pets;
  assert.deepEqual(build([], shelters, prev).pets, prev);
});

test('direct rows replace Globok rows of the same shelter only', () => {
  const direct = build([{ source: 'kggn', animals: [animal] }], shelters, []).pets;
  const globok = [{ id: 'globok:a', shelter: { id: 'kggnlt' } }, { id: 'globok:b', shelter: { id: 'mgmalt' } }];
  assert.deepEqual(mergeDirect(globok, direct).map(p => p.id), ['globok:b', 'kggn:1']);
  assert.ok(eligible(direct[0]));
});
