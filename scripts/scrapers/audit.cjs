'use strict';
// Per-animal audit: flags facts that an animal's own source text mentions while our record has
// the field empty, so nobody has to open each animal by hand. It only points at likely parser
// gaps; it never fills a field (the adapters and lib/labels.cjs do that, with tests).
// Usage: node scripts/scrapers/audit.cjs <scrapedDir> [maxExamples]
const fs = require('node:fs');
const path = require('node:path');

// Words that mean the text talks about the fact. Lithuanian stems, case-insensitive.
const MENTIONS = {
  sex: /\b(patinas|patinėlis|patelė|berniukas|mergaitė|kalytė|kalaitė|lytis)\b/i,
  // 1-2 digit figures only: "2025 m. vasario mėn." is an arrival date, not an age.
  age_text: /(gim(ė|us|usi|ęs|usios|imo)\s*[:–-]?\s*\d|amžius\s*[:–-]|(?<!\d)\d{1,2}(?:[.,]\d)?\s*(m\.|metų|metukų|mėn))/i,
  chipped: /(ženklint|zenklint|čipuot|čipas|mikros?chem)/i,
  vaccinated: /(skiep|vakcin)/i,
  neutered: /(kastr|steril)/i,
  size: /\b(dydis|dydžio|ūgio|ūgis)\b/i,
};

function auditAnimals(animals) {
  const gaps = Object.fromEntries(Object.keys(MENTIONS).map(k => [k, []]));
  const noBio = [];
  for (const a of animals) {
    const text = a.bio_lt || '';
    if (!text.trim()) { noBio.push(a); continue; }
    for (const [field, re] of Object.entries(MENTIONS)) if (a[field] == null && re.test(text)) gaps[field].push(a);
  }
  return { animals: animals.length, noBio, gaps };
}

function readRuns(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => path.join(dir, d.name, 'published.json')).filter(f => fs.existsSync(f))
    .map(f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return { source: path.basename(path.dirname(f)), animals: Array.isArray(j) ? j : j.animals ?? [] }; });
}

function report(runs, maxExamples = 3) {
  const fields = Object.keys(MENTIONS);
  const lines = [`| source | animals | no bio | ${fields.join(' | ')} |`, `|${'---|'.repeat(fields.length + 3)}`];
  const examples = [];
  for (const { source, animals } of runs) {
    const r = auditAnimals(animals);
    lines.push(`| ${source} | ${r.animals} | ${r.noBio.length} | ${fields.map(f => r.gaps[f].length).join(' | ')} |`);
    for (const f of fields) for (const a of r.gaps[f].slice(0, maxExamples)) examples.push(`${source} ${f}: ${a.name} ${a.sourceUrl}`);
  }
  return `Mentioned in the text but empty in our record (likely parser gaps):\n${lines.join('\n')}\n\nExamples:\n${examples.join('\n')}`;
}

module.exports = { MENTIONS, auditAnimals, readRuns, report };
if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error('Usage: node scripts/scrapers/audit.cjs <scrapedDir> [maxExamples]'); process.exit(2); }
  console.log(report(readRuns(dir), Number(process.argv[3] ?? 3)));
}
