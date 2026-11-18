'use strict';
// Double check of our shelter scrapers against the globok.lt snapshot already in the repo
// (src/data/allPets.json). Nothing is fetched and nothing reaches the app: this only reports
// where the two sources disagree, so a broken adapter shows up. Same shelter + same name
// (unique on both sides) = same animal. A fact is compared only when both sides know it.
const N = require('../scrapers/lib/normalize.cjs');
const L = require('../scrapers/lib/labels.cjs');

const norm = s => String(s || '').toLocaleLowerCase('lt').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const FACTS = {
  species: p => p.species, sex: p => p.sex, size: p => p.size,
  chipped: p => p.medical?.chipped, vaccinated: p => p.medical?.vaccinated, neutered: p => p.medical?.neutered,
};

// One globok.lt animal page: the first facts grid ("Rūšis"/"Lytis" pairs) and the badge row right after it.
// Later badges belong to other animals' cards. A badge only says "yes"; no badge = unknown.
function parseGlobokPage(html) {
  const grid = html.indexOf('<div class="grid grid-cols-2 gap-3 mb-6">');
  if (grid < 0) return {};
  const end = html.indexOf('</section>', grid);
  const block = html.slice(grid, end < 0 ? undefined : end);
  const text = s => s.replace(/<[^>]+>/g, '').trim();
  const pairs = [...block.matchAll(/<p class="text-xs[^"]*">([\s\S]*?)<\/p>\s*<p class="font-medium[^"]*">([\s\S]*?)<\/p>/g)].map(m => [text(m[1]), text(m[2])]);
  const out = {};
  for (const [k, v] of Object.entries(L.fromPairs(pairs))) if (v != null && k in FACTS) out[k] = v;
  if (out.species === undefined) { const sp = pairs.find(([k]) => /^rūšis$/i.test(k)); if (sp && N.species(sp[1])) out.species = N.species(sp[1]); }
  const row = block.match(/<div class="flex flex-wrap gap-2 mb-6">([\s\S]*?)<\/div>/);
  for (const m of (row ? row[1] : '').matchAll(/<span class="badge-pop[^"]*">([\s\S]*?)<\/span>/g)) {
    const b = N.fold(text(m[1]));
    if (/^vakcinuot|^skiepyt/.test(b)) out.vaccinated = true;
    else if (/^(kastr|steril)/.test(b)) out.neutered = true;
    else if (/^(čipuot|paženklint|ženklint)/.test(b)) out.chipped = true;
  }
  return out;
}

// Facts that both sides know and that differ.
function compare(globokFacts, ours) {
  const diffs = [];
  for (const [f, get] of Object.entries(FACTS)) {
    const a = globokFacts[f], b = get(ours);
    if (a != null && b != null && a !== b) diffs.push({ field: f, globok: a, ours: b });
  }
  return diffs;
}

function crosscheck(globok, direct) {
  const key = p => `${p.shelter?.id}|${norm(p.name)}`;
  const index = rows => { const m = new Map(); for (const p of rows) { const k = key(p); m.set(k, m.has(k) ? null : p); } return m; };
  const shelters = new Set(direct.map(p => p.shelter?.id));
  const g = index(globok.filter(p => shelters.has(p.shelter?.id))), d = index(direct);
  const out = {};
  for (const sh of shelters) out[sh] = { matched: 0, pairs: [], onlyGlobok: [], mismatches: [] };
  for (const [k, gp] of g) {
    if (!gp) continue;
    const sh = gp.shelter.id, dp = d.get(k);
    if (dp === undefined) { out[sh].onlyGlobok.push(gp.name); continue; }
    if (!dp) continue; // name not unique on our side
    out[sh].matched++;
    out[sh].pairs.push([gp, dp]);
  }
  return out;
}

// Usage: node scripts/crosscheck/globok.cjs [perShelter=5]
// Reads up to perShelter matched animals per shelter from globok.lt (robots.txt allows /gyvunai/, 5 s apart).
async function main(perShelter = 5) {
  const { createFetcher } = require('../scrapers/lib/polite-fetch.cjs');
  const globok = require('../../src/data/allPets.json'), direct = require('../../src/data/directPets.json');
  const out = crosscheck(globok, direct);
  const fetcher = createFetcher({ allowedHosts: ['globok.lt'] });
  const lines = [];
  for (const [sh, r] of Object.entries(out)) {
    const sample = r.pairs.slice(0, perShelter);
    let checked = 0;
    for (const [gp, dp] of sample) {
      let facts;
      try { facts = parseGlobokPage((await fetcher.get(gp.url)).body); } catch (e) { lines.push(`- ${sh} ${dp.name}: globok puslapis neperskaitytas (${e.message})`); continue; }
      checked++;
      for (const d of compare(facts, dp)) { r.mismatches.push(d); lines.push(`- ${sh} ${dp.name}: ${d.field} globok=${d.globok} mūsų=${d.ours} ${dp.url}`); }
    }
    r.checked = checked;
  }
  console.log('| prieglauda | sutapo pagal vardą | patikrinta | nesutampa | tik globok |\n|---|---|---|---|---|');
  for (const [sh, r] of Object.entries(out)) console.log(`| ${sh} | ${r.matched} | ${r.checked} | ${r.mismatches.length} | ${r.onlyGlobok.length} |`);
  console.log(lines.join('\n'));
}

if (require.main === module) main(Number(process.argv[2]) || 5).catch(e => { console.error(e); process.exit(1); });
module.exports = { crosscheck, norm, parseGlobokPage, compare };
