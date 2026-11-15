const test = require('node:test');
const assert = require('node:assert/strict');
const { listingId, statusFromText, phone, email, eligible, shelterPets, validateImport } = require('../src/data/integrity.cjs');
const { migrate } = require('../scripts/migrate-legacy-data.cjs');
const pets = require('../src/data/allPets.json');
const shelters = require('../src/data/shelters.json');

test('reserved evidence is explicit and exclusions apply only to discovery', () => {
  assert.equal(statusFromText('Ramus. REZERVUOTA.').status, 'reserved');
  assert.equal(statusFromText('Nerezervuotas.').status, 'unknown');
  assert.equal(statusFromText('Gali būti rezervuotas.').status, 'unknown');
  assert.equal(eligible({ status: 'reserved' }), false);
  const roster = shelterPets([{ shelter: { id: 'a' }, status: 'reserved' }, { shelter: { id: 'b' } }], 'a');
  assert.equal(roster.length, 1);
  assert.equal(roster[0].status, 'reserved');
});

test('IDs use the original slug and ignore tracking parameters', () => {
  assert.equal(listingId('https://globok.lt/gyvunai/mikis?ref=x'), 'globok:mikis');
  assert.throws(() => listingId('https://other.example/gyvunai/mikis'));
});

test('invalid contacts are omitted', () => {
  assert.equal(phone('+370 600 00000'), null);
  assert.equal(phone('+370 612 34567'), '+37061234567');
  assert.equal(email('x@example.org?body=bad'), null);
  assert.equal(email('x@example.org'), 'x@example.org');
});

test('migration removes untraceable facts and retains IDs and evidence', () => {
  const pet = { ...pets[0], id: 'pet-1', sex: 'Patinas', bioLt: 'REZERVUOTAS.', medical: { chipped: true, neutered: false } };
  const result = migrate([pet], shelters);
  assert.equal(result.listings[0].sex, null);
  assert.deepEqual(result.listings[0].medical, { chipped: null, vaccinated: null, neutered: null });
  assert.equal(result.listings[0].status, 'reserved');
  assert.equal(result.listings[0].fetchedAt, undefined);
  assert.deepEqual(result.mapping[0], { oldId: 'pet-1', url: pet.url, newId: listingId(pet.url) });
  assert.throws(() => migrate([pet, pet], shelters));
});

test('snapshot IDs and references are valid, partial or duplicate snapshots are rejected', () => {
  validateImport(pets, shelters, pets, shelters);
  assert.throws(() => validateImport(pets.slice(0, 20), shelters, pets, shelters));
  assert.throws(() => validateImport([...pets, pets[0]], shelters, pets, shelters));
  for (const row of [...pets.map(pet => pet.shelter), ...shelters]) {
    assert.equal(row.phone ?? null, phone(row.phone));
    assert.equal(row.email ?? null, email(row.email));
  }
});

test('re-running migration preserves the reviewed snapshot and reserved evidence', () => {
  const first = migrate(pets, shelters);
  const second = migrate(first.listings, first.organizations);
  assert.deepEqual(first.listings, pets);
  assert.deepEqual(first.organizations, shelters);
  assert.deepEqual(second.listings, first.listings);
  assert.deepEqual(second.organizations, first.organizations);
  assert.deepEqual(first.listings.filter(p => p.status === 'reserved'), pets.filter(p => p.status === 'reserved'));
});

test('snapshot validation rejects missing, blank and duplicate organization IDs', () => {
  for (const invalid of [{}, {id: ''}, {id: '   '}, null]) {
    assert.throws(() => validateImport(pets, [...shelters, invalid], pets, shelters));
  }
  assert.throws(() => validateImport(pets, [...shelters, shelters[0]], pets, shelters));
});
