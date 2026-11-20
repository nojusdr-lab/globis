'use strict';
// Share of known (non-null) fields per source in the app data, as a Markdown table for the CI summary.
// Usage: node scripts/scrapers/completeness.cjs [src/data/directPets.json]
const FIELDS = {
  photo: p => p.photos?.length > 0, species: p => p.species != null, sex: p => p.sex != null,
  age: p => p.ageLt != null, size: p => p.size != null, chipped: p => p.medical?.chipped != null, vaccinated: p => p.medical?.vaccinated != null,
  neutered: p => p.medical?.neutered != null, bio: p => !!p.bioLt,
};

function completeness(pets) {
  const by = new Map();
  for (const p of pets) by.set(p.source, [...(by.get(p.source) ?? []), p]);
  return [...by].sort().map(([source, list]) => ({
    source, animals: list.length,
    ...Object.fromEntries(Object.entries(FIELDS).map(([k, has]) => [k, Math.round(100 * list.filter(has).length / list.length)])),
  }));
}

function table(rows) {
  const cols = ['source', 'animals', ...Object.keys(FIELDS)];
  return [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`,
    ...rows.map(r => `| ${cols.map(c => typeof r[c] === 'number' && c !== 'animals' ? `${r[c]}%` : r[c]).join(' | ')} |`)].join('\n');
}

module.exports = { completeness, table };
if (require.main === module) {
  const file = process.argv[2] || require('node:path').join(__dirname, '../../src/data/directPets.json');
  console.log(table(completeness(JSON.parse(require('node:fs').readFileSync(file, 'utf8')))));
}
