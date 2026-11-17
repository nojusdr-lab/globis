const test = require('node:test');
const assert = require('node:assert/strict');
const { listingId, statusFromText, phone, email, withOfficialContacts, joinListingShelters, eligible, shelterPets, validateImport } = require('../src/data/integrity.cjs');
const { migrate } = require('../scripts/migrate-legacy-data.cjs');
const pets = require('../src/data/allPets.json');
const shelters = require('../src/data/shelters.json');

test('reserved evidence is explicit and exclusions apply only to discovery', () => {
  assert.equal(statusFromText('Ramus. REZERVUOTA.').status, 'reserved');
  assert.equal(statusFromText('Nerezervuotas.').status, 'unknown');
  assert.equal(statusFromText('Gali būti rezervuotas.').status, 'unknown');
  for (const status of ['reserved', 'unavailable', 'stale', 'adopted', 'no_longer_listed', 'confirmed_adopted']) {
    assert.equal(eligible({ status }), false, status);
  }
  assert.equal(eligible({ status: 'unknown' }), true);
  assert.equal(eligible({ status: 'available' }), true);
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

test('contacts are stored only with evidence from the shelter\'s own site', () => {
  const withContacts = shelters.filter(row => row.phone || row.email || row.website);
  assert.ok(withContacts.length > 0);
  for (const row of withContacts) {
    assert.match(row.contactEvidence?.checkedAt ?? '', /^\d{4}-\d{2}-\d{2}$/, row.id);
    const evidence = new URL(row.contactEvidence.url);
    assert.equal(evidence.protocol, 'https:');
    assert.equal(evidence.origin, row.website, row.id);
    assert.doesNotMatch(evidence.hostname, /globok|facebook/);
  }
  const stripped = migrate([], [{ ...shelters[0], phone: '+37061234567', contactEvidence: undefined }]);
  assert.equal(stripped.organizations[0].phone, null);
});

test('malformed contact evidence cannot activate call and email links', () => {
  const official = { id: 'shelter', website: 'https://shelter.example', phone: '+37061234567',
    email: 'help@shelter.example', contactEvidence: { url: 'https://shelter.example/contacts', checkedAt: '2026-11-17' } };
  assert.deepEqual(withOfficialContacts(official), official);
  for (const contactEvidence of [
    {},
    { ...official.contactEvidence, checkedAt: '2026-02-30' },
    { ...official.contactEvidence, url: 'https://shelter.example.other.test/contacts' },
    { ...official.contactEvidence, url: 'https://shelter.example@other.test/contacts' },
    { ...official.contactEvidence, url: 'http://shelter.example/contacts' },
    { ...official.contactEvidence, url: 'https://shelter.example:8443/contacts' },
  ]) {
    const [listing] = joinListingShelters([{ shelter: official }], [{ ...official, contactEvidence }]);
    assert.equal(listing.shelter.contactEvidence, undefined);
    assert.equal(listing.shelter.phone, null);
    assert.equal(listing.shelter.email, null);
    assert.equal(listing.shelter.website, null);
  }
  const [orphan] = joinListingShelters([{ shelter: { ...official, name: 'Shelter' } }], []);
  assert.equal(orphan.shelter.name, 'Shelter');
  assert.equal(orphan.shelter.phone, undefined);
  assert.equal(orphan.shelter.contactEvidence, undefined);
  const proxy = { ...official, website: 'https://www.facebook.com',
    contactEvidence: { ...official.contactEvidence, url: 'https://www.facebook.com/shelter' } };
  assert.equal(migrate([], [proxy]).organizations[0].email, null);
});
