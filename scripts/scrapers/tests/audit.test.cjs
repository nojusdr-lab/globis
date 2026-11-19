'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { auditAnimals } = require('../audit.cjs');

test('audit: flags facts the text mentions while the field is empty; filled fields and no-bio are separate', () => {
  const r = auditAnimals([
    { name: 'A', bio_lt: 'Patinas, gimęs 2020 m. Ženklintas, skiepytas, kastruotas.', sex: null, age_text: null, chipped: true, vaccinated: null, neutered: true, size: null },
    { name: 'B', bio_lt: 'Labai draugiška.', sex: null, age_text: null, chipped: null, vaccinated: null, neutered: null, size: null },
    { name: 'C', bio_lt: null },
  ]);
  assert.deepEqual(r.gaps.sex.map(a => a.name), ['A']);
  assert.deepEqual(r.gaps.age_text.map(a => a.name), ['A']);
  assert.deepEqual(r.gaps.vaccinated.map(a => a.name), ['A']);
  assert.deepEqual(r.gaps.chipped, []);
  assert.deepEqual(r.gaps.neutered, []);
  assert.deepEqual(r.noBio.map(a => a.name), ['C']);
});
