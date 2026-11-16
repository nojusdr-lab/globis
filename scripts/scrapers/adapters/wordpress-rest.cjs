'use strict';
// Shared adapter for WordPress shelter sites that publish animals through the
// public WordPress REST API (/wp-json/wp/v2/<type>). Same data the site shows to
// every visitor, in a structured form, so we read far fewer pages.
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');

const PARSER_VERSION = 'wp-rest-1';

function createWordpressAdapter(config) {
  const { id, name, base, restBase, taxonomies = {}, perPage = 100, maxPages = 30, defaults = {} } = config;
  const origin = new URL(base).origin;
  const api = p => `${origin}/wp-json/wp/v2/${p}`;

  async function pageThrough(fetcher, makeUrl) {
    const items = [];
    for (let page = 1; page <= maxPages; page++) {
      let res;
      try { res = await fetcher.getJson(makeUrl(page)); }
      catch (e) {
        if (page > 1 && e.status === 400) return { items, complete: true }; // past the last page
        throw e;
      }
      if (!Array.isArray(res.json)) throw new Error(`Unexpected JSON from ${res.url}`);
      items.push(...res.json);
      if (res.json.length < perPage) return { items, complete: true };
    }
    return { items, complete: false }; // hit maxPages: do not trust as complete
  }

  async function collect({ fetcher, cache, log }) {
    const termNames = {};
    let complete = true;
    for (const tax of Object.keys(taxonomies)) {
      const r = await pageThrough(fetcher, p => api(`${tax}?per_page=100&page=${p}&_fields=id,name`));
      complete &&= r.complete;
      termNames[tax] = new Map(r.items.map(t => [t.id, N.cleanText(t.name)]));
    }
    const fields = ['id', 'link', 'title', 'modified_gmt', 'featured_media', 'content', ...Object.keys(taxonomies)].join(',');
    const posts = await pageThrough(fetcher, p => api(`${restBase}?per_page=${perPage}&page=${p}&_fields=${fields}`));
    complete &&= posts.complete;

    const mediaIds = [...new Set(posts.items.map(p => p.featured_media).filter(n => Number.isInteger(n) && n > 0))];
    const mediaUrl = new Map();
    for (let i = 0; i < mediaIds.length; i += 100) {
      const chunk = mediaIds.slice(i, i + 100);
      const res = await fetcher.getJson(api(`media?include=${chunk.join(',')}&per_page=100&_fields=id,source_url`));
      for (const m of res.json || []) if (m && m.source_url) mediaUrl.set(m.id, m.source_url);
    }

    const animals = [];
    const skipped = [];
    for (const post of posts.items) {
      const parsed = await cache.getOrParse(require('../lib/hash.cjs').sha256(JSON.stringify(post)), PARSER_VERSION, () => {
        const termText = {};
        for (const [tax, field] of Object.entries(taxonomies)) {
          const names = (post[tax] || []).map(tid => termNames[tax].get(tid)).filter(Boolean);
          termText[field] = names.length === 1 ? names[0] : null; // several terms = ambiguous = unknown
        }
        return { termText, labelled: L.fromPairs(L.pairsFromText(post.content?.rendered)) };
      });
      const t = parsed.termText;
      const labelled = parsed.labelled;
      const st = t.status ? N.status(t.status) : labelled.status ? { status: labelled.status, statusEvidence: labelled.statusEvidence } : { status: defaults.status ?? 'unknown', statusEvidence: defaults.statusEvidence ?? null };
      if (st.status === 'excluded') { skipped.push({ nativeId: String(post.id), reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId: String(post.id),
        sourceUrl: post.link,
        name: N.cleanText(post.title?.rendered),
        species: (t.species && N.species(t.species)) ?? labelled.species ?? defaults.species ?? null,
        sex: (t.sex && N.sex(t.sex)) ?? labelled.sex ?? null,
        age_text: t.age_text ?? labelled.age_text ?? null,
        size: (t.size && N.size(t.size)) ?? labelled.size ?? null,
        vaccinated: labelled.vaccinated ?? null,
        neutered: labelled.neutered ?? null,
        chipped: labelled.chipped ?? null,
        photos: mediaUrl.has(post.featured_media) ? [mediaUrl.get(post.featured_media)] : [],
        bio_lt: post.content?.rendered ?? null,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: post.modified_gmt ? `${post.modified_gmt}Z` : null,
      });
    }
    log(`${id}: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete };
  }

  return { id, name, website: base, hosts: [new URL(base).hostname], collect };
}

module.exports = { createWordpressAdapter };
