'use strict';
// Marijampolės gyvūnų mylėtojų asociacija (mgma.lt). VMVT row 40.
// robots.txt (Yoast): "User-agent: *" + empty "Disallow:", nothing disallowed (probe 2026-11-16).
// No terms page found in the probe; a privacy/cookie page exists (/privatumo-ir-slapuku-politika/), not yet read.
//
// Animals are WooCommerce products (public WordPress REST type "product", URLs /gyvunas/<slug>/).
// The homepage block "Jie ieško laikinos globos arba naujų nuolatinių namų" shows them in
// two shop modules, "Šuneliai" and "Katinėliai" (product_cat slug "kaciukai").
// Other product categories hold given-away / found animals; we do not read those lists.
//
// Requests: robots.txt, product_cat list, products of animal-kind categories (100 per page),
// featured images (100 per request). No detail pages: the REST excerpt is the full animal text
// (content.rendered is empty on this site).
//
// Facts come only from page text:
// - title "Soja (skiepyta, čipuota)": name before "(", procedures listed inside it;
// - title status words ("Pūkenė padovanota 2026 11 11") go through normalize.status();
// - excerpt: standalone procedure phrases ("Sterilizuota.", "paženklinta mikroschema") when the
//   title does not say, and the "gimusi apie ..." phrase as age_text;
// - species from the category name (e.g. "Kačiukai"). Sex and size are not written as facts: null.
const N = require('../lib/normalize.cjs');
const H = require('../lib/html.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'mgma-1';
const ORIGIN = 'https://mgma.lt';
const api = p => `${ORIGIN}/wp-json/wp/v2/${p}`;

// Exact procedure words as written on mgma.lt (title brackets and excerpt sentences).
const PROCEDURES = {
  skiepyta: ['vaccinated', true], skiepytas: ['vaccinated', true],
  paskiepyta: ['vaccinated', true], paskiepytas: ['vaccinated', true],
  neskiepyta: ['vaccinated', false], neskiepytas: ['vaccinated', false],
  čipuota: ['chipped', true], čipuotas: ['chipped', true],
  ženklyta: ['chipped', true], ženklytas: ['chipped', true],
  paženklinta: ['chipped', true], paženklintas: ['chipped', true],
  'paženklinta mikroschema': ['chipped', true], 'paženklintas mikroschema': ['chipped', true],
  sterilizuota: ['neutered', true], sterilizuotas: ['neutered', true],
  kastruota: ['neutered', true], kastruotas: ['neutered', true],
  nesterilizuota: ['neutered', false], nesterilizuotas: ['neutered', false],
  nekastruota: ['neutered', false], nekastruotas: ['neutered', false],
};

// Status words that can appear inside a title after the name.
const STATUS_IN_TITLE = /(?<!\p{L})(rezervuot|padovanot|įvaikint|rado namus|grįžo namo|rast(?:a|as)(?!\p{L})|dovanojam)/iu;

function procedures(tokens) {
  const out = {};
  for (const raw of tokens) {
    const hit = PROCEDURES[N.fold(raw)];
    if (!hit) continue;
    const [field, value] = hit;
    if (field in out && out[field] !== value) out[field] = null; // page contradicts itself: unknown
    else if (!(field in out)) out[field] = value;
  }
  return out;
}

function parseTitle(title) {
  const text = N.cleanText(title) || '';
  const m = text.match(STATUS_IN_TITLE);
  const statusText = m ? text.slice(m.index) : null;
  const head = m ? text.slice(0, m.index) : text;
  const bracket = head.match(/\(([^)]*)\)/);
  const name = N.cleanText(head.replace(/\(.*$/, '').replace(/[\s,–-]+$/, '')) || null;
  const facts = bracket ? procedures(bracket[1].split(',')) : {};
  return { name, statusText, facts };
}

function parseExcerpt(html) {
  if (!html) return { bio: null, facts: {}, age_text: null };
  // The excerpt is one <p> with <br> line breaks and emoji images.
  const lines = String(html)
    .replace(/<img[^>]*>/gi, ' ')
    .split(/<br\b[^>]*>|<\/p>|<\/div>|<\/li>/i)
    .map(line => N.cleanText(H.load(`<div>${line}</div>`)('div').first().text()))
    .filter(Boolean)
    // Contact lines ("Marijampolė, skambinti tel. ...") are not part of the animal's story.
    .filter(line => !/skambinti|(?<!\p{L})tel\.|@/iu.test(line));
  const text = lines.join(' ');
  const tokens = text.split(/[.,;!]\s*/).map(s => s.trim()).filter(Boolean);
  const age = text.match(/(?<!\p{L})([Gg]imusi|[Gg]imęs|[Gg]imė)\s+((?:[^.!?]|\.(?=\s*[\p{Ll}\d]))+)/u);
  return {
    bio: text || null,
    facts: procedures(tokens),
    age_text: age ? N.cleanText(age[0]) : null,
  };
}

function createMgmaAdapter({ perPage = 100, maxPages = 20 } = {}) {
  async function pageThrough(fetcher, makeUrl) {
    const items = [];
    for (let page = 1; page <= maxPages; page++) {
      let res;
      try { res = await fetcher.getJson(makeUrl(page)); }
      catch (e) {
        if (page > 1 && e.status === 400) return { items, complete: true }; // WordPress: past the last page
        throw e;
      }
      if (!Array.isArray(res.json)) throw new Error(`Unexpected JSON from ${res.url}`);
      items.push(...res.json);
      if (res.json.length < perPage) return { items, complete: true };
    }
    return { items, complete: false }; // stopped at maxPages: cannot prove we reached the end
  }

  async function collect({ fetcher, cache, log }) {
    let complete = true;
    const cats = await pageThrough(fetcher, p => api(`product_cat?per_page=${perPage}&page=${p}&_fields=id,name,slug`));
    complete &&= cats.complete;
    // Only categories named after an animal kind ("Kačiukai", "Šuneliai"...). Others (given away,
    // found animals, shop items) are not read.
    const animalCats = new Map();
    for (const c of cats.items) {
      const species = N.species(N.cleanText(c.name));
      if (species) animalCats.set(c.id, { name: N.cleanText(c.name), species });
      else log(`mgma: category not read: ${N.cleanText(c.name)}`);
    }
    if (!animalCats.size) throw new Error('mgma: no animal category found in product_cat');

    const ids = [...animalCats.keys()].sort((a, b) => a - b).join(',');
    const fields = 'id,link,title,modified_gmt,featured_media,excerpt,product_cat';
    const posts = await pageThrough(fetcher, p => api(`product?product_cat=${ids}&per_page=${perPage}&page=${p}&_fields=${fields}`));
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
    const seen = new Set();
    for (const post of posts.items) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      const parsed = await cache.getOrParse(sha256(JSON.stringify(post)), PARSER_VERSION, () => {
        const t = parseTitle(post.title?.rendered);
        const e = parseExcerpt(post.excerpt?.rendered);
        return { t, e };
      });
      const { t, e } = parsed;
      const st = t.statusText ? N.status(t.statusText) : { status: 'unknown', statusEvidence: null };
      if (st.status === 'excluded') { skipped.push({ nativeId: String(post.id), reason: st.statusEvidence }); continue; }
      const kinds = [...new Set((post.product_cat || []).filter(c => animalCats.has(c)).map(c => animalCats.get(c).species))];
      const fact = f => (t.facts[f] ?? e.facts[f]) ?? null;
      animals.push({
        nativeId: String(post.id),
        sourceUrl: post.link,
        name: t.name,
        species: kinds.length === 1 ? kinds[0] : null,
        sex: null,
        age_text: e.age_text,
        size: null,
        vaccinated: fact('vaccinated'),
        neutered: fact('neutered'),
        chipped: fact('chipped'),
        photos: mediaUrl.has(post.featured_media) ? [mediaUrl.get(post.featured_media)] : [],
        bio_lt: e.bio,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: post.modified_gmt ? `${post.modified_gmt}Z` : null,
      });
    }
    log(`mgma: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete };
  }

  return {
    id: 'mgma',
    name: 'Marijampolės gyvūnų mylėtojų asociacija',
    website: 'https://mgma.lt/',
    hosts: ['mgma.lt', 'www.mgma.lt'],
    collect,
  };
}

module.exports = createMgmaAdapter();
module.exports.createMgmaAdapter = createMgmaAdapter;
module.exports.parseTitle = parseTitle;
module.exports.parseExcerpt = parseExcerpt;
