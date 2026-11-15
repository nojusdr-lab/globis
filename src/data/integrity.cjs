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

function eligible(pet) {
  return pet.status !== 'reserved' && pet.status !== 'unavailable' && pet.status !== 'stale';
}

function shelterPets(pets, id) {
  return pets.filter(pet => pet.shelter.id === id);
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

module.exports = { listingId, statusFromText, phone, email, eligible, shelterPets, validateImport };
