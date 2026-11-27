'use strict';
// VMVT row 56: the registry Facebook profile links to the same organization
// as egzoticsos.lt (homepage links back to pagalba.egzotinei.faunai).
// Checked 2026-11-19: robots disallows /wp-admin/ only. The linked privacy
// policy contains no collection prohibition; no separate terms link found.
// This is an access review, not a licence to republish descriptions/photos.
// The visible shop filter is Ieško namų, product_cat slug iesko-namu. Read
// only that category, not all 1500+ historical/found/quarantined products.
const N = require('../lib/normalize.cjs');
const { readWordpressPages } = require('../lib/wordpress-pages.cjs');
const L = require('../lib/labels.cjs');
const { sha256 } = require('../lib/hash.cjs');
const BASE = 'https://egzoticsos.lt/';
const api = suffix => `${BASE}wp-json/wp/v2/${suffix}`;
// Full animal-kind labels observed in the public taxonomy, not short codes
// such as Pau/Rop/Grauz and not a guess from the animal's name or photograph.
const OTHER = new Set(['banguotoji papūga', 'bestuburiai', 'degu', 'dekoratyvinės žiurkės',
  'dekoratyviniai triušiai', 'džiungarijos žiurkėnai', 'graužikai', 'griaužikai', 'gyvalazdės',
  'jūrų kiaulytės', 'mėsiniai triušiai', 'papūgos', 'paukščiai', 'roborovskio žiurkėnai',
  'ropliai', 'šeškai', 'šinšilos', 'sirijos žiurkėnai', 'smiltpelės', 'sraigės', 'triušis',
  'vandens vėžlys', 'varliagyviai', 'vėžliai', 'voragyviai', 'žemės ūkio gyvūnai', 'žinduolis',
  'žuvys', 'žvirbliniai']);

function create({ perPage = 100, maxPages = 30 } = {}) {
  async function pages(fetcher, makeUrl, size = perPage) {
    return readWordpressPages(fetcher, makeUrl, { perPage: size, maxPages });
  }

  async function collect({ fetcher, cache, log = () => {} }) {
    const cats = await pages(fetcher, p => api(`product_cat?per_page=100&page=${p}&_fields=id,name,slug`), 100);
    const byId = new Map(cats.items.map(c => [c.id, c]));
    const available = cats.items.filter(c => c.slug === 'iesko-namu');
    if (available.length !== 1 || N.status(available[0].name).status !== 'available') {
      throw Error('egzoticsos: the visible Ieško namų category changed or is missing');
    }
    const tags = await pages(fetcher, p => api(`product_tag?per_page=100&page=${p}&_fields=id,name,slug`), 100);
    const tagNames = new Map(tags.items.map(t => [t.id, N.cleanText(t.name)]));
    const category = available[0];
    const fields = 'id,link,title,content,modified_gmt,featured_media,product_cat,product_tag,class_list';
    const posts = await pages(fetcher, p => api(`product?product_cat=${category.id}&per_page=${perPage}&page=${p}&orderby=id&order=asc&_fields=${fields}`));
    let complete = cats.complete && tags.complete && posts.complete;
    const seen = new Set(), unique = [];
    for (const post of posts.items) {
      if (!Number.isInteger(post.id) || post.id < 1 || !(post.product_cat || []).includes(category.id) ||
          !Object.values(post.class_list || {}).includes('product_cat-iesko-namu')) {
        throw Error(`egzoticsos: product ${post.id} is outside the public adoption category`);
      }
      if (seen.has(post.id)) { complete = false; continue; } // changing pages are not a full snapshot
      seen.add(post.id); unique.push(post);
    }
    const media = new Map();
    const ids = [...new Set(unique.map(p => p.featured_media).filter(id => Number.isInteger(id) && id > 0))];
    for (let i = 0; i < ids.length; i += 100) {
      const res = await fetcher.getJson(api(`media?include=${ids.slice(i, i + 100).join(',')}&per_page=100&_fields=id,source_url`));
      if (!Array.isArray(res.json)) throw Error('egzoticsos: invalid media response');
      for (const m of res.json) if (m.source_url) media.set(m.id, m.source_url);
    }
    const animals = [], skipped = [];
    for (const post of unique) {
      const parsed = await cache.getOrParse(sha256(JSON.stringify([post, cats.items, tags.items])), 'egzoticsos-1', () => {
        const categories = (post.product_cat || []).map(id => byId.get(id)).filter(Boolean);
        const excluded = categories.map(c => c.slug === 'rasti'
          ? { status: 'excluded', statusEvidence: N.cleanText(c.name) } : N.status(c.name)).find(s => s.status === 'excluded');
        const adopted = categories.map(c => N.status(c.name)).find(s => s.status === 'confirmed_adopted');
        const quarantined = categories.some(c => c.slug === 'gydomi-karantinuojami');
        const labelled = L.fromPairs(L.pairsFromText(post.content?.rendered));
        const status = excluded || adopted || (quarantined ? { status: 'unknown', statusEvidence: null }
          : labelled.status && labelled.status !== 'unknown' ? { status: labelled.status, statusEvidence: labelled.statusEvidence }
            : N.status(category.name));
        const kinds = new Set((post.product_tag || []).map(id => tagNames.get(id)).filter(Boolean)
          .map(name => N.species(name) || (OTHER.has(N.fold(name)) ? 'other' : null)).filter(Boolean));
        return { labelled, status, species: kinds.size === 1 ? [...kinds][0] : null };
      });
      if (parsed.status.status === 'excluded') { skipped.push({ nativeId: String(post.id), reason: parsed.status.statusEvidence }); continue; }
      const lab = parsed.labelled;
      animals.push({ nativeId: String(post.id), sourceUrl: post.link, name: N.cleanText(post.title?.rendered),
        species: lab.species ?? parsed.species, sex: lab.sex ?? null, age_text: lab.age_text ?? null,
        size: lab.size ?? null, chipped: lab.chipped ?? null, vaccinated: lab.vaccinated ?? null, neutered: lab.neutered ?? null,
        photos: media.has(post.featured_media) ? [media.get(post.featured_media)] : [],
        bio_lt: post.content?.rendered ?? null, status: parsed.status.status, statusEvidence: parsed.status.statusEvidence,
        sourceUpdatedAt: post.modified_gmt ? `${post.modified_gmt}Z` : null });
    }
    log(`egzoticsos: ${animals.length} records, ${skipped.length} excluded; complete=${complete}`);
    return { animals, skipped, complete };
  }
  return { id: 'egzoticsos', name: 'VšĮ „EgzoticSOS“', website: BASE,
    hosts: ['egzoticsos.lt', 'www.egzoticsos.lt'], collect };
}
module.exports = create();
module.exports.create = create;
