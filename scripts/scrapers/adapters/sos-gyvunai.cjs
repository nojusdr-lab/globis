'use strict';
// VšĮ „SOS gyvūnai“, Vilnius (sos-gyvunai.lt). VMVT row 26.
// robots.txt (2026-11-16): Yoast block, "User-agent: *" + empty "Disallow:" = nothing disallowed.
// Terms page /tinklapio-taisykles/ only says "Informacija ruošiama"; privacy policy has no
// clause on copying or automated collection.
//
// Animals are the public WordPress REST type "gyvunas" (/wp-json/wp/v2/gyvunas) with one
// hierarchical taxonomy "gyvunai": "Visi gyvūnai", "Katės" / "Šunys" and their age groups
// (e.g. "Jaunos (6 mėn. - 2 m.)"). The site has no sex/status/vaccination fields: those facts
// are only in free prose, so we leave them null rather than guess from sentences.
//
// Status: the site menu groups the "Visi gyvūnai" list under "Dovanojami gyvūnai". We read that
// heading from the live listing page (1 request) and pass it through normalize.status(); only
// animals in the "Visi gyvūnai" term get it. An explicit word in the title or a short standalone
// line of the description ("Rezervuota", "Rado namus") overrides it with its own evidence.
//
// Requests per run: robots.txt, listing page, taxonomy terms, gyvunas pages (100 per page),
// media (100 ids per request). No per-animal detail pages: the REST record has everything shown.
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');
const H = require('../lib/html.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'sos-gyvunai-2';
const ORIGIN = 'https://sos-gyvunai.lt';
const LISTING_URL = `${ORIGIN}/visi-gyvunai/`;
const LIST_TERM_SLUG = 'visi-gyvunai';
const api = p => `${ORIGIN}/wp-json/wp/v2/${p}`;

// Heading of the menu group that contains the link to the listing page, e.g. "Dovanojami gyvūnai".
function listingHeading(html) {
  const $ = H.load(html);
  let heading = null;
  $('a[href]').each((_, a) => {
    if (heading) return;
    const href = H.abs($(a).attr('href'), LISTING_URL);
    if (!href || new URL(href).pathname !== '/visi-gyvunai/') return;
    const parentItem = $(a).closest('ul').closest('li');
    if (!parentItem.length) return;
    const title = N.cleanText(parentItem.children('a').first().find('.w-nav-title').first().text() || parentItem.children('a').first().text());
    if (title) heading = title;
  });
  return heading;
}

// Explicit per-animal status words. Title parts may say anything (incl. excluded); description
// lines only count when short and standalone, and only for reserved/adopted, so that story
// sentences like "Rasta pakelėje..." never drop an animal.
function explicitStatus(title, contentHtml) {
  for (const part of String(title || '').split(/\s[-–—|]\s|[()[\]]/)) {
    const s = N.status(part);
    if (s.status !== 'unknown' && s.status !== 'available') return s;
  }
  const lines = String(contentHtml || '').split(/\n|<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>/i)
    .map(l => N.cleanText(l)).filter(l => l && l.length <= 40);
  for (const line of lines) {
    const s = N.status(line.replace(/[!.]+$/, ''));
    if (s.status === 'reserved' || s.status === 'confirmed_adopted') return s;
  }
  return null;
}

// Description without the donation block (bank accounts, PayPal email, SMS number).
function bioWithoutDonations(html) {
  if (html == null) return null;
  const s = String(html);
  const cut = s.search(/Mokėjimo paskirtis/i);
  return cut >= 0 ? s.slice(0, cut) : s;
}

function createAdapter({ perPage = 100, maxPages = 30 } = {}) {
  async function pageThrough(fetcher, size, makeUrl) {
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
      if (res.json.length < size) return { items, complete: true };
    }
    return { items, complete: false };
  }

  async function collect({ fetcher, cache, log }) {
    let complete = true;

    const listing = await fetcher.get(LISTING_URL);
    const heading = await cache.getOrParse(listing.hash, PARSER_VERSION, () => listingHeading(listing.body));
    const listStatus = heading ? N.status(heading) : { status: 'unknown', statusEvidence: null };
    if (listStatus.status !== 'available') log(`sos-gyvunai: listing heading not recognised (${heading}); default status unknown`);

    const terms = await pageThrough(fetcher, 100, p => api(`gyvunai?per_page=100&page=${p}&_fields=id,name,slug,parent`));
    complete &&= terms.complete;
    const termById = new Map(terms.items.map(t => [t.id, { name: N.cleanText(t.name), slug: t.slug, parent: t.parent ?? 0 }]));

    const fields = 'id,link,title,modified_gmt,featured_media,content,gyvunai';
    const posts = await pageThrough(fetcher, perPage, p => api(`gyvunas?per_page=${perPage}&page=${p}&_fields=${fields}`));
    complete &&= posts.complete;

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
    for (const post of posts.items) {
      const postTerms = (post.gyvunai || []).map(id => termById.get(id)).filter(Boolean);
      const parsed = await cache.getOrParse(sha256(JSON.stringify(post)), PARSER_VERSION, () => {
        const html = post.content?.rendered ?? null;
        return {
          explicit: explicitStatus(N.cleanText(post.title?.rendered), html),
          labelled: L.fromPairs(L.pairsFromText(html)),
          bio: bioWithoutDonations(html),
        };
      });
      // Depth changed on 2026-11-18 ("Katės"/"Šunys" moved under "Visi gyvūnai"), so no level is assumed:
      // a species term is any term whose name is a species word; an age term is a child of a species term.
      const species = [...new Set(postTerms.map(t => N.species(t.name)).filter(Boolean))];
      const ageTerms = postTerms.filter(t => N.species(termById.get(t.parent)?.name));
      const inList = postTerms.some(t => t.slug === LIST_TERM_SLUG);
      const lab = parsed.labelled;

      const st = parsed.explicit
        ?? (lab.status ? { status: lab.status, statusEvidence: lab.statusEvidence } : null)
        ?? (inList ? listStatus : { status: 'unknown', statusEvidence: null });
      if (st.status === 'excluded') { skipped.push({ nativeId: String(post.id), reason: st.statusEvidence }); continue; }

      animals.push({
        nativeId: String(post.id),
        sourceUrl: post.link,
        name: N.cleanText(post.title?.rendered),
        species: species.length === 1 ? species[0] : lab.species ?? null, // several = ambiguous = unknown
        sex: lab.sex ?? null,
        age_text: ageTerms.length === 1 ? ageTerms[0].name : lab.age_text ?? null,
        size: lab.size ?? null,
        vaccinated: lab.vaccinated ?? null,
        neutered: lab.neutered ?? null,
        chipped: lab.chipped ?? null,
        photos: mediaUrl.has(post.featured_media) ? [mediaUrl.get(post.featured_media)] : [],
        bio_lt: parsed.bio,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: post.modified_gmt ? `${post.modified_gmt}Z` : null,
      });
    }
    log(`sos-gyvunai: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete };
  }

  return {
    id: 'sos-gyvunai',
    name: 'VšĮ „SOS gyvūnai“',
    website: `${ORIGIN}/`,
    hosts: ['sos-gyvunai.lt', 'www.sos-gyvunai.lt'],
    collect,
  };
}

module.exports = createAdapter();
module.exports.createAdapter = createAdapter;
module.exports._internal = { listingHeading, explicitStatus, bioWithoutDonations };
