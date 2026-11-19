'use strict';
// VšĮ „Penkta koja“, Kaunas (penktakoja.lt). VMVT row 5. Dogs only ("Privati beglobių šunų prieglauda").
// robots.txt (2026-11-16): only WooCommerce internals, ?add-to-cart= and /wp-admin/ are disallowed;
// /wp-json/ and /beglobiai/ are allowed. No Crawl-delay. No terms page; footer says
// "©2024 Penkta Koja. All rights reserved" (we keep facts + photo links, not their texts).
//
// The site is WooCommerce: every dog is a "product" (a sponsorship item, button "Paremti") in
// category "Šunys" (product_cat id 15, slug "sunys"). Merchandise ("Atributika / Rūbai") is also a
// product, so we always filter by that category and check each item really carries
// "product_cat-sunys". REST gives name, link, photo id and modified date; the product text
// (content) was empty for every probed dog. Sex, age, size, health and status are not in the
// REST data, so they stay null / 'unknown' unless the content itself has "Label: value" lines.
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');
const H = require('../lib/html.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'penktakoja-1';
const ORIGIN = 'https://penktakoja.lt';
const DOG_CATEGORY_ID = 15;
const DOG_CATEGORY_CLASS = 'product_cat-sunys';
const DOG_CATEGORY_LABEL = 'Šunys'; // heading of https://penktakoja.lt/beglobiai/?product_cat=sunys
const FIELDS = 'id,link,title,modified_gmt,featured_media,content,product_cat,class_list';

const api = p => `${ORIGIN}/wp-json/wp/v2/${p}`;

function create({ perPage = 100, maxPages = 10 } = {}) {
  async function pageThrough(fetcher, makeUrl) {
    const items = [];
    for (let page = 1; page <= maxPages; page++) {
      let res;
      try { res = await fetcher.getJson(makeUrl(page)); }
      catch (e) {
        if (page > 1 && e.status === 400) return { items, complete: true }; // WP: page past the end
        throw e;
      }
      if (!Array.isArray(res.json)) throw new Error(`Unexpected JSON from ${res.url}`);
      items.push(...res.json);
      if (res.json.length < perPage) return { items, complete: true };
    }
    return { items, complete: false }; // hit maxPages: cannot prove we saw the end
  }

  async function collect({ fetcher, cache, log = () => {} }) {
    const products = await pageThrough(fetcher,
      p => api(`product?product_cat=${DOG_CATEGORY_ID}&per_page=${perPage}&page=${p}&_fields=${FIELDS}`));

    for (const p of products.items) {
      const classes = Object.values(p.class_list || {});
      if (!(p.product_cat || []).includes(DOG_CATEGORY_ID) || !classes.includes(DOG_CATEGORY_CLASS)) {
        throw new Error(`penktakoja: product ${p.id} is not in category ${DOG_CATEGORY_CLASS}; category id changed?`);
      }
    }

    const mediaIds = [...new Set(products.items.map(p => p.featured_media).filter(n => Number.isInteger(n) && n > 0))];
    const mediaUrl = new Map();
    for (let i = 0; i < mediaIds.length; i += 100) {
      const chunk = mediaIds.slice(i, i + 100);
      const res = await fetcher.getJson(api(`media?include=${chunk.join(',')}&per_page=100&_fields=id,source_url`));
      if (!Array.isArray(res.json)) throw new Error(`Unexpected JSON from ${res.url}`);
      for (const m of res.json) if (m && m.source_url) mediaUrl.set(m.id, m.source_url);
    }

    const animals = [];
    const skipped = [];
    const seen = new Set();
    for (const p of products.items) {
      if (seen.has(p.id)) continue; // a product can shift pages between requests
      seen.add(p.id);
      const content = p.content?.rendered || '';
      const labelled = await cache.getOrParse(sha256(content), PARSER_VERSION,
        () => L.fromPairs(L.pairsFromText(content)));
      const st = labelled.status
        ? { status: labelled.status, statusEvidence: labelled.statusEvidence }
        : { status: 'unknown', statusEvidence: null };
      if (st.status === 'excluded') { skipped.push({ nativeId: String(p.id), reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId: String(p.id),
        sourceUrl: p.link,
        name: N.cleanText(p.title?.rendered),
        species: labelled.species ?? N.species(DOG_CATEGORY_LABEL),
        sex: labelled.sex ?? null,
        age_text: labelled.age_text ?? null,
        size: labelled.size ?? null,
        vaccinated: labelled.vaccinated ?? null,
        neutered: labelled.neutered ?? null,
        chipped: labelled.chipped ?? null,
        photos: mediaUrl.has(p.featured_media) ? [mediaUrl.get(p.featured_media)] : [],
        bio_lt: N.cleanText(content), // excerpt is only a contact phone line, never read
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: p.modified_gmt ? `${p.modified_gmt}Z` : null,
      });
    }
    // Some real dogs have featured_media=0 while the product gallery contains
    // their photos. Read only those detail pages, never a site-wide logo/og image.
    for (const a of animals.filter(a => !a.photos.length)) {
      try {
        const page = await fetcher.get(a.sourceUrl);
        a.photos = await cache.getOrParse(page.hash, 'penktakoja-gallery-1', () => {
          const $ = H.load(page.body);
          return [...new Set($('.woocommerce-product-gallery__image a[href]').map((_, el) =>
            H.abs($(el).attr('href'), page.url)).get().filter(Boolean))];
        });
      } catch (error) { log(`penktakoja: missing-photo detail unavailable (${error.message})`); }
    }
    log(`penktakoja: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete: products.complete };
  }

  return {
    id: 'penktakoja',
    name: 'VšĮ „Penkta koja“',
    website: `${ORIGIN}/`,
    hosts: ['penktakoja.lt', 'www.penktakoja.lt'],
    collect,
  };
}

module.exports = create();
module.exports.create = create; // tests use a small perPage to exercise pagination
