'use strict';
// VšĮ „Rožinė pėdutė“, Kaunas (rozinepedute.lt). VMVT row 73.
// robots.txt (2026-11-16): "User-agent: *" disallows only /wp-admin/ (+ Allow admin-ajax.php).
// Named AI/SEO bots (ClaudeBot, GPTBot, CCBot, AhrefsBot, ...) get "Disallow: /"; GlobisBot is not
// one of them, so /gyvunai/ is allowed for us. Privacy page /dokumentai/privatumo-politika/ has no
// text yet; the only rule found is the footer "© 2026 VŠĮ Rožinė Pėdutė. Visos teisės saugomos"
// (generic copyright line, nothing about automated collection).
//
// The WordPress REST API is closed (/wp-json/wp/v2/types -> 403 "Access restricted"), so this is an
// HTML adapter. Animals are the custom post type "gyvunai"; the archive /gyvunai/ ("Dovanojami
// gyvūnai") is a Bricks loop of cards: link /gyvunai/<slug>/ + NAME in <h3>, attribute
// gender="Patelė|Patinas" on the name block, one photo, "Prieglaudoje: <span>1mėn. 14d.</span>"
// (time spent in the shelter, NOT age, so it is not mapped to age_text).
//
// Pagination: the Bricks loop writes its query in <li class="brx-query-trail" data-query-vars=...>.
// On 2026-11-16 it was posts_per_page:-1 (all animals on one page, data-end="18", 18 cards).
// The <head> still has <link rel="next" href=".../gyvunai/page/2/"> from WordPress' own archive
// query; it is ignored when the loop says -1. If the loop ever pages (posts_per_page > 0) we walk
// /gyvunai/page/N/ up to data-max-pages. Without a readable trail we cannot prove the end:
// complete=false.
//
// Status: the archive heading "Dovanojami gyvūnai" goes through normalize.status(). Any extra
// words on a card (e.g. a badge, or "NAME (rezervuota)") go through normalize.status() and win
// with their own evidence; unrecognised extra words make the status unknown.
// Species, age, size, health, description are only on detail pages (not probed): v1 leaves them
// null and does no per-animal requests. Requests per run: robots.txt + 1 listing page.
const N = require('../lib/normalize.cjs');
const H = require('../lib/html.cjs');

const PARSER_VERSION = 'rozinepedute-1';
const ORIGIN = 'https://rozinepedute.lt';
const LISTING_URL = `${ORIGIN}/gyvunai/`;
const HOSTS = ['rozinepedute.lt', 'www.rozinepedute.lt'];
const MAX_PAGES = 30;

function intOrNull(v) {
  const n = Number(v);
  return v != null && v !== '' && Number.isInteger(n) ? n : null;
}

// "SANSA (rezervuota)" -> { name: 'SANSA', note: 'rezervuota' }
function splitName(text) {
  const t = N.cleanText(text);
  if (!t) return { name: null, note: null };
  const m = t.match(/^(.*?)\s*\(\s*(.*?)\s*\)\s*$/) || t.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  return { name: N.cleanText(m ? m[1] : t), note: m ? N.cleanText(m[2]) : null };
}

