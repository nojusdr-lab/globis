'use strict';
// Reads "Label: value" pairs that shelters write on animal pages (regex, not AI:
// the labels are fixed Lithuanian words, so plain rules are cheaper and testable).
const N = require('./normalize.cjs');

const LABELS = [
  ['species', /^(gyvūnas|rūšis)$/],
  ['sex', /^lytis$/],
  ['age_text', /^(amžius|gimimo data|spėjama gimimo data|gimęs|gimusi|gimė)$/],
  ['size', /^(dydis|ūgis|ūgio kategorija|dydžio kategorija)$/],
  ['vaccinated', /^(skiepai|skiepytas|skiepyta|vakcinuotas|vakcinuota|vakcinacija|skiepų informacija)$/],
  ['neutered', /^(sterilizuotas|sterilizuota|sterilizacija|kastracija|kastruotas|kastruota|sterilizacija\/kastracija|atlikta sterilizacija|sterilizuotas\/kastruotas)$/],
  ['chipped', /^(čipas|čipuotas|čipuota|mikroschema|ženklinimas|paženklintas|paženklinta|(pa)?ženklint(as|a) mikro(s)?chema)$/],
  ['status', /^(statusas|būsena|būklė)$/],
];

function fieldFor(label) {
  const l = N.fold(label).replace(/[:：]\s*$/, '');
  for (const [field, re] of LABELS) if (re.test(l)) return field;
  return null;
}

// pairs: array of [label, value] already split by an adapter (from a table, dl, or "A: B" lines).
function fromPairs(pairs) {
  const out = {};
  for (const [label, rawValue] of pairs) {
    const field = fieldFor(label);
    const value = N.cleanText(rawValue);
    if (!field || !value || field in out) continue;
    if (field === 'species') out.species = N.species(value);
    else if (field === 'sex') out.sex = N.sex(value);
    else if (field === 'size') out.size = N.size(value);
    else if (field === 'age_text') out.age_text = value;
    else if (field === 'status') { const s = N.status(value); out.status = s.status; out.statusEvidence = s.statusEvidence; }
    else out[field] = N.yesNo(value);
  }
  return out;
}

// Splits plain text lines like "Lytis: patinas".
function pairsFromText(text) {
  return String(text || '').split(/\n|<br\b[^>]*>|<\/p>|<\/li>/i)
    .map(line => N.cleanText(line))
    .filter(Boolean)
    .map(line => line.match(/^([^:：]{2,40})[:：]\s*(.+)$/))
    .filter(Boolean)
    .map(m => [m[1], m[2]]);
}

// Health facts stated in free text ("Kastruotas, čipuotas, paskiepytas."). Only whole words that
// say the thing is done or not done ("not yet done" counts as no).
// Both a yes and a no in one text (a mother and her kittens) -> null.
const PROSE = {
  neutered: [/^(kastruotas|kastruota|kastruoti|sterilizuotas|sterilizuota|sterilizuoti)$/, /^(nekastruotas|nekastruota|nekastruoti|nesterilizuotas|nesterilizuota|nesterilizuoti)$/],
  vaccinated: [/^(paskiepytas|paskiepyta|paskiepyti|skiepytas|skiepyta|skiepyti|vakcinuotas|vakcinuota|vakcinuoti)$/, /^(nepaskiepytas|nepaskiepyta|neskiepytas|neskiepyta|neskiepyti|nevakcinuotas|nevakcinuota)$/],
  chipped: [/^(čipuotas|čipuota|čipuoti|ženklintas|ženklinta|ženklinti|paženklintas|paženklinta|paženklinti)$/, /^(nečipuotas|nečipuota|neženklintas|neženklinta|nepaženklintas|nepaženklinta)$/],
};
// A sentence with one of these words talks about a plan or a condition, so its "yes" words are skipped.
const PLAN = /^(bus|bū\p{L}*|reikės|turės|planuojam\p{L}*|prieš|jei|jeigu|kai|galės)$/u;

const BIRTH = /((?:spėjama\s+)?gimimo\s+data(?:\s*\(spėjama\))?|gimęs|gimusi|gimė)\s*[:–-]?\s*(\d{4}(?:[-.\s]\d{2}){0,2})(?!\d)/giu;

const NUM_WORD = 'vienerių|dvejų|dviejų|trejų|trijų|keturių|penkių|šešių|septynių|aštuonių|devynių|dešimties|pusės|pusantrų|kelių';
const AGE = new RegExp(`(?:(?:apie|iki|virš|~)\\s*)?(?:\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+)?|${NUM_WORD})\\s*(?:m\\.|metų|mėn\\.?|mėnesių)\\s+amžiaus|~?\\s*\\d{4}\\s*m\\.\\s+gimimo`, 'giu');

function fromProse(text) {
  const out = {};
  const sentences = N.fold(text).split(/[.!?\n]+/).map(s => s.split(/[^\p{L}]+/u).filter(Boolean));
  for (const [field, [yes, no]] of Object.entries(PROSE)) {
    const seen = new Set();
    for (const words of sentences) {
      const plan = words.some(w => PLAN.test(w));
      for (const w of words) {
        if (no.test(w)) seen.add(false);
        else if (yes.test(w) && !plan) seen.add(true);
      }
    }
    if (seen.size === 1) out[field] = [...seen][0];
  }
  // Birth date written in the story: "Gimimo data (spėjama): 2012-01-01", "Spėjama gimimo data – 2023-10-01",
  // "Gimęs 2021-05". Label and date kept as written, joined with ": ". Two different dates (several animals in one text) -> unknown.
  const births = new Map();
  for (const m of String(text || '').matchAll(BIRTH)) births.set(m[2].replace(/[.\s]/g, '-'), `${N.cleanText(m[1]).replace(/^./u, c => c.toUpperCase())}: ${m[2]}`);
  if (births.size === 1) out.age_text = [...births.values()][0];
  // Otherwise an age phrase: "4 m. amžiaus", "Apie dešimties metų amžiaus", "~2018 m. gimimo". Kept as written.
  if (!out.age_text) {
    const ages = new Set([...String(text || '').matchAll(AGE)].map(m => N.cleanText(m[0]).replace(/^./u, c => c.toUpperCase())));
    // Any other age figure in the text ("Dina (apie 4 m.) ir dukrytės (apie 2 mėn. amžiaus)") = several animals.
    const figures = new Set([...String(text || '').matchAll(/(\d+(?:[.,]\d+)?)\s*(m\.|metų|metai|metukai|mėn)/giu)].map(m => m[1] + m[2][0]));
    if (ages.size === 1 && figures.size <= 1) out.age_text = [...ages][0];
  }
  return out;
}

module.exports = { fromPairs, pairsFromText, fieldFor, fromProse };
