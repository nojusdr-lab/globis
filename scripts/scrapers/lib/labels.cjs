'use strict';
// Reads "Label: value" pairs that shelters write on animal pages (regex, not AI:
// the labels are fixed Lithuanian words, so plain rules are cheaper and testable).
const N = require('./normalize.cjs');

const LABELS = [
  ['species', /^(gyvūnas|rūšis)$/],
  ['sex', /^lytis$/],
  ['age_text', /^(amžius|gimimo data|gimęs|gimusi|gimė)$/],
  ['size', /^(dydis|ūgis)$/],
  ['vaccinated', /^(skiepai|skiepytas|skiepyta|vakcinuotas|vakcinuota|vakcinacija)$/],
  ['neutered', /^(sterilizuotas|sterilizuota|sterilizacija|kastracija|kastruotas|kastruota|sterilizacija\/kastracija|atlikta sterilizacija|sterilizuotas\/kastruotas)$/],
  ['chipped', /^(čipas|čipuotas|čipuota|mikroschema|ženklinimas|paženklintas|paženklinta)$/],
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
  return String(text || '').split(/\n|<br\s*\/?>|<\/p>|<\/li>/i)
    .map(line => N.cleanText(line))
    .filter(Boolean)
    .map(line => line.match(/^([^:：]{2,40})[:：]\s*(.+)$/))
    .filter(Boolean)
    .map(m => [m[1], m[2]]);
}

module.exports = { fromPairs, pairsFromText, fieldFor };
