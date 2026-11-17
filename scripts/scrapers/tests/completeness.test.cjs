'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { completeness, table } = require('../completeness.cjs');

test('completeness: percent of known fields per source; unknown is not counted as known', () => {
  const rows = completeness([
    { source: 'a', photos: ['x'], species: 'dog', sex: null, medical: { vaccinated: false } },
    { source: 'a', photos: [], species: null, sex: 'male', medical: {} },
    { source: 'b', photos: ['y'] },
  ]);
  assert.deepEqual(rows.map(r => [r.source, r.animals, r.photo, r.sex, r.vaccinated]), [['a', 2, 50, 50, 50], ['b', 1, 100, 0, 0]]);
  assert.match(table(rows), /^\| source \| animals \| photo/);
});
