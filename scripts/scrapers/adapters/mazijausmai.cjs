'use strict';
// VšĮ „Maži jausmai“, Vilnius (mazijausmai.lt). VMVT row 58.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/" (+ Allow admin-ajax.php).
// Our pages are not disallowed. Terms and privacy policy live on portal.termshub.io (external,
// not probed yet); nothing on mazijausmai.lt itself forbids copying or automated collection.
//
// Animals are NOT in the WordPress REST API: the only public types are pages/posts/media etc.,
// /wp/v2/posts is empty. The list is one hand-built Elementor page /ieskantys-namu/
// ("Namų ieškantys gyvūnai"): a grid of image widgets, each <figure> = link to the animal's own
// page (e.g. /liepsnele or https://mazijausmai.lt/ramunele/), one photo, a caption with the name.
// Grid cells without a link are placeholders ("." + "informacija ruošiama" image) or animals
// shown but not offered yet ("Pusnė (kol kas nedovanojama - gydoma)"): those go to `skipped`.
//
// The list shows only name + photo + link. Species, sex, age, health are on the detail pages,
// which were not probed, so v1 does not read them: those fields stay null (no guessing).
// Status: the page heading "Namų ieškantys gyvūnai" goes through normalize.status(); an explicit
// status word in a caption ("Vardas (rezervuota)") overrides it with its own evidence.
// No pagination exists on this page; if pagination links ever appear, complete=false.
// Requests per run: robots.txt + 1 listing page.
const N = require('../lib/normalize.cjs');
const H = require('../lib/html.cjs');

const PARSER_VERSION = 'mazijausmai-1';
const ORIGIN = 'https://mazijausmai.lt';
const LISTING_URL = `${ORIGIN}/ieskantys-namu/`;
const HOSTS = ['mazijausmai.lt', 'www.mazijausmai.lt'];

// "Pusnė (kol kas nedovanojama - gydoma)" -> { name: 'Pusnė', note: 'kol kas nedovanojama - gydoma' }
function splitCaption(caption) {
  const text = N.cleanText(caption);
  if (!text) return { name: null, note: null };
  const m = text.match(/^(.*?)\s*[(]\s*(.*?)\s*[)]?\s*$/) || text.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  const name = N.cleanText(m ? m[1] : text);
  return { name: name && /\p{L}/u.test(name) ? name : null, note: m ? N.cleanText(m[2]) : null };
}

function parseListing(html) {
  const $ = H.load(html);
  const main = $('main').length ? $('main') : $('body');
  const heading = N.cleanText(main.find('h1').first().text());
  const cards = [];
  main.find('figure').each((_, fig) => {
    const $fig = $(fig);
    const href = H.abs($fig.find('a[href]').first().attr('href'), LISTING_URL);
    let slug = null;
    if (href) {
      const u = new URL(href);
      const parts = u.pathname.replace(/^\/index\.php\//, '/').split('/').filter(Boolean);
      if (HOSTS.includes(u.hostname) && parts.length === 1) slug = decodeURIComponent(parts[0]);
    }
    const { name, note } = splitCaption($fig.find('figcaption').first().text());
    const img = $fig.find('img').first();
    cards.push({ slug, name, note, photo: img.length ? H.imgSrc(img, LISTING_URL) : null });
  });
  const paginated = main.find('a.page-numbers, .nav-links a, a.next, .pagination a').length > 0
    || $('link[rel="next"]').length > 0;
  return { heading, cards, paginated };
}

module.exports = {
  id: 'mazijausmai',
  name: 'VšĮ „Maži jausmai“',
  website: `${ORIGIN}/`,
  hosts: HOSTS,
  async collect({ fetcher, cache, log }) {
    const page = await fetcher.get(LISTING_URL);
    const parsed = await cache.getOrParse(page.hash, PARSER_VERSION, () => parseListing(page.body));
    if (!parsed.cards.some(c => c.slug)) throw new Error('mazijausmai: no animal links found on listing (layout changed?)');

    const listStatus = parsed.heading ? N.status(parsed.heading) : { status: 'unknown', statusEvidence: null };
    if (listStatus.status !== 'available') log(`mazijausmai: listing heading not recognised as a status (${parsed.heading}); default unknown`);

    const animals = [];
    const skipped = [];
    const seen = new Set();
    for (const c of parsed.cards) {
      if (!c.slug) {
        // Unlinked cell: a placeholder (no name) or an animal shown but not offered now.
        if (c.name) skipped.push({ nativeId: c.name, reason: c.note || 'no link to animal page' });
        continue;
      }
      if (seen.has(c.slug)) continue;
      seen.add(c.slug);
      const own = c.note ? N.status(c.note) : null;
      let st;
      if (own && own.status !== 'unknown') st = own;
      else if (c.note) st = { status: 'unknown', statusEvidence: null }; // unexplained note: do not assume available
      else st = listStatus;
      if (st.status === 'excluded') { skipped.push({ nativeId: c.slug, reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId: c.slug,
        sourceUrl: `${ORIGIN}/${encodeURIComponent(c.slug)}/`,
        name: c.name,
        species: null,
        sex: null,
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
    log(`mazijausmai: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete: !parsed.paginated };
  },
};

module.exports._test = { parseListing, splitCaption };
