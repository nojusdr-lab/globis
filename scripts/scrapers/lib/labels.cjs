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

// A date keeps its label ("Spėjama gimimo data: 2025-10-01"): a bare date hides that it is a birth date or an estimate.
// Text after the date on the same line ("2020-03-01, svoris: 12 kg, …") is not the age; the story still holds it.
function ageText(label, value) {
  const date = value.match(/^(\d{4}(?:[-. ]\d{1,2}){0,2}|\d{1,2}\.\d{1,2}\.\d{4})(?=$|[,;])/);
  if (!date) return value;
  const l = N.cleanText(label).replace(/[:：]\s*$/, '');
  return /^amžius$/i.test(l) ? date[1] : `${l.charAt(0).toUpperCase()}${l.slice(1)}: ${date[1]}`;
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
    else if (field === 'age_text') out.age_text = ageText(label, value);
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
// Participle in any gender/number: -as, -a, -i, -os ("Skiepytos, ženklintos" about female pups).
const PROSE = {
  neutered: [/^(kastruot|sterilizuot)(as|a|i|os)$/, /^ne(kastruot|sterilizuot)(as|a|i|os)$/],
  vaccinated: [/^(pa)?(skiepyt|vakcinuot)(as|a|i|os)$/, /^ne(pa)?(skiepyt|vakcinuot)(as|a|i|os)$/],
  chipped: [/^(čipuot|(pa)?ženklint)(as|a|i|os)$/, /^ne(čipuot|(pa)?ženklint)(as|a|i|os)$/],
};
// Procedure nouns that, next to "laukia" (is waiting for), say the procedure is still to be done.
const PENDING = {
  neutered: /^(sterilizacij|kastracij)\p{L}*$/u,
  vaccinated: /^(skiep(ai|ų|as)|vakcinacij\p{L}*)$/u,
  chipped: /^(ženklinim\p{L}*|čipavim\p{L}*|mikročip\p{L}*)$/u,
};
// A sentence with one of these words talks about a plan or a condition, so its "yes" words are skipped.
const PLAN = /^(bus|bū\p{L}*|reikės|turės|planuojam\p{L}*|prieš|jei|jeigu|kai|galės)$/u;

// Animal-only words. "Berniukas"/"mergaitė" are left out: they may mean a child in the story.
const SEX_WORD = { patinas: 'male', patinėlis: 'male', patinukas: 'male', patelė: 'female', kalytė: 'female', kalaitė: 'female',
  katinas: 'male', katinukas: 'male', katytė: 'female' };
// Plurals never set a sex, but one of the other sex voids it ("katinas ir dvi katytės" = a litter).
const SEX_PLURAL = { patinai: 'male', katinai: 'male', katinukai: 'male', patelės: 'female', kalytės: 'female', katytės: 'female' };

const SINCE_DATE = '((?:\\d{4}\\s*(?:m\\.|metų)\\s*)?\\p{L}+\\s+mėn(?:\\.|esį)|\\d{4}[-.]\\d{2}(?:[-.]\\d{2})?|\\d{4}\\s*m\\.)';
// "Prieglaudoje nuo: 2026 m. birželio mėn.", "Į prieglaudą atvyko – 2025-07-29", "į mūsų globą atvyko 2026-04-01",
// "atvyko į prieglaudą 2025 metų balandžio mėnesį". Plain "atvyko <date>" without the shelter word is not used.
const IN_SHELTER = new RegExp(`(?:prieglaudoje\\s+nuo\\s*:?|(?:į\\s+(?:prieglaudą|mūsų\\s+globą)|pas\\s+mus)\\s+(?:\\p{L}+\\s+)?atvyko\\s*[:–-]?|atvyko\\s+į\\s+prieglaudą\\s*:?)\\s*${SINCE_DATE}`, 'giu');

const BIRTH = /((?:spėjama\s+)?gimimo\s+data(?:\s*\(spėjama\))?|gimęs|gimusi|gimė)\s*[:–-]?\s*(\d{4}(?:[-.\s]\d{2}){0,2})(?!\d)/giu;

const NUM_WORD = 'vienerių|dvejų|dviejų|trejų|trijų|keturių|penkių|šešių|septynių|aštuonių|devynių|dešimties|pusės|pusantrų|kelių';
// "4 m. amžiaus", "iki 3 metukų amžiaus", "~2018 m. gimimo", and without "amžiaus" only after "apie/iki":
// "Apie 6-7 metų", "Apie 4mėn.", "Apie 5 m." (an approximate figure is how shelters write an age).
const AGE = new RegExp(`(?:(?:apie|iki|virš|~)\\s*)?(?:\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+)?|${NUM_WORD})\\s*(?:m\\.|metų|metukų|mėn\\.?|mėnesių)\\s+amžiaus|~?\\s*\\d{4}\\s*m\\.\\s+gimimo|(?<!\\p{L})(?:apie|iki)\\s+(?:\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+)?|${NUM_WORD})\\s*(?:m\\.(?!\\s*\\p{L}+\\s+mėn)|metų|metukų|mėn\\.?|mėnesių)`, 'giu');

// Size only when the text says "<word> ūgio/dydžio" ("vidutinio ūgio šunelis"); "didelio šuns" alone may be another dog.
const SIZE = /(?<!\p{L})(mažo|nedidelio|vidutinio|didelio|stambaus)\s+(?:ūgio|dydžio)(?!\p{L})/giu;
const SIZE_OF = { mažo: 'small', nedidelio: 'small', vidutinio: 'medium', didelio: 'large', stambaus: 'large' };

function fromProse(text) {
  const out = {};
  // Emoji end a thought too: "…namuose bus meilūnas🤍 Kastruotas" is two sentences, not a plan.
  const sentences = N.fold(text).split(/[.!?\n]+|\p{Extended_Pictographic}+/u).map(s => s.split(/[^\p{L}]+/u).filter(Boolean));
  const words = sentences.flat();
  for (const [field, [yes, no]] of Object.entries(PROSE)) {
    const seen = new Set();
    for (const words of sentences) {
      const plan = words.some(w => PLAN.test(w));
      // "Dar laukia skiepai, ženklinimas, sterilizacija" / "Ateityje laukia kastracija": not done yet.
      if (words.includes('laukia') && words.some(w => PENDING[field].test(w))) seen.add(false);
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
    const figures = new Set([...String(text || '').matchAll(/(\d+(?:[.,]\d+)?)\s*(m\.|metų|metai|metukai|metukų|mėn)/giu)].map(m => m[1] + m[2][0]));
    if (ages.size === 1 && figures.size <= 1) out.age_text = [...ages][0];
  }
  // Sex only from a singular noun that names it ("nečipuota kalytė rasta", "didesnis patinas").
  // Plural or ambiguous forms ("dvi kalytės") are ignored; both sexes in one text -> unknown.
  const sexes = new Set(words.filter(w => SEX_WORD[w]).map(w => SEX_WORD[w]));
  const plural = new Set(words.filter(w => SEX_PLURAL[w]).map(w => SEX_PLURAL[w]));
  if (sexes.size === 1 && [...plural].every(x => sexes.has(x))) out.sex = [...sexes][0];
  // Time in the shelter as written after "Prieglaudoje nuo": "2026 m. birželio mėn.", "2025-03". One value only.
  const since = new Set([...String(text || '').matchAll(IN_SHELTER)].map(m => `nuo ${N.cleanText(m[1])}`));
  if (since.size === 1) out.in_shelter = [...since][0];
  // Two different sizes (mother and puppies) -> unknown.
  const sizes = new Set([...String(text || '').matchAll(SIZE)].map(m => SIZE_OF[m[1].toLowerCase()]));
  if (sizes.size === 1) out.size = [...sizes][0];
  return out;
}

module.exports = { fromPairs, pairsFromText, fieldFor, fromProse };
