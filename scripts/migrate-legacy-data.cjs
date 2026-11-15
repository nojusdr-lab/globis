const fs = require('node:fs');
const path = require('node:path');
const { listingId, statusFromText } = require('../src/data/integrity.cjs');

function migrate(pets, shelters) {
  const organizations = shelters.map(({ phone, email, website, descriptionLt, descriptionEn,
    totalCount, dogsCount, catsCount, count, ...shelter }) => ({
    ...shelter, source: 'globok', phone: null, email: null, website: null,
  }));
  const byId = new Map(organizations.map(org => [org.id, org]));
  const mapping = [];
  const seen = new Set();
  const listings = pets.map(pet => {
    const id = listingId(pet.url);
    const organization = byId.get(pet.shelter.id);
    if (seen.has(id) || !organization) throw new Error(`Duplicate URL or unknown shelter: ${pet.url}`);
    seen.add(id);
    mapping.push({ oldId: pet.id, url: pet.url, newId: id });
    const { name, city, address, url } = organization;
    return {
      id, slug: pet.slug, url: pet.url, source: 'globok', name: pet.name, species: pet.species,
      city, photos: pet.photos, ...statusFromText(pet.bioLt),
      sex: null, ageLt: null, ageEn: null, size: null, waitingDays: null,
      medical: { chipped: null, vaccinated: null, neutered: null },
      compatibilityTagsLt: [], compatibilityTagsEn: [], personalityTraitsLt: [], personalityTraitsEn: [],
      bioLt: null, bioEn: null,
      shelter: { id: organization.id, name, city, address, url, phone: null, email: null, website: null },
    };
  });
  return { listings, organizations, mapping };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const legacy = process.argv[2];
  if (!legacy) throw new Error('Pass a directory containing the legacy JSON files');
  const read = name => JSON.parse(fs.readFileSync(path.resolve(legacy, name), 'utf8'));
  const { listings, organizations, mapping } = migrate(read('allPets.json'), read('shelters.json'));
  for (const [file, rows] of [
    ['src/data/allPets.json', listings], ['src/data/shelters.json', organizations],
    ['docs/pr1-listing-id-map.json', mapping],
  ]) {
    fs.writeFileSync(path.join(root, file), JSON.stringify(rows, null, 2) + '\n');
  }
}

module.exports = { migrate };
