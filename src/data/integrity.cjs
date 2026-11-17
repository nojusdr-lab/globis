const origin = 'https://globok.lt';

function listingId(url) {
  const parsed = new URL(url);
  if (parsed.origin !== origin || parsed.username || parsed.password || !/^\/gyvunai\/[a-z0-9-]+\/?$/.test(parsed.pathname)) {
    throw new Error('Invalid Globok animal URL');
  }
  return 'globok:' + parsed.pathname.split('/')[2];
}

function statusFromText(text) {
  const evidence = text?.split(/[.!?\n]+/).map(line => line.trim()).find(
    line => /^(?:gyvūnas\s+|būsena:\s*)?rezervuot(?:as|a)$/iu.test(line)
  );
  return evidence ? { status: 'reserved', statusEvidence: evidence } :
    { status: 'unknown', statusEvidence: null };
}

function phone(value) {
  const clean = typeof value === 'string' ? value.replace(/[\s()-]/g, '') : '';
  return /^\+?\d{8,15}$/.test(clean) && !/^(?:\+?370|0|8)?60000000$/.test(clean) ? clean : null;
}

function email(value) {
  return typeof value === 'string' && /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(value) ? value : null;
}

// Use the same conservative origin check in Node and React Native. The stored
// website is a bare HTTPS origin; the evidence may point at a page on it.
function contactOrigin(value) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return null;
  const match = /^(https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}))(?=[/?#]|$)/i.exec(value);
  if (!match) return null;
  const host = match[2].toLowerCase();
  if (['globok.lt', 'facebook.com', 'fb.com', 'fb.me'].some(site => host === site || host.endsWith('.' + site))) {
    return null;
  }
  return match[1].toLowerCase();
}

function checkedDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function withOfficialContacts(shelter) {
  const { contactEvidence, ...record } = shelter;
  const website = contactOrigin(record.website);
  if (!website || website !== record.website || website !== contactOrigin(contactEvidence?.url) ||
      !checkedDate(contactEvidence?.checkedAt)) {
    return { ...record, phone: null, email: null, website: null };
  }
  return { ...record, contactEvidence, phone: phone(record.phone), email: email(record.email), website };
}

function joinListingShelters(pets, shelters) {
  const byId = new Map(shelters.map(shelter => [shelter.id, withOfficialContacts(shelter)]));
  return pets.map(pet => {
    const { id, name, city, address, url } = pet.shelter;
    return { ...pet, shelter: byId.get(id) ?? { id, name, city, address, url } };
  });
}

const inactiveStatuses = new Set(['reserved', 'unavailable', 'stale', 'adopted', 'no_longer_listed', 'confirmed_adopted']);

function eligible(pet) {
  return !inactiveStatuses.has(pet.status);
}

function shelterPets(pets, id) {
  return pets.filter(pet => pet.shelter.id === id);
}

// Direct shelter-site rows replace Globok rows for the shelters they cover (same animals, primary source).
function mergeDirect(globokPets, directPets) {
  const covered = new Set(directPets.map(pet => pet.shelter.id));
  return [...globokPets.filter(pet => !covered.has(pet.shelter.id)), ...directPets];
}

function validateImport(pets, shelters, previousPets, previousShelters) {
  for (const [rows, previous] of [[pets, previousPets], [shelters, previousShelters]]) {
    if (!Array.isArray(rows) || !Array.isArray(previous) ||
        rows.some(row => !row || typeof row.id !== 'string' || !row.id.trim())) {
      throw new Error('Missing or invalid snapshot IDs');
    }
    const ids = new Set(rows.map(row => row.id));
    const priorIds = previous.map(row => row.id);
    if (!rows.length || ids.size !== rows.length ||
        rows.length < previous.length * 0.95 ||
        priorIds.filter(id => ids.has(id)).length < previous.length * 0.95) {
      throw new Error('Incomplete or suspicious import. Previous snapshot preserved.');
    }
  }
  const shelterIds = new Set(shelters.map(shelter => shelter.id));
  if (pets.some(pet => pet.id !== listingId(pet.url) || !shelterIds.has(pet.shelter.id))) {
    throw new Error('Invalid listing ID or unmapped shelter');
  }
}

module.exports = { listingId, statusFromText, phone, email, withOfficialContacts, joinListingShelters, eligible, shelterPets, mergeDirect, validateImport };
