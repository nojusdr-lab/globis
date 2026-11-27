'use strict';
// Utenos rajono gyvūnų mylėtojų draugija (gyvunugloba.com). VMVT row 24.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// No terms/copyright-reuse page found; the footer only says "Copyright 2018 © Utenos rajono gyvūnų mylėtojų draugija".
//
// WordPress with the Qode "Bridge" theme. Animals are the theme's `portfolio_page` type, which is
// NOT in the REST API (/wp-json/wp/v2/types lists only post/page/media/...; posts are two "Hello world!").
// So we read HTML:
//   1. /iesko-namu-gyvunai/  (h1 "Ieško namų gyvūnai" = page status; links to sunys/kates/kiti)
//   2. /iesko-namu-gyvunai/{sunys,kates,kiti}/ : h1 "Šunys" / "Katės" / "Kiti gyvūnai" (= species of the list),
//      Qode portfolio grid (checked on real pages 2026-11-17), one <article class='mix ...'> per animal:
//        <a class="portfolio_link_class" title="NAME" href=".../portfolio_page/<slug>/">
//        <div class="image_holder"><img src=...> (sometimes no image)
//        <h4 class="portfolio_title"><a href=".../portfolio_page/<slug>/">NAME</a></h4>
//      All animals are on one page (no paging block seen). If the theme's "Show more" block
//      (<div class="portfolio_paging"><span rel="MAXPAGES" class="load_more"><a href=...>, seen on the
//      home page) ever appears, we follow it to the end.
// We do not read /iesko-namu-gyvunai/rade-namus/ (adopted) or /islydeti/ (died).
// Detail pages (portfolio_page/<slug>/, checked 2026-11-18) hold the description in
// <div class="info portfolio_content"> as <p> paragraphs, often prefixed with a stray "<span;>".
// We read it (one GET per animal, cached by page hash) as bio_lt; record.cjs takes health words
// stated in it ("Loris kastruotas"). A failed detail page keeps the list-card facts.
const html = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'gyvunugloba-detail-4';

function parseDetail(body, name) {
  const $ = html.load(body);
  const lines = $('.portfolio_content').first().find('p').map((_, p) => {
    $(p).find('br').replaceWith('\n');
    return $(p).text().split('\n');
  }).get()
    .map(t => N.cleanText(String(t).replace(/<span;?>/g, '')))
    .filter(t => t && !/^https?:\/\/\S+$/.test(t)); // bare links (Facebook posts) are not description
  if (lines.length && name && N.fold(lines[0]) === N.fold(name)) lines.shift(); // first line repeats the name
  // Every page ends with the same adoption-form and donation footer (bank account, PayPal): not about the animal.
  let footer = lines.findIndex(l => /^(dėl augintinio prašome užpildyti anketą|ačiū visiems padedantiems)/.test(N.fold(l))
    || /(\ba\.s\.|(^|\s)įm\. kodas|sąskait|paypal|paysera|contribee)/.test(N.fold(l)));
  // Walk back over the lines that introduce the account: "...padėti jiems:", the society's own name.
  while (footer > 0 && (/:$/.test(lines[footer - 1]) || /^utenos rajono gyvūnų mylėtojų draugija$/.test(N.fold(lines[footer - 1])))) footer--;
  if (footer >= 0) lines.length = footer;
  const facts = L.fromPairs(lines.map(l => l.match(/^([^:：]{2,40})[:：]\s*(.+)$/)).filter(Boolean).map(m => [m[1], m[2]]));
  return { ...facts, bio_lt: lines.join('\n') || null };
}

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
  const heading = N.cleanText($('h1').first().text());
  return { heading, items: [...items.values()], next: more.length && next ? next : null, maxPages: maxPages > 0 ? maxPages : null };
}

async function readListing(fetcher, listing, log) {
  const items = [];
  let heading = null;
  const seenUrls = new Set();
  let url = listing.url;
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (seenUrls.has(url)) throw new Error(`gyvunugloba: pagination loops at ${url}`);
    seenUrls.add(url);
    const res = await fetcher.get(url); // throws on any failure: run becomes 'failed'
    const out = parseList(res.body, res.url);
    log(`${res.url}: ${out.items.length} items`);
    if (page === 1) heading = out.heading;
    items.push(...out.items);
    if (!out.next) return { heading, items, complete: true };
    if (out.maxPages != null && page >= out.maxPages) return { heading, items, complete: true };
    url = out.next;
  }
  return { heading, items, complete: false }; // more pages than we allow: do not trust as complete
}

module.exports = {
  id: 'gyvunugloba',
  name: 'Utenos rajono gyvūnų mylėtojų draugija',
  website: BASE,
  hosts: ['gyvunugloba.com', 'www.gyvunugloba.com'],
  async collect({ fetcher, cache, log = () => {} }) {
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
        // Species: the item's own category label if shown, else the list heading ("Šunys", "Katės", "Kiti gyvūnai").
        let species = it.categories.map(c => N.species(c)).filter(Boolean);
        if (!species.length && N.species(r.heading)) species = [N.species(r.heading)];
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
    for (const a of animals) {
      let res;
      try { res = await fetcher.get(a.sourceUrl); }
      catch (e) { log(`${a.sourceUrl}: detail not read (${e.message})`); continue; }
      const d = await cache.getOrParse(sha256(res.body), PARSER_VERSION, () => parseDetail(res.body, a.name));
      for (const k of ['sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped', 'bio_lt']) if (d[k] != null) a[k] = d[k];
    }
    log(`gyvunugloba: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete };
  },
  _parseList: parseList,
  _parseDetail: parseDetail,
};
