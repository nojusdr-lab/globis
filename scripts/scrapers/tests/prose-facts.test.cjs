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

test('fromProse: birth date written in the story, kept as written', () => {
  // Real phrasings from keturkojo-viltis.lt (2026-11-18).
  assert.equal(fromProse('🤍 📅 Gimimo data: 2019-03-01 🏡 Į prieglaudą atvyko: 2020-05-02').age_text, 'Gimimo data: 2019-03-01');
  assert.equal(fromProse('🎂 Gimimo data (spėjama): 2025-08-01 🏡').age_text, 'Gimimo data (spėjama): 2025-08-01');
  assert.equal(fromProse('Spėjama gimimo data – 2016-03-24, ūgis ties ketera 45 cm').age_text, 'Spėjama gimimo data: 2016-03-24');
  assert.equal(fromProse('Į prieglaudą atvyko 2026 metų liepos mėnesį.').age_text, undefined, 'arrival year is not a birth date');
  assert.equal(fromProse('Mama gimusi 2019, mažylis gimęs 2026-05.').age_text, undefined, 'two animals, two dates');
});

test('fromProse: birth date without a colon keeps the date whole', () => {
  assert.equal(fromProse('✅ Spėjama gimimo data 2017-04-30, sveria 10.6 kg').age_text, 'Spėjama gimimo data: 2017-04-30');
});
