'use strict';
// VšĮ „Tautmilės globa“ (tautmilesgloba.lt), Vilnius. VMVT row 25.
// robots.txt (2026-11-16, Yoast): "User-agent: *" + empty "Disallow:" = nothing disallowed.
// No terms, privacy or copyright page is linked from the home or list page (checked 2026-11-16).
//
// Animals are a custom WordPress post type ("/gyvunai/<slug>/") that is NOT exposed in
// /wp-json/wp/v2/types (only posts/pages/media...; the few REST posts are 2017 news).
// So we read the public HTML list https://tautmilesgloba.lt/dovanojami/ ("Dovanojami gyvūnai").
// Each card gives: detail link, name, one photo, an image alt text ("Dovanojamas"), and
// "Prieglaudoje nuo <date>" (intake date; no schema field for it, so it is not kept).
// Species, sex, age, health facts are not on the list. Each detail page (checked 2026-11-18) has
// a <table class="table"> of "Rūšis / Lytis / Amžius / Sterilizacija/kastracija / Ūgio kategorija"
// rows and the description in div.gyvunas-single-text. We read both (one GET per animal, cached
// by page hash). The "Informacija darbuotojams" (staff) link is not followed.
// A failed detail page keeps the list-card facts.
// The site pages are injected with casino spam links: only cards inside section#main-gyvunas
// that link to /gyvunai/ on this host are read.
// Pagination: div.archive-pagination. On 2026-11-16 it was empty (all 19 animals on one page).
// If it ever holds WordPress page links we follow "a.next"; the end is proven by a current page
// with no "next", or by an empty pagination block on page 1. Anything else = complete:false.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'tautmilesgloba-detail-2';

// Contact details close many descriptions ("📞 0671 68608", "Susisiekite 0671..., Akvilė (...)").
// The line is cut where they start, so neither the number nor a staff member's name is kept.
function contactCut(line) {
  let t = N.cleanText(line) || '';
  const at = t.search(/📞|\+?\d[\d\s-]{7,}\d/u);
  if (at >= 0) t = t.slice(0, at);
  return N.cleanText(t.replace(/(susisiekite|skambinkite|tel\.?|telefonu)\s*[:,]?\s*$/iu, ''));
}

function parseDetail(body) {
  const $ = H.load(body);
  const pairs = $('#gyvunas-gyvunas table tr').map((_, tr) => {
    const td = $(tr).find('td');
    return td.length === 2 ? [[$(td[0]).text(), $(td[1]).text()]] : [];
  }).get();
  const facts = L.fromPairs(pairs);
  const lines = $('.gyvunas-single-text p').map((_, p) => {
    $(p).find('br').replaceWith('\n');
    return $(p).text().split('\n');
  }).get().map(contactCut).filter(Boolean);
  return { ...facts, bio_lt: lines.join('\n') || null };
}

const ORIGIN = 'https://tautmilesgloba.lt';
const LIST_URL = `${ORIGIN}/dovanojami/`;
const HOSTS = ['tautmilesgloba.lt', 'www.tautmilesgloba.lt'];

// Stable id from the detail URL slug (/gyvunai/<slug>/), folded to ASCII for record.cjs.
function slugId(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  if (!HOSTS.includes(url.hostname.toLowerCase())) return null;
  const m = url.pathname.match(/^\/gyvunai\/([^/]+)\/?$/);
  if (!m) return null;
  let slug;
  try { slug = decodeURIComponent(m[1]); } catch { slug = m[1]; }
  slug = slug.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\w.-]+/g, '-');
  return slug || null;
}

