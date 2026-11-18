'use strict';
// Turns Lithuanian labels from shelter pages into schema values.
// Rule: if the page does not say it clearly, the answer is null (unknown). Never guess.

const fold = s => String(s ?? '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

const NAMED = { nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>', apos: "'", ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', scaron: 'š', Scaron: 'Š' };
// One pass, so "&amp;#8230;" stays literal text instead of being decoded twice.
function decodeEntities(text) {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]+));/g, (m, dec, hex, name) => {
    if (name) return Object.hasOwn(NAMED, name) ? NAMED[name] : m;
    const cp = dec ? Number(dec) : parseInt(hex, 16);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
  });
}

function cleanText(value) {
  if (value == null) return null;
  const text = decodeEntities(String(value).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').trim();
  return text || null;
}

function species(value) {
  const v = fold(value);
  if (!v) return null;
  if (/^(šuo|šunys|šuniukai|šuniukas|šuo\b|šunelis|šuneliai|dog|dogs)/.test(v)) return 'dog';
  if (/^(katė|katės|kačiukai|kačiukas|katinas|katinėliai|katinai|katytė|cat|cats)/.test(v)) return 'cat';
  if (/^(kita|kiti|kiti gyvūnai|graužikas|paukštis|roplys|šeškas|triušis)/.test(v)) return 'other';
  return null;
}

function sex(value) {
  const v = fold(value);
  if (/^(patinas|patinėlis|berniukas|katinas|male)$/.test(v)) return 'male';
  if (/^(patelė|patele|patytė|mergaitė|female)$/.test(v)) return 'female';
  return null;
}

function size(value) {
  // "Mažas (iki 30cm ties ketera)": the size word is what comes before a bracket or comma.
  const v = fold(value).split(/\s*[(,]/)[0];
  if (/^(mažas|maža|mažo dydžio|small)$/.test(v)) return 'small';
  if (/^(vidutinis|vidutinė|vidutinio dydžio|medium)$/.test(v)) return 'medium';
  if (/^(didelis|didelė|didelio dydžio|large)$/.test(v)) return 'large';
  return null;
}

function yesNo(value) {
  const v = fold(value);
  if (/^(taip|yra|atlikta|atliktas|skiepytas|skiepyta|paskiepytas|paskiepyta|sterilizuotas|sterilizuota|kastruotas|kastruota|čipuotas|čipuota|paženklintas|paženklinta|ženklintas|ženklinta|vakcinuotas|vakcinuota)$/.test(v)) return true;
  if (/^(ne|nėra|neatlikta|neatliktas|neskiepytas|neskiepyta|nesterilizuotas|nesterilizuota|nekastruotas|nekastruota|nevakcinuotas|nevakcinuota)$/.test(v)) return false;
  return null;
}

// Status words as Lithuanian shelters write them. Evidence is the exact text seen.
const STATUS_RULES = [
  { status: 'reserved', re: /^(rezervuot(as|a|i|os)|rezervacija)([\s.,!;:]|$)/ },
  { status: 'confirmed_adopted', re: /^(padovanot(as|a|i|os)(\(-as\))?|rado namus|radę namus|rade namus|įvaikint(as|a|i|os))([\s.,!;:]|$)/ },
  // Not adoptable and not an adoption either (returned to owner, lost/found, died). Adapters drop these.
  { status: 'excluded', re: /^(grįžo namo|mir(ė|us|ęs)|liks atmintyje|ding(o|us|ęs)|rast(a|as)|likimas nežinomas)([\s.,!;:]|$)/ },
  { status: 'available', re: /^(dovanojam(as|a|i|os)(\(-as\))?|ieško namų|ieskantys namu|ieškantys namų|namų ieškantys( gyvūnai)?|namų ieškantis|prieglaudoje|laukia šeimininkų)([\s.,!;:]|$)/ },
];

function status(value) {
  const evidence = cleanText(value);
  const v = fold(evidence);
  if (!v) return { status: 'unknown', statusEvidence: null };
  for (const rule of STATUS_RULES) if (rule.re.test(v)) return { status: rule.status, statusEvidence: evidence };
  return { status: 'unknown', statusEvidence: null };
}

// Free text may contain people's phone numbers or emails. We do not keep those.
function stripPrivate(text) {
  if (text == null) return null;
  const out = String(text)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[kontaktas pašalintas]')
    .replace(/(\+?370[\s-]?|\b8[\s-]?)?\(?\d{2,3}\)?[\s-]?\d{2,3}[\s-]?\d{2,4}\b/g, m => (m.replace(/\D/g, '').length >= 8 ? '[kontaktas pašalintas]' : m))
    .trim();
  return out || null;
}

module.exports = { cleanText, species, sex, size, yesNo, status, stripPrivate, fold };
