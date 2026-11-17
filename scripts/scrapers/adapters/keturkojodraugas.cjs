'use strict';
// Asociacija „Keturkojo draugas“, Kazlų Rūda (keturkojodraugas.lt). VMVT row 11.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// No terms/copyright page found on the site.
//
// WordPress, but animals are NOT in the REST API (only post/page types; posts are news).
// Each listing page renders all animals as Bootstrap cards in one HTML page, no pagination:
//   <div class="alm-listing"> ... <div class="card"><img class="gallery_pet_image">
//     <h4>NAME</h4><table><tr><th>Lytis</th><td>Patinas</td></tr>...</table>
//     <div class="col-12"><p><b>Kiti ypatumai</b></p><p>free text</p></div></div>
// There are no detail pages, so one request per listing page is all we need.
// We do not read /rado-namus/ (adopted) or /liks-atmintyje/ (died).
const html = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');
const labels = require('../lib/labels.cjs');

const BASE = 'https://keturkojodraugas.lt/';
const LISTINGS = [
  { slug: 'kates', url: `${BASE}kates/` },
  { slug: 'sunys', url: `${BASE}sunys/` },
];
// Text the site shows in an empty listing ("Informacija ruošiama" = information is being prepared).
const EMPTY_NOTICE = /informacija ruošiama/i;

// Lithuanian letters -> ASCII, for stable ids (record.cjs allows [\w.:-] only).
const LT = { ą: 'a', č: 'c', ę: 'e', ė: 'e', į: 'i', š: 's', ų: 'u', ū: 'u', ž: 'z' };
function slug(text) {
  return N.fold(text).replace(/[ąčęėįšųūž]/g, c => LT[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Words written in the free text ("Skiepytas, ženklintas", "Paskiepyta ir suženklinta").
// Only exact words count; anything else stays null.
const word = body => new RegExp(`(?<!\\p{L})${body}(?!\\p{L})`, 'iu');
const VACC_YES = word('(pa)?skiepyt(as|a|i|os)');
const VACC_NO = word('ne(pa)?skiepyt(as|a|i|os)');
const CHIP_YES = word('(su)?ženklint(as|a|i|os)');
const CHIP_NO = word('ne(su|pa)?ženklint(as|a|i|os)');
const NEUT_YES = word('(sterilizuot|kastruot)(as|a|i|os)');
const NEUT_NO = word('ne(sterilizuot|kastruot)(as|a|i|os)');
// "Dar nedovanojama" = not offered yet: the page does not say it is available.
const NOT_OFFERED = word('nedovanojam(as|a|i|os)');

function fromText(text, yes, no) {
  if (!text) return null;
  const y = yes.test(text);
  const n = no.test(text);
  if (y === n) return null; // neither, or contradictory
  return y;
}

function sentences(text) {
  return String(text || '').split(/(?<=[.!?])\s+|\n/).map(s => N.cleanText(s)).filter(Boolean);
}

function parseListing(body, page) {
  const $ = html.load(body);
  const listing = $('.alm-listing').first();
  if (!listing.length) throw new Error(`keturkojodraugas: listing block not found on ${page.url} (layout changed?)`);
  const heading = N.cleanText($('h1').first().text());
  // Heading is "Dovanojamos Katės" / "Dovanojami Šunys": the status and species of the whole list.
  const pageStatus = N.status(heading);
  const lastWord = heading ? heading.split(' ').pop() : null;
  const species = N.species(lastWord);

  const cards = listing.find('.card');
  if (!cards.length) {
    if (EMPTY_NOTICE.test(listing.text())) return { animals: [], skipped: [] };
    throw new Error(`keturkojodraugas: no animal cards and no empty notice on ${page.url}`);
  }

  const animals = [];
  const skipped = [];
  const seen = new Map();
  cards.each((_, card) => {
    const $card = $(card);
    const name = N.cleanText($card.find('h4').first().text());
    const photo = html.imgSrc($card.find('img').first(), page.url);
    if (!name) { skipped.push({ nativeId: photo || '?', reason: 'no name on card' }); return; }

    const pairs = html.pairs($, $card.find('table'));
    const facts = labels.fromPairs(pairs);
    const extra = $card.find('.card-body > .col-12 p')
      .map((__, p) => N.cleanText($(p).text())).get()
      .filter(t => t && !/^kiti ypatumai$/i.test(t))
      .join('\n');

    // Status: a status word in the card text wins over the page heading.
    let status = pageStatus.status;
    let statusEvidence = pageStatus.statusEvidence;
    for (const s of sentences(extra)) {
      const st = N.status(s);
      if (st.status !== 'unknown') { status = st.status; statusEvidence = st.statusEvidence; break; }
      if (NOT_OFFERED.test(s)) { status = 'unknown'; statusEvidence = null; break; }
    }

    let nativeId = `${page.slug}-${slug(name)}`;
    const count = (seen.get(nativeId) || 0) + 1;
    seen.set(nativeId, count);
    if (count > 1) {
      const file = photo ? slug(new URL(photo).pathname.split('/').pop().replace(/\.[a-z0-9]+$/i, '')) : String(count);
      nativeId = `${nativeId}-${file}`;
    }
    if (status === 'excluded') { skipped.push({ nativeId, reason: statusEvidence }); return; }

    const bioParts = [];
    for (const [label, value] of pairs) {
      if (/^(veislė|kailio spalva|charakteris)$/i.test(label)) bioParts.push(`${label}: ${value}.`);
    }
    if (extra) bioParts.push(extra);

    animals.push({
      nativeId,
      sourceUrl: page.url,
      name,
      species: facts.species ?? species,
      sex: facts.sex ?? null,
      age_text: facts.age_text ?? null,
      size: facts.size ?? null,
      vaccinated: facts.vaccinated ?? fromText(extra, VACC_YES, VACC_NO),
      neutered: facts.neutered ?? fromText(extra, NEUT_YES, NEUT_NO),
      chipped: facts.chipped ?? fromText(extra, CHIP_YES, CHIP_NO),
      photos: photo ? [photo] : [],
      bio_lt: bioParts.join('\n') || null,
      status,
      statusEvidence: status === 'unknown' ? null : statusEvidence,
      sourceUpdatedAt: null,
    });
  });
  return { animals, skipped };
}

module.exports = {
  id: 'keturkojodraugas',
  name: 'Asociacija „Keturkojo draugas“, Kazlų Rūda',
  website: BASE,
  hosts: ['keturkojodraugas.lt', 'www.keturkojodraugas.lt'],
  async collect({ fetcher, log = () => {} }) {
    const animals = [];
    const skipped = [];
    // Each listing is a single page with every animal on it (no pagination links exist).
    for (const page of LISTINGS) {
      const res = await fetcher.get(page.url); // throws on any failure: run becomes 'failed'
      const out = parseListing(res.body, page);
      log(`${page.url}: ${out.animals.length} animals, ${out.skipped.length} skipped`);
      animals.push(...out.animals);
      skipped.push(...out.skipped);
    }
    return { animals, skipped, complete: true };
  },
  _parseListing: parseListing,
};
