'use strict';
// VšĮ „Beglobis“, Vilnius (www.beglobis.com). VMVT row 35.
// robots.txt (probe 2026-11-16): HTTP 404 = no rules. No terms/privacy page found; the footer only
// says "© 2026. Visos teisės saugomos." (generic copyright line, no rule on collection).
//
// Not WordPress (/wp-json/wp/v2/types = 404): an old custom PHP CMS (UAB Artogama) with
// <base href="http://www.beglobis.com/index.php">. Animals are "modproduct" items.
//
// List: /Dovanojami-684.html (18 cards per page: link with productid, name, thumbnail, date, status
// text "Dovanojamas"). Pagination: <div class="pages"> with a "»" link to ?productpage=N (0-based).
// We follow the "»" link until a page has none (= last page). Stopping at maxPages = complete:false.
//
// Detail pages (one GET per animal, ~1 per card, ≥5 s each): the list has only the name, so species,
// sex, age, bio and full-size photos come from the detail page's "productParam" lines
// ("Rūšis: Katė", "Lytis: Patelė", "Amžius: 7 metai"), "productText" and lightbox links.
// Contact lines on that page (Telefonas, El. paštas, Šeimininko vardas, Adresas) are never read.
//
// The list also carries animals of other guardians (filter "Globėjas": Grinda, LGGD Vilniaus skyrius).
// We keep only "Globėjas/prieglauda: Beglobis" (or empty); others go to skipped with the real text,
// so another shelter's animals are not shown under Beglobis.
// The list "date" is not labelled (posted or updated?), so sourceUpdatedAt stays null.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');
const labels = require('../lib/labels.cjs');

const ORIGIN = 'http://www.beglobis.com';
const LIST_URL = `${ORIGIN}/Dovanojami-684.html`;
const OWN_GUARDIAN = 'beglobis';

function baseOf($, pageUrl) {
  return H.abs($('base').attr('href') || pageUrl, pageUrl) || pageUrl;
}

function parseList(html, pageUrl) {
  const $ = H.load(html);
  const base = baseOf($, pageUrl);
  const pages = $('#middle .pages');
  if (!pages.length) throw new Error(`beglobis: no pagination block on ${pageUrl} (layout changed?)`);
  const cards = [];
  $('#middle .product').each((_, el) => {
    const $el = $(el);
    const a = $el.find('.title h2 a').first();
    const href = H.abs(a.attr('href'), base);
    const id = href && new URL(href).searchParams.get('productid');
    if (!href || !/^\d+$/.test(id || '')) throw new Error(`beglobis: card without productid on ${pageUrl}`);
    const img = $el.find('.image img').first();
    cards.push({
      nativeId: id,
      sourceUrl: href,
      name: N.cleanText(a.text()),
      listStatus: N.cleanText($el.find('.status').first().text()),
      photo: img.length ? H.imgSrc(img, base) : null,
    });
  });
  const nextA = pages.first().find('a').filter((_, a) => N.cleanText($(a).text()) === '»').first();
  const next = nextA.length ? H.abs(nextA.attr('href'), base) : null;
  return { cards, next };
}

function parseDetail(html, pageUrl) {
  const $ = H.load(html);
  const base = baseOf($, pageUrl);
  const params = $('#middle .productParam');
  if (!params.length) throw new Error(`beglobis: no animal facts on ${pageUrl} (layout changed?)`);
  const pairs = [];
  params.each((_, el) => {
    const label = N.cleanText($(el).find('span').first().text());
    const value = N.cleanText($(el).clone().children('span').remove().end().text());
    if (label) pairs.push([label.replace(/:$/, ''), value]);
  });
  const get = l => (pairs.find(([k]) => N.fold(k) === l) || [])[1] ?? null;
  // Only animal facts go to the label reader; contact lines are dropped here.
  const facts = labels.fromPairs(pairs.filter(([k]) => ['rūšis', 'lytis', 'amžius'].includes(N.fold(k))));
  const photos = $('#middle a[rel="lightbox"]').map((_, a) => H.abs($(a).attr('href'), base)).get().filter(Boolean);
  const text = $('#middle .productText').first();
  return {
    name: N.cleanText($('#middle h2.title').first().text()),
    statusText: get('gyvūno statusas'),
    guardian: get('globėjas/prieglauda'),
    facts,
    photos,
    bio: text.length ? N.cleanText(text.text()) : null,
  };
}

// List and detail both state a status. Same meaning = keep; different = the site contradicts itself.
function pickStatus(listText, detailText) {
  const a = N.status(listText);
  const b = N.status(detailText);
  if (a.status === 'unknown') return b;
  if (b.status === 'unknown' || b.status === a.status) return a;
  return { status: 'unknown', statusEvidence: null };
}

function createBeglobisAdapter({ maxPages = 20 } = {}) {
  async function collect({ fetcher, log = () => {} }) {
    const cards = [];
    const visited = new Set();
    let url = LIST_URL;
    let complete = false;
    for (let i = 0; i < maxPages; i++) {
      if (visited.has(url)) throw new Error(`beglobis: pagination loops back to ${url}`);
      visited.add(url);
      const page = await fetcher.get(url);
      const { cards: pageCards, next } = parseList(page.body, page.url);
      cards.push(...pageCards);
      if (!next) { complete = true; break; }
      url = next;
    }

    const animals = [];
    const skipped = [];
    const seen = new Set();
    for (const c of cards) {
      if (seen.has(c.nativeId)) continue;
      seen.add(c.nativeId);
      const listSt = N.status(c.listStatus);
      if (listSt.status === 'excluded') { skipped.push({ nativeId: c.nativeId, reason: listSt.statusEvidence }); continue; }
      const page = await fetcher.get(c.sourceUrl); // errors propagate: a missing detail fails the run
      const d = parseDetail(page.body, page.url);
      if (d.guardian && N.fold(d.guardian) !== OWN_GUARDIAN) {
        skipped.push({ nativeId: c.nativeId, reason: `Globėjas/prieglauda: ${d.guardian}` });
        continue;
      }
      const st = pickStatus(c.listStatus, d.statusText);
      if (st.status === 'excluded') { skipped.push({ nativeId: c.nativeId, reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId: c.nativeId,
        sourceUrl: c.sourceUrl,
        name: d.name || c.name,
        species: d.facts.species ?? null,
        sex: d.facts.sex ?? null,
        age_text: d.facts.age_text ?? null,
        size: null,
        vaccinated: null,
        neutered: null,
        chipped: null,
        photos: d.photos.length ? d.photos : (c.photo ? [c.photo] : []),
        bio_lt: d.bio,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: null,
      });
    }
    log(`beglobis: ${visited.size} list pages, ${animals.length} animals, ${skipped.length} skipped${complete ? '' : ' (page limit reached: incomplete)'}`);
    return { animals, skipped, complete };
  }

  return {
    id: 'beglobis',
    name: 'VšĮ „Beglobis“',
    website: 'http://www.beglobis.com/',
    hosts: ['beglobis.com', 'www.beglobis.com'],
    collect,
  };
}

module.exports = createBeglobisAdapter();
module.exports.createBeglobisAdapter = createBeglobisAdapter;
module.exports._parseList = parseList;
module.exports._parseDetail = parseDetail;
module.exports._pickStatus = pickStatus;
