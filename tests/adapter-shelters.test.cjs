'use strict';
// Every enabled adapter must map to a shelter in shelters.json, or to-app-data drops its animals as "unmapped".
const test = require('node:test');
const assert = require('node:assert');
const adapters = require('../scripts/scrapers/adapters/index.cjs');
const shelters = require('../src/data/shelters.json');
const { BRANCHES, shelterResolver } = require('../src/data/appPet.cjs');

test('every enabled scraper source has a shelter entry', () => {
  const byId = new Map(shelters.map(s => [s.id, s]));
  const unmapped = adapters.map(a => a.id).filter(id => BRANCHES[id]
    ? Object.values(BRANCHES[id]).some(s => !byId.has(s))
    : !shelterResolver(id, byId)());
  assert.deepStrictEqual(unmapped, []);
});
