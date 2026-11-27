'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseGlobokPage, compare } = require('../../crosscheck/globok.cjs');

test('globok cross-check: facts grid and yes-badges of the page animal only', () => {
  const html = fs.readFileSync(path.join(__dirname, '../fixtures/globok/animal-soja.html'), 'utf8');
  assert.deepEqual(parseGlobokPage(html), { species: 'cat', sex: 'female', vaccinated: true });
});

test('globok cross-check: compares only facts both sides know', () => {
  const ours = { name: 'Soja', url: 'u', species: 'cat', sex: 'male', medical: { chipped: true, vaccinated: null, neutered: null } };
  assert.deepEqual(compare({ species: 'cat', sex: 'female', vaccinated: true }, ours), [{ field: 'sex', globok: 'female', ours: 'male' }]);
});
