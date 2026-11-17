'use strict';
// Turns Lithuanian labels from shelter pages into schema values.
// Rule: if the page does not say it clearly, the answer is null (unknown). Never guess.

const fold = s => String(s ?? '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

function cleanText(value) {
  if (value == null) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
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
  const v = fold(value);
  if (/^(mažas|maža|mažo dydžio|small)$/.test(v)) return 'small';
  if (/^(vidutinis|vidutinė|vidutinio dydžio|medium)$/.test(v)) return 'medium';
  if (/^(didelis|didelė|didelio dydžio|large)$/.test(v)) return 'large';
  return null;
}

function yesNo(value) {
  const v = fold(value);
  if (/^(taip|yra|atlikta|atliktas|skiepytas|skiepyta|paskiepytas|paskiepyta|sterilizuotas|sterilizuota|kastruotas|kastruota|čipuotas|čipuota|paženklintas|paženklinta|ženklintas|ženklinta)$/.test(v)) return true;
  if (/^(ne|nėra|neatlikta|neatliktas|neskiepytas|neskiepyta|nesterilizuotas|nesterilizuota|nekastruotas|nekastruota)$/.test(v)) return false;
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
