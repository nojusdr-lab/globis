'use strict';
// VšĮ „Naminukai“, Vilnius (naminukai.com; VMVT lists only Facebook, the .lt domain is dead).
// robots.txt (2026-11-17): "User-agent: *", "Disallow: /wp-admin/" (+ Allow admin-ajax.php).
// No terms page found.
//
// Every animal is a top-level WordPress page (Elementor), e.g. https://naminukai.com/otas/.
// Who is on offer now: the pages linked from /sunys/ (dogs) and /kates/ (cats); adopted animals
// sit under /padovanoti/ and are never read. Facts come from the page's REST content, which
// starts with a fixed header: "OTAS Mišrūnas ♂ AMŽIUS DYDIS KASTRACIJA ~5 metai Vidutinis Atlikta",
// then the story. Requests per run: robots.txt + 2 listing pages + 2 REST pages of 100.
const N = require('../lib/normalize.cjs');
const H = require('../lib/html.cjs');

const PARSER_VERSION = 'naminukai-1';
const ORIGIN = 'https://naminukai.com';
const HOSTS = ['naminukai.com', 'www.naminukai.com'];
const LISTINGS = { dog: `${ORIGIN}/sunys/`, cat: `${ORIGIN}/kates/` };

function slugOf(href) {
  try {
    const u = new URL(href);
    const parts = u.pathname.split('/').filter(Boolean);
    return HOSTS.includes(u.hostname) && parts.length === 1 && !/^wp-|\./.test(parts[0]) ? parts[0] : null;
  } catch { return null; }
}

function listedSlugs(html) {
  const $ = H.load(html);
  return [...new Set($('a[href]').map((_, a) => slugOf($(a).attr('href'))).get().filter(Boolean))];
}

function sizeOf(word) {
  if (/^(ne|nei)d/i.test(word)) return 'small'; // "Nedidelis", "Nedidelė", typo "Neidelė"
  return N.size(word.replace(/^viduinis$/i, 'vidutinis').replace(/iai$/i, 'is'));
}

// Header + story from a page's rendered content. Returns null when the header is missing.
function parsePage(html) {
  const $ = H.load(html.replace(/<\/(?:p|h\d|li|div)>|<br\s*\/?>/gi, ' $&')); // keep a space between blocks
  const text = N.cleanText($.root().text());
  const m = text && text.match(/^(.*?)\s*([♂♀])?\s*AMŽIUS\s+DYDIS\s+KASTRACIJA\s+(.+?)\s+(\S+)\s+(Atlikta|Neatlikta)\b\s*(.*)$/su);
  if (!m) return null;
  const photos = [...new Set($('img').map((_, img) => H.imgSrc($(img), ORIGIN)).get()
    .filter(src => src && /\/wp-content\/uploads\//.test(src) && !/logo/i.test(src)))];
  return {
    sex: m[2] === '♂' ? 'male' : m[2] === '♀' ? 'female' : null,
    age_text: m[3].replace(/^~\s*/, '~'),
    size: sizeOf(m[4]),
    neutered: m[5] === 'Atlikta',
    bio_lt: N.cleanText(m[6]) || null,
    photos,
  };
}

function titleCase(name) {
  const t = N.cleanText(name);
  return t ? t.charAt(0) + t.slice(1).toLocaleLowerCase('lt') : null;
}

module.exports = {
  id: 'naminukai',
  name: 'VšĮ „Naminukai“',
  website: `${ORIGIN}/`,
  hosts: HOSTS,
  async collect({ fetcher, cache, log = () => {} }) {
    const speciesBySlug = new Map();
    for (const [species, url] of Object.entries(LISTINGS)) {
      const page = await fetcher.get(url);
      for (const slug of await cache.getOrParse(page.hash, PARSER_VERSION, () => listedSlugs(page.body))) {
        if (!speciesBySlug.has(slug)) speciesBySlug.set(slug, species);
      }
    }

    const pages = [];
    let complete = false;
    for (let n = 1; n <= 5; n++) {
      const res = await fetcher.getJson(`${ORIGIN}/wp-json/wp/v2/pages?per_page=100&page=${n}&_fields=id,slug,link,title,content,modified_gmt`);
      if (!Array.isArray(res.json)) throw new Error(`Unexpected JSON from ${res.url}`);
      pages.push(...res.json);
      if (res.json.length < 100) { complete = true; break; }
    }

    const animals = [];
    const skipped = [];
    for (const p of pages) {
      const species = speciesBySlug.get(p.slug);
      if (!species) continue; // not on a current listing (adopted, or a site page)
      const html = p.content?.rendered || '';
      const facts = parsePage(html);
      if (!facts) { skipped.push({ nativeId: p.slug, reason: 'no AMŽIUS/DYDIS header' }); continue; }
      animals.push({
        nativeId: p.slug,
        sourceUrl: p.link,
        name: titleCase(p.title?.rendered),
        species,
        ...facts,
        vaccinated: null,
        chipped: null,
        status: 'available',
        statusEvidence: species === 'dog' ? 'listed on /sunys/' : 'listed on /kates/',
        sourceUpdatedAt: p.modified_gmt ? `${p.modified_gmt}Z` : null,
      });
    }
    if (!animals.length) throw new Error('naminukai: no animals parsed (layout changed?)');
    log(`naminukai: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete };
  },
};

module.exports._test = { parsePage, listedSlugs, sizeOf };
