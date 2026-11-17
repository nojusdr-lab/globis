'use strict';
// Turn published shelter-site snapshots into src/data/directPets.json (app format).
// Only published (complete, guarded) snapshots are used. A source with no new snapshot keeps its
// previous rows, so a failed run never wipes the last good copy. Unmapped sources are skipped.
// Usage: node scripts/scrapers/to-app-data.cjs <scrapedDir>
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '../../src/data');
// Adapter id -> shelters.json id, where it is not `${id}lt`. lese has two shelters (Kaunas,
// Vilnius) and beglobis has no shelter record yet: both skipped until mapped by a person.
const SHELTER = { gyvunugloba: 'gyvunuglobacom' };

function toAppPet(a, shelter) {
  return {
    id: a.id, url: a.sourceUrl, source: a.source, name: a.name, species: a.species ?? null,
    city: shelter.city ?? null, photos: a.photos ?? [], status: a.status ?? 'unknown',
    statusEvidence: a.statusEvidence ?? null, sex: a.sex ?? null, ageLt: a.age_text ?? null, ageEn: null,
    size: a.size ?? null, waitingDays: null,
    medical: { chipped: a.chipped ?? null, vaccinated: a.vaccinated ?? null, neutered: a.neutered ?? null },
    compatibilityTagsLt: [], compatibilityTagsEn: [], personalityTraitsLt: [], personalityTraitsEn: [],
    bioLt: a.bio_lt ?? null, bioEn: null, sourceUpdatedAt: a.sourceUpdatedAt ?? null,
    shelter: { id: shelter.id, name: shelter.name, city: shelter.city, address: shelter.address, url: shelter.url },
  };
}

function build(snapshots, shelters, previous) {
  const byId = new Map(shelters.map(s => [s.id, s]));
  const rows = new Map();
  for (const p of previous) rows.set(p.source, [...(rows.get(p.source) ?? []), p]);
  const report = [];
  for (const snap of snapshots) {
    const shelter = byId.get(SHELTER[snap.source] ?? `${snap.source}lt`);
    if (!shelter) { report.push({ source: snap.source, state: 'unmapped' }); continue; }
    // An unnamed card is not shown; the animal stays in the source snapshot.
    const named = snap.animals.filter(a => a.name?.trim());
    rows.set(snap.source, named.map(a => toAppPet(a, shelter)));
    report.push({ source: snap.source, state: 'ok', animals: named.length, unnamed: snap.animals.length - named.length });
  }
  return { pets: [...rows.values()].flat(), report };
}

function main() {
  const dir = path.resolve(process.argv[2] || 'data/scraped');
  const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const snapshots = fs.readdirSync(dir).map(d => path.join(dir, d, 'published.json')).filter(f => fs.existsSync(f)).map(read);
  const out = path.join(DATA, 'directPets.json');
  const { pets, report } = build(snapshots, read(path.join(DATA, 'shelters.json')), fs.existsSync(out) ? read(out) : []);
  fs.writeFileSync(out, JSON.stringify(pets, null, 1) + '\n');
  for (const r of report) console.log(JSON.stringify(r));
  console.log(`directPets ${pets.length}`);
}

module.exports = { build, toAppPet, SHELTER };
if (require.main === module) main();
