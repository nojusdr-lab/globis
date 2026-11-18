'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fromProse } = require('../lib/labels.cjs');
const { makeAnimal } = require('../lib/record.cjs');

test('fromProse: stated health facts from free text', () => {
  assert.deepEqual(fromProse('Karadajus kastruotas, čipuotas, paskiepytas pagal amžių.'), { neutered: true, vaccinated: true, chipped: true });
  assert.deepEqual(fromProse('Kalytė dar nesterilizuota, bet ženklinta.'), { neutered: false, chipped: true });
});

test('fromProse: plans, conflicts and unrelated words stay unknown', () => {
  assert.deepEqual(fromProse('Prieš išvykdama bus sterilizuota ir paskiepyta.'), {});
  assert.deepEqual(fromProse('Mama sterilizuota, kačiukai dar nesterilizuoti.'), {});
  assert.deepEqual(fromProse('Sterilizacijos kaina 50 eur. Skiepai kainuoja.'), {});
  assert.deepEqual(fromProse(null), {});
});

test('makeAnimal: labelled value wins over description text', () => {
  const a = makeAnimal('s', { nativeId: '1', sourceUrl: 'https://a.lt/1', name: 'Rex', neutered: false, bio_lt: 'Rex kastruotas ir čipuotas.' });
  assert.equal(a.neutered, false);
  assert.equal(a.chipped, true);
  assert.equal(a.vaccinated, null);
});
