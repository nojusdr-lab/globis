'use strict';
// Turn published shelter-site snapshots into src/data/directPets.json (app format).
// Only published (complete, guarded) snapshots are used. A source with no new snapshot keeps its
// previous rows, so a failed run never wipes the last good copy. Unmapped sources are skipped.
// Usage: node scripts/scrapers/to-app-data.cjs <scrapedDir>
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '../../src/data');
const { SHELTER, BRANCHES, shelterResolver, toAppPet } = require('../../src/data/appPet.cjs');

function build(snapshots, shelters, previous) {
  const byId = new Map(shelters.map(s => [s.id, s]));
  const rows = new Map();
  for (const p of previous) rows.set(p.source, [...(rows.get(p.source) ?? []), p]);
  const report = [];
  for (const snap of snapshots) {
    const branches = BRANCHES[snap.source];
    const shelterOf = shelterResolver(snap.source, byId);
    if (!branches && !shelterOf()) { report.push({ source: snap.source, state: 'unmapped' }); continue; }
    // An unnamed card, or one whose branch is unknown, is not shown; it stays in the source snapshot.
    const named = snap.animals.filter(a => a.name?.trim() && shelterOf(a));
    rows.set(snap.source, named.map(a => toAppPet(a, shelterOf(a))));
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
