'use strict';
// VšĮ „Mažas draugas“, Panevėžys (www.mazasdraugas.lt). VMVT row 42.
// robots.txt (Yoast): "User-agent: *" + empty "Disallow:", nothing disallowed (probe 2026-11-16).
// Terms: no terms page found. Privacy page (/privatumo-politika/) covers cookies and adopters'
// personal data only; nothing about copying or automated collection. Footer: "Visos teisės saugomos".
//
// Animals are ordinary WordPress posts. The listing page /dovanojami-gyvunai/ (Elementor posts
// grid) shows posts of two categories, linked from the menu: "Dovanojamos Katės"
// (slug dovanojamos-kates, id 34 in the probe) and "Dovanojami Šunys" (slug dovanojami-sunys, id 35).
// We read only those two categories through the public REST API. Success stories
// ("Sėkmės istorijos") are not read.
//
// Requests: robots.txt, one categories lookup by slug, posts of the two categories (100 per page).
// No detail pages and no media requests: content.rendered is the full animal page, and the photos
// are the <img> tags inside it.
//
// Facts come only from page text (Lithuanian part of each post):
// - "♥ Gimė: 2018-06" (or "♥ Apie 2 metus") -> age_text;
// - "♥ Kastruotas, skiepytas, čipuotas." -> neutered / vaccinated / chipped (a word that is not
//   written stays null, never false);
// - species from the category ("Dovanojami Šunys" -> dog, "Dovanojamos Katės" -> cat);
// - status: the category name ("Dovanojami ...") via normalize.status(), unless the title or a short
//   standalone line says otherwise (e.g. "rezervuota").
// Sex is not written as a label (only implied by word endings): null. Size: not written ("Ūgis: 37cm"
// is a height, not a size class): null.
const N = require('../lib/normalize.cjs');
const H = require('../lib/html.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'mazasdraugas-1';
const ORIGIN = 'https://www.mazasdraugas.lt';
const api = p => `${ORIGIN}/wp-json/wp/v2/${p}`;

// The two listing categories and the species each one names.
const CATEGORIES = { 'dovanojami-sunys': 'dog', 'dovanojamos-kates': 'cat' };

const PROCEDURES = {
  skiepytas: ['vaccinated', true], skiepyta: ['vaccinated', true],
  paskiepytas: ['vaccinated', true], paskiepyta: ['vaccinated', true],
  neskiepytas: ['vaccinated', false], neskiepyta: ['vaccinated', false],
  čipuotas: ['chipped', true], čipuota: ['chipped', true],
  paženklintas: ['chipped', true], paženklinta: ['chipped', true],
  kastruotas: ['neutered', true], kastruota: ['neutered', true],
  sterilizuotas: ['neutered', true], sterilizuota: ['neutered', true],
  nekastruotas: ['neutered', false], nekastruota: ['neutered', false],
  nesterilizuotas: ['neutered', false], nesterilizuota: ['neutered', false],
};

// Status words that can follow the name in a title ("Vardas (rezervuota)").
const STATUS_IN_TITLE = /(?<!\p{L})(rezervuot|padovanot|įvaikint|rado namus|grįžo namo|dovanojam)/iu;
// Lines that end the Lithuanian part of a post (English copy, contact block).
const STOP = /^(---$|♥?\s*born\b|about\b|kontaktai\b|\[kontaktai)/i;

function procedures(tokens) {
  const out = {};
  for (const raw of tokens) {
    const hit = PROCEDURES[N.fold(raw)];
    if (!hit) continue;
    const [field, value] = hit;
    if (field in out && out[field] !== value) out[field] = null; // contradicts itself: unknown
    else if (!(field in out)) out[field] = value;
  }
  return out;
}

function contentLines(html) {
  // Pasted post HTML has stray closing tags, so read the whole document, not a wrapper element.
  const $ = H.load(String(html || ''));
  $('script,style').remove();
  $('br').replaceWith('\n');
  $('hr').replaceWith('\n---\n');
  $('p,div,li,h1,h2,h3,h4,h5,h6,section').append('\n');
  return $.root().text().split('\n').map(l => N.cleanText(l)).filter(Boolean);
}

function parseContent(html) {
  const lines = contentLines(html);
  const end = lines.findIndex(l => STOP.test(l));
  const lt = end === -1 ? lines : lines.slice(0, end);
  const aboutAt = lt.findIndex(l => /^apie\s.{1,40}:$/i.test(l));
  const head = aboutAt === -1 ? lt.filter(l => l.startsWith('♥')) : lt.slice(0, aboutAt);
  // Without an "Apie X:" header the story is the lines that are not "♥ ..." facts or a "♠ <town>" note.
  const body = aboutAt === -1 ? lt.filter(l => !/^[♥♠]/.test(l)) : lt.slice(aboutAt + 1);

  let age_text = null;
  const tokens = [];
  for (const line of head) {
    const l = line.replace(/^♥\s*/, '');
    const age = l.match(/^(gimė|gimęs|gimusi)\s*:\s*(.+?)[\s,;.]*$/i);
    if (age) { age_text ??= N.cleanText(`${age[1]}: ${age[2]}`); continue; }
    // "♥ Apie 2 metus" / "♥ Apie 3 metai" (page 2 of the list, 2026-11-16 probe).
    const about = l.match(/^apie\s+\d+([.,]\d+)?\s*(metus|metai|metų|mėn\.?|mėnesius|mėnesiai|mėnesių)(?!\p{L})/iu);
    if (about) { age_text ??= N.cleanText(about[0]); continue; }
    tokens.push(...l.split(/[.,;]\s*/).map(s => s.trim()).filter(Boolean));
  }

  // A short standalone line such as "Rezervuota" is a status note from the shelter.
  let statusText = null;
  for (const line of lt) {
    if (line.split(/\s+/).length > 3) continue;
    const s = N.status(line.replace(/^♥\s*/, ''));
    if (s.status === 'reserved' || s.status === 'confirmed_adopted') { statusText = s.statusEvidence; break; }
  }

  const $ = H.load(String(html || ''));
  const photos = [];
  $('img').each((_, img) => {
    const src = H.imgSrc($(img), `${ORIGIN}/`);
    if (src && /\/wp-content\/uploads\//.test(src) && !photos.includes(src)) photos.push(src);
  });

  return { age_text, facts: procedures(tokens), bio: body.join('\n') || null, statusText, photos };
}

function parseTitle(title) {
  const text = N.cleanText(title) || '';
  const m = text.match(STATUS_IN_TITLE);
  const statusText = m ? N.cleanText(text.slice(m.index).replace(/\)\s*$/, '')) : null;
  const name = N.cleanText((m ? text.slice(0, m.index) : text).replace(/[\s(,–-]+$/, '')) || null;
  return { name, statusText };
}

function createMazasdraugasAdapter({ perPage = 100, maxPages = 20 } = {}) {
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
    const slugs = Object.keys(CATEGORIES);
    const catRes = await fetcher.getJson(api(`categories?slug=${slugs.join(',')}&_fields=id,name,slug`));
    if (!Array.isArray(catRes.json)) throw new Error(`Unexpected JSON from ${catRes.url}`);
    const cats = new Map();
    for (const c of catRes.json) {
      if (c && CATEGORIES[c.slug]) cats.set(c.id, { name: N.cleanText(c.name), species: CATEGORIES[c.slug] });
    }
    if (!cats.size) throw new Error('mazasdraugas: listing categories not found');
    if (cats.size < slugs.length) {
      complete = false; // one listing category is gone: the list would be half the shelter
      log(`mazasdraugas: only ${cats.size} of ${slugs.length} listing categories found`);
    }

    const ids = [...cats.keys()].sort((a, b) => a - b).join(',');
    const fields = 'id,link,title,modified_gmt,categories,content';
    const posts = await pageThrough(fetcher, p => api(`posts?categories=${ids}&per_page=${perPage}&page=${p}&_fields=${fields}`));
    complete &&= posts.complete;

    const animals = [];
    const skipped = [];
    const seen = new Set();
    for (const post of posts.items) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      const { t, c } = await cache.getOrParse(sha256(JSON.stringify(post)), PARSER_VERSION, () => ({
        t: parseTitle(post.title?.rendered),
        c: parseContent(post.content?.rendered),
      }));
      const own = (post.categories || []).filter(id => cats.has(id)).map(id => cats.get(id));
      const kinds = [...new Set(own.map(k => k.species))];
      const noteText = t.statusText ?? c.statusText;
      const st = noteText ? N.status(noteText)
        : own.length === 1 ? N.status(own[0].name)
        : { status: 'unknown', statusEvidence: null };
      if (st.status === 'excluded') { skipped.push({ nativeId: String(post.id), reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId: String(post.id),
        sourceUrl: post.link,
        name: t.name,
        species: kinds.length === 1 ? kinds[0] : null,
        sex: null,
        age_text: c.age_text,
        size: null,
        vaccinated: c.facts.vaccinated ?? null,
        neutered: c.facts.neutered ?? null,
        chipped: c.facts.chipped ?? null,
        photos: c.photos,
        bio_lt: c.bio,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: post.modified_gmt ? `${post.modified_gmt}Z` : null,
      });
    }
    log(`mazasdraugas: ${animals.length} animals, ${skipped.length} skipped`);
    return { animals, skipped, complete };
  }

  return {
    id: 'mazasdraugas',
    name: 'VšĮ „Mažas draugas“',
    website: 'https://www.mazasdraugas.lt/',
    hosts: ['www.mazasdraugas.lt', 'mazasdraugas.lt'],
    collect,
  };
}

module.exports = createMazasdraugasAdapter();
module.exports.createMazasdraugasAdapter = createMazasdraugasAdapter;
module.exports.parseTitle = parseTitle;
module.exports.parseContent = parseContent;
