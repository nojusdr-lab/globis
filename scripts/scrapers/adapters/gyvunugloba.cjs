'use strict';
// Utenos rajono gyvūnų mylėtojų draugija (gyvunugloba.com). VMVT row 24.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// No terms/copyright-reuse page found; the footer only says "Copyright 2018 © Utenos rajono gyvūnų mylėtojų draugija".
//
// WordPress with the Qode "Bridge" theme. Animals are the theme's `portfolio_page` type, which is
// NOT in the REST API (/wp-json/wp/v2/types lists only post/page/media/...; posts are two "Hello world!").
// So we read HTML:
//   1. /iesko-namu-gyvunai/  (h1 "Ieško namų gyvūnai" = page status; links to sunys/kates/kiti)
//   2. /iesko-namu-gyvunai/{sunys,kates,kiti}/ : Qode portfolio list, one <article> per animal:
//        <h4 class="portfolio_title"><a href=".../portfolio_page/<slug>/">NAME</a></h4>
//        <span class="project_category">Katės</span> ... <div class="image_holder"><img src=...>
//      Pagination: <div class="portfolio_paging"><span rel="MAXPAGES" class="load_more"><a href=".../page/N/">
// We do not read /iesko-namu-gyvunai/rade-namus/ (adopted) or /islydeti/ (died).
// The list shows only name, category and one photo. Detail pages (portfolio_page/<slug>/) were not
// probed, so we do not read them; sex/age/health stay null until a real detail page is seen.
const html = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');

const BASE = 'https://gyvunugloba.com/';
const PARENT = `${BASE}iesko-namu-gyvunai/`;
const LISTINGS = ['sunys', 'kates', 'kiti'].map(slug => ({ slug, url: `${PARENT}${slug}/` }));
const MAX_PAGES = 30;

// Items of one list page. The theme can render the same list twice (desktop masonry + mobile grid),
// so we key by the portfolio slug and keep the first complete reading.
function parseList(body, url) {
  const $ = html.load(body);
  const holders = $('.portfolio_main_holder');
  if (!holders.length) throw new Error(`gyvunugloba: portfolio list not found on ${url} (layout changed?)`);
  const items = new Map();
  holders.find('article').each((_, el) => {
    const $a = $(el);
    const link = $a.find('h4.portfolio_title a, .portfolio_title a').first();
    const href = html.abs(link.attr('href') || $a.find('a.portfolio_link_class').attr('href') || '', url);
    const m = href && new URL(href).pathname.match(/^\/portfolio_page\/([^/]+)\/?$/);
    if (!m) throw new Error(`gyvunugloba: animal without portfolio link on ${url}`);
    const slug = decodeURIComponent(m[1]).toLowerCase();
    if (items.has(slug)) return;
    items.set(slug, {
      slug,
      href,
      name: N.cleanText(link.text()) || N.cleanText($a.find('a.portfolio_link_class').attr('title')),
      categories: $a.find('.project_category').map((__, c) => N.cleanText($(c).text())).get()
        .flatMap(t => String(t || '').split(/\s*,\s*/)).filter(Boolean),
      photo: html.imgSrc($a.find('.image_holder img').first(), url),
    });
  });
  const more = $('.portfolio_paging .load_more').first();
  const next = html.abs(more.find('a').attr('href') || '', url);
  const maxPages = Number.parseInt(more.attr('rel'), 10);
  return { items: [...items.values()], next: more.length && next ? next : null, maxPages: maxPages > 0 ? maxPages : null };
}

async function readListing(fetcher, listing, log) {
  const items = [];
  const seenUrls = new Set();
  let url = listing.url;
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (seenUrls.has(url)) throw new Error(`gyvunugloba: pagination loops at ${url}`);
    seenUrls.add(url);
    const res = await fetcher.get(url); // throws on any failure: run becomes 'failed'
    const out = parseList(res.body, res.url);
    log(`${res.url}: ${out.items.length} items`);
    items.push(...out.items);
    if (!out.next) return { items, complete: true };
    if (out.maxPages != null && page >= out.maxPages) return { items, complete: true };
    url = out.next;
  }
  return { items, complete: false }; // more pages than we allow: do not trust as complete
}

module.exports = {
  id: 'gyvunugloba',
  name: 'Utenos rajono gyvūnų mylėtojų draugija',
  website: BASE,
  hosts: ['gyvunugloba.com', 'www.gyvunugloba.com'],
  async collect({ fetcher, log = () => {} }) {
    const parent = await fetcher.get(PARENT);
    const $ = html.load(parent.body);
    // "Ieško namų gyvūnai" (= looking for a home). Anything else: status unknown.
    const pageStatus = N.status($('h1').first().text());
    const linked = new Set($('a[href]').map((_, a) => html.abs($(a).attr('href'), PARENT)).get());
    for (const l of LISTINGS) {
      if (!linked.has(l.url)) throw new Error(`gyvunugloba: ${l.url} is no longer linked from ${PARENT} (site changed?)`);
    }

    const animals = [];
    const skipped = [];
    const seen = new Set();
    let complete = true;
    for (const listing of LISTINGS) {
      const r = await readListing(fetcher, listing, log);
      complete &&= r.complete;
      for (const it of r.items) {
        if (seen.has(it.slug)) continue; // same animal in two categories
        seen.add(it.slug);
        // A category label like "Radę namus" or "Rezervuota" on the item overrides the page status.
        let st = pageStatus;
        for (const c of it.categories) {
          const s = N.status(c);
          if (s.status !== 'unknown') { st = s; break; }
        }
        if (st.status === 'excluded') { skipped.push({ nativeId: it.slug, reason: st.statusEvidence }); continue; }
        const species = it.categories.map(c => N.species(c)).filter(Boolean);
        animals.push({
          nativeId: it.slug,
          sourceUrl: it.href,
          name: it.name,
          species: new Set(species).size === 1 ? species[0] : null,
          sex: null,
          age_text: null,
          size: null,
          vaccinated: null,
          neutered: null,
          chipped: null,
          photos: it.photo ? [it.photo] : [],
          bio_lt: null,
          status: st.status,
          statusEvidence: st.status === 'unknown' ? null : st.statusEvidence,
          sourceUpdatedAt: null,
        });
      }
    }
    log(`gyvunugloba: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete };
  },
  _parseList: parseList,
};