function parseListing(html, baseUrl) {
  const $ = H.load(html);
  const main = $('main').length ? $('main') : $('body');
  const heading = N.cleanText(main.find('h1').first().text());
  const cards = [];
  main.find('article.card-animals').each((_, el) => {
    const $card = $(el);
    const a = $card.find('.card-animals-name a[href], h3 a[href]').first();
    const href = H.abs(a.attr('href'), baseUrl);
    let slug = null;
    if (href) {
      const u = new URL(href);
      const parts = u.pathname.split('/').filter(Boolean);
      if (HOSTS.includes(u.hostname) && parts.length === 2 && parts[0] === 'gyvunai') slug = decodeURIComponent(parts[1]);
    }
    const { name, note } = splitName(a.text());
    const gender = $card.find('[gender]').first().attr('gender');
    // Any other words on the card besides the name and the "Prieglaudoje: ..." line.
    const info = $card.clone();
    info.find('figure, .card-animals-name, .card-animals__time').remove();
    const extra = N.cleanText(info.text());
    const img = $card.find('figure img').first();
    cards.push({
      slug,
      href,
      name,
      note: [note, extra].filter(Boolean).join(' ') || null,
      gender: gender ?? null,
      photo: img.length ? H.imgSrc(img, baseUrl) : null,
    });
  });

  let trail = null;
  const $trail = main.find('.brx-query-trail').first();
  if ($trail.length) {
    let vars = null;
    try { vars = JSON.parse($trail.attr('data-query-vars') || 'null'); } catch { vars = null; }
    trail = {
      perPage: intOrNull(vars?.posts_per_page),
      page: intOrNull($trail.attr('data-page')),
      maxPages: intOrNull($trail.attr('data-max-pages')),
      end: intOrNull($trail.attr('data-end')),
    };
  }
  return { heading, cards, trail };
}

function cardStatus(card, listStatus) {
  if (!card.note) return listStatus;
  const own = N.status(card.note);
  return own.status !== 'unknown' ? own : { status: 'unknown', statusEvidence: null };
}

module.exports = {
  id: 'rozinepedute',
  name: 'VšĮ „Rožinė pėdutė“',
  website: `${ORIGIN}/`,
  hosts: HOSTS,
  async collect({ fetcher, cache, log = () => {} }) {
    const pages = [];
    let url = LISTING_URL;
    let complete = false;
    for (let n = 1; n <= MAX_PAGES; n++) {
      const page = await fetcher.get(url);
      const parsed = await cache.getOrParse(page.hash, PARSER_VERSION, () => parseListing(page.body, url));
      pages.push(parsed);
      const t = parsed.trail;
      if (!t || t.perPage == null) { log('rozinepedute: no readable loop query; cannot prove end of list'); break; }
      if (t.perPage === -1) {
        complete = t.end == null || t.end === parsed.cards.length;
        if (!complete) log(`rozinepedute: loop says ${t.end} animals, page shows ${parsed.cards.length}`);
        break;
      }
      if (t.perPage <= 0 || t.maxPages == null || t.maxPages < 1 || t.page !== n) {
        log('rozinepedute: pagination info not understood; cannot prove end of list');
        break;
      }
      if (n >= t.maxPages) { complete = true; break; }
      url = `${LISTING_URL}page/${n + 1}/`;
    }
    if (!pages.some(p => p.cards.some(c => c.slug))) throw new Error('rozinepedute: no animal links found on listing (layout changed?)');

    const heading = pages[0].heading;
    const listStatus = heading ? N.status(heading) : { status: 'unknown', statusEvidence: null };
    if (listStatus.status !== 'available') log(`rozinepedute: listing heading not recognised as a status (${heading}); default unknown`);

    const animals = [];
    const skipped = [];
    const seen = new Set();
    for (const c of pages.flatMap(p => p.cards)) {
      if (!c.slug) { if (c.name) skipped.push({ nativeId: c.name, reason: 'no link to animal page' }); continue; }
      if (seen.has(c.slug)) continue;
      seen.add(c.slug);
      const st = cardStatus(c, listStatus);
      if (st.status === 'excluded') { skipped.push({ nativeId: c.slug, reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId: c.slug,
        sourceUrl: `${LISTING_URL}${encodeURIComponent(c.slug)}/`,
        name: c.name,
        species: null,
        sex: N.sex(c.gender),
        age_text: null,
        size: null,
        vaccinated: null,
        neutered: null,
        chipped: null,
        photos: c.photo ? [c.photo] : [],
        bio_lt: null,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: null,
      });
    }
    log(`rozinepedute: ${animals.length} animals, ${skipped.length} skipped, ${pages.length} page(s)`);
    return { animals, skipped, complete };
  },
};

module.exports._test = { parseListing, splitName };