function parsePage(html, pageUrl) {
  const $ = H.load(html);
  const list = $('section#main-gyvunas');
  if (!list.length) throw new Error(`tautmilesgloba: no section#main-gyvunas on ${pageUrl} (layout changed?)`);
  const cards = [];
  list.find('a[href]').each((_, el) => {
    const $a = $(el);
    const href = H.abs($a.attr('href'), pageUrl);
    if (!href || !slugId(href)) return; // not an animal card (e.g. injected spam link)
    const $img = $a.find('img').first();
    cards.push({
      href,
      name: N.cleanText($a.find('.main-vardas').first().text()),
      photo: $img.length ? H.imgSrc($img, pageUrl) : null,
      statusText: $img.length ? N.cleanText($img.attr('alt')) : null,
    });
  });
  const pag = $('.archive-pagination').first();
  const hasPagination = pag.length > 0;
  const nextHref = hasPagination ? (pag.find('a.next').attr('href') || pag.find('a[rel="next"]').attr('href') || null) : null;
  const hasCurrent = hasPagination && pag.find('.current, [aria-current="page"]').length > 0;
  const hasLinks = hasPagination && pag.find('a, .page-numbers').length > 0;
  return { cards, next: nextHref ? H.abs(nextHref, pageUrl) : null, hasPagination, hasCurrent, hasLinks };
}

function createTautmilesglobaAdapter({ maxPages = 20 } = {}) {
  async function collect({ fetcher, cache, log = () => {} }) {
    const animals = [];
    const skipped = [];
    const seenIds = new Set();
    const seenPages = new Set();
    let url = LIST_URL;
    let complete = false;

    for (let page = 1; page <= maxPages; page++) {
      if (seenPages.has(url)) { log(`tautmilesgloba: pagination loop at ${url}`); break; }
      seenPages.add(url);
      const res = await fetcher.get(url); // throws on any failure: the run fails, nothing is published
      const parsed = parsePage(res.body, res.url);

      for (const card of parsed.cards) {
        const nativeId = slugId(card.href);
        if (seenIds.has(nativeId)) continue; // same card twice
        seenIds.add(nativeId);
        // The only per-card status text is the photo's alt ("Dovanojamas" on 2026-11-16).
        const st = N.status(card.statusText);
        if (st.status === 'excluded') { skipped.push({ nativeId, reason: st.statusEvidence }); continue; }
        animals.push({
          nativeId,
          sourceUrl: card.href,
          name: card.name,
          species: null,
          sex: null,
          age_text: null,
          size: null,
          vaccinated: null,
          neutered: null,
          chipped: null,
          photos: card.photo ? [card.photo] : [],
          bio_lt: null,
          status: st.status,
          statusEvidence: st.statusEvidence,
          sourceUpdatedAt: null,
        });
      }

      if (parsed.next) {
        if (!HOSTS.includes(new URL(parsed.next).hostname.toLowerCase())) {
          throw new Error(`tautmilesgloba: next page on another host: ${parsed.next}`);
        }
        url = parsed.next;
        continue;
      }
      // Last page proof: the current page marked with no "next", or page 1 with an empty block.
      complete = parsed.hasCurrent || (page === 1 && parsed.hasPagination && !parsed.hasLinks);
      break;
    }
    for (const a of animals) {
      let res;
      try { res = await fetcher.get(a.sourceUrl); }
      catch (e) { log(`${a.sourceUrl}: detail not read (${e.message})`); continue; }
      const d = await cache.getOrParse(sha256(res.body), PARSER_VERSION, () => parseDetail(res.body));
      for (const k of ['species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt']) if (d[k] != null) a[k] = d[k];
    }
    log(`tautmilesgloba: ${animals.length} animals, ${skipped.length} skipped, complete=${complete}`);
    return { animals, skipped, complete };
  }

  return {
    id: 'tautmilesgloba',
    name: 'VšĮ „Tautmilės globa“',
    website: 'https://tautmilesgloba.lt/',
    hosts: HOSTS,
    collect,
  };
}

module.exports = createTautmilesglobaAdapter();
module.exports.createTautmilesglobaAdapter = createTautmilesglobaAdapter;
module.exports.parsePage = parsePage;
module.exports.slugId = slugId;
module.exports.parseDetail = parseDetail;
