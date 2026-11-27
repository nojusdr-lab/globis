'use strict';
// VšĮ „Būk mano draugas“, Klaipėda (bukmanodraugas.lt). VMVT row 7.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// No terms, privacy or copyright page linked on the site (checked home + both listing pages).
//
// WordPress. Animals are ordinary posts in the categories
//   sunys-iesko-namu ("Šunys ieško namų", id 38) and kates-iesko-namu ("Katės ieško namų", id 39).
// The HTML listings (The Grid plugin) show only name + photo, so we read the same posts through
// the public REST API instead: 1 request for category ids, posts in pages of 100, and 1 request
// per 100 photos. Each animal page is then read once (its "Duomenys" block states
// "Amžius:", "Lytis:", "Ūgis:" — not in REST; added 2026-11-20). We never list /category/rado-namus/ (adopted animals);
// we only look up its id so that a post still sitting in a listing AND marked "Rado namus"
// keeps that real status.
//
// Posts are free prose ("Pepsis – vidutinio ūgio šunelis ..."). We only take:
//   species + status from the category name the site shows on every card,
//   "Label: value" lines if a post ever has them, the title, the text and the featured photo.
// Sex, age, size, vaccinated, neutered, chipped stay null unless a label line states them.
// A failed animal page keeps the REST facts.
const N = require('../lib/normalize.cjs');
const { readWordpressPages } = require('../lib/wordpress-pages.cjs');
const L = require('../lib/labels.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'bukmanodraugas-1';
const DETAIL_VERSION = 'bukmanodraugas-detail-1';
const BASE = 'https://bukmanodraugas.lt/';
const LISTING_SLUGS = ['sunys-iesko-namu', 'kates-iesko-namu'];
const ADOPTED_SLUG = 'rado-namus';
const api = p => `${BASE}wp-json/wp/v2/${p}`;

// "Šunys ieško namų" -> species from the first word, status from the rest ("ieško namų").
function readCategory(name) {
  const text = N.cleanText(name);
  if (!text) return { species: null, status: { status: 'unknown', statusEvidence: null } };
  const species = N.species(text);
  const rest = species ? text.replace(/^\S+\s+/, '') : text;
  return { species, status: N.status(rest) };
}

function create({ perPage = 100, maxPages = 20 } = {}) {
  async function pageThrough(fetcher, makeUrl) {
    return readWordpressPages(fetcher, makeUrl, { perPage, maxPages });
  }

  async function collect({ fetcher, cache, log = () => {} }) {
    const slugs = [...LISTING_SLUGS, ADOPTED_SLUG].join(',');
    const catRes = await fetcher.getJson(api(`categories?slug=${slugs}&per_page=100&_fields=id,name,slug`));
    if (!Array.isArray(catRes.json)) throw new Error(`Unexpected JSON from ${catRes.url}`);
    const bySlug = new Map(catRes.json.map(c => [c.slug, c]));
    for (const s of LISTING_SLUGS) if (!bySlug.has(s)) throw new Error(`Category not found: ${s}`);
    const listingIds = LISTING_SLUGS.map(s => bySlug.get(s).id);
    const known = new Map(catRes.json.map(c => [c.id, { slug: c.slug, name: N.cleanText(c.name), ...readCategory(c.name) }]));

    const fields = 'id,link,title,modified_gmt,featured_media,content,categories';
    const posts = await pageThrough(fetcher,
      p => api(`posts?categories=${listingIds.join(',')}&per_page=${perPage}&page=${p}&_fields=${fields}`));

    const mediaIds = [...new Set(posts.items.map(p => p.featured_media).filter(n => Number.isInteger(n) && n > 0))];
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
    for (const post of posts.items) {
      const nativeId = String(post.id);
      if (seen.has(nativeId)) continue; // a post in both listings comes once
      seen.add(nativeId);
      const parsed = await cache.getOrParse(sha256(JSON.stringify([post, catRes.json])), PARSER_VERSION, () => {
        const cats = (post.categories || []).map(id => known.get(id)).filter(Boolean);
        const listing = cats.filter(c => LISTING_SLUGS.includes(c.slug));
        const adopted = cats.find(c => c.slug === ADOPTED_SLUG);
        const speciesSet = [...new Set(listing.map(c => c.species))];
        let status = { status: 'unknown', statusEvidence: null };
        if (adopted && adopted.status.status !== 'unknown') status = adopted.status;
        else {
          const statuses = [...new Set(listing.map(c => c.status.status))];
          if (statuses.length === 1) status = listing[0].status;
        }
        return {
          inListing: listing.length > 0,
          species: speciesSet.length === 1 ? speciesSet[0] : null, // dog + cat = ambiguous = unknown
          status,
          labelled: L.fromPairs(L.pairsFromText(post.content?.rendered)),
        };
      });
      if (!parsed.inListing) { skipped.push({ nativeId, reason: 'not in a listing category' }); continue; }
      const lab = parsed.labelled;
      const st = lab.status && lab.status !== 'unknown' ? { status: lab.status, statusEvidence: lab.statusEvidence } : parsed.status;
      if (st.status === 'excluded') { skipped.push({ nativeId, reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId,
        sourceUrl: post.link,
        name: N.cleanText(post.title?.rendered),
        species: lab.species ?? parsed.species,
        sex: lab.sex ?? null,
        age_text: lab.age_text ?? null,
        size: lab.size ?? null,
        vaccinated: lab.vaccinated ?? null,
        neutered: lab.neutered ?? null,
        chipped: lab.chipped ?? null,
        photos: mediaUrl.has(post.featured_media) ? [mediaUrl.get(post.featured_media)] : [],
        bio_lt: post.content?.rendered ?? null,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: post.modified_gmt ? `${post.modified_gmt}Z` : null,
      });
    }
    for (const a of animals) {
      let res;
      try { res = await fetcher.get(a.sourceUrl); }
      catch (e) { log(`${a.sourceUrl}: detail not read (${e.message})`); continue; }
      const d = await cache.getOrParse(sha256(res.body), DETAIL_VERSION, () => L.fromPairs(L.pairsFromHtml(res.body)));
      for (const k of ['sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped']) if (d[k] != null) a[k] = d[k];
    }
    log(`bukmanodraugas: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete: posts.complete };
  }

  return {
    id: 'bukmanodraugas',
    name: 'VšĮ „Būk mano draugas“, Klaipėda',
    website: BASE,
    hosts: ['bukmanodraugas.lt', 'www.bukmanodraugas.lt'],
    collect,
  };
}

module.exports = create();
module.exports.create = create; // tests use a small perPage to exercise pagination
