'use strict';
// VšĮ Gyvūnų prieglauda „Padėk man“ / „Gyvūnų šansas“, Visaginas (padekman.lt). VMVT row 39.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// No terms/privacy/copyright page found on the site (only a "© 2021" footer line).
//
// Animals are WordPress "portfolio-item" posts (Mikado "pawfriends" theme). That type is NOT in
// /wp-json/wp/v2/types, so REST cannot be used. The theme's HTML lists page only by AJAX POST
// (and /portfolio-category/ishchut-dom/page/2/ returns the same cards as page 1), so:
// 1. List = the standard WordPress RSS feed of the category "Ieško namų" (slug ishchut-dom):
//    /portfolio-category/ishchut-dom/feed/?paged=N, 10 items per page, walked until a short,
//    empty or 404 page. A repeated item means paging is not working -> error (run fails).
//    The feed has no category labels, so it is used only to find the animals (id, link, name).
// 2. Each animal's own page (one GET per animal, ≥5 s apart) gives what the list cannot:
//    category labels (status "Ieško namų"/"Rado namus", species "Šunys"/"Katės"), the labelled
//    facts (Lytis, Amžius, Sterilizacija, Čipizacija, Skiepijimas), photo and description.
//    The contact block ("Daugiau informacija:" + phone + volunteer name) is never copied.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');

const ORIGIN = 'https://padekman.lt';
const FEED = `${ORIGIN}/portfolio-category/ishchut-dom/feed/`;
const MAX_PAGES = 30;

const feedUrl = page => (page === 1 ? FEED : `${FEED}?paged=${page}`);

function decodeXml(s) {
  return N.cleanText(String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))));
}

// RSS items -> { nativeId, sourceUrl, name }. Throws if the page is not this category's feed.
function parseFeed(xml, pageUrl) {
  if (!/<rss\b/.test(xml) || !/<channel>/.test(xml)) throw new Error(`padekman: not an RSS feed at ${pageUrl}`);
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const guid = decodeXml((it.match(/<guid\b[^>]*>([\s\S]*?)<\/guid>/) || [])[1]);
    const id = (guid || '').match(/[?&]p=(\d+)\b/);
    const link = decodeXml((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    if (!id || !link) throw new Error(`padekman: feed item without id or link at ${pageUrl}`);
    const url = new URL(link);
    if (url.hostname !== 'padekman.lt' || !url.pathname.startsWith('/portfolio-item/')) {
      throw new Error(`padekman: unexpected item link ${link} at ${pageUrl}`);
    }
    items.push({ nativeId: id[1], sourceUrl: url.href, name: decodeXml((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1]) });
  }
  return items;
}

// Category labels -> status and species. Two different statuses (e.g. both "Ieško namų" and
// "Rado namus") or two species = the page contradicts itself = unknown.
function fromLabels(labels) {
  const statuses = new Map();
  const species = new Set();
  for (const label of labels) {
    const s = N.status(label);
    if (s.status !== 'unknown' && !statuses.has(s.status)) statuses.set(s.status, s.statusEvidence);
    const sp = N.species(label);
    if (sp) species.add(sp);
  }
  const st = statuses.size === 1 ? [...statuses][0] : null;
  return {
    status: st ? st[0] : 'unknown',
    statusEvidence: st ? st[1] : null,
    species: species.size === 1 ? [...species][0] : null,
  };
}

// This site's own label words (written as on the page) that the shared label list does not know.
const SITE_LABELS = [
  ['chipped', /^(čipizacija|čipavimas)$/],
  ['vaccinated', /^(skiepijimas)$/],
  ['birth', /^(gimimo metai)$/],
];
function siteSex(value) {
  const v = N.fold(value).replace(/\.$/, '');
  if (v === 'vyr') return 'male';
  if (v === 'mot') return 'female';
  return N.sex(value);
}

// Text lines of the description block. Stops at the contact block.
function contentLines($, el) {
  const html = ($(el).html() || '').replace(/<br\b[^>]*>|<\/(div|p|li|h\d)>/gi, '\n');
  const lines = [];
  for (const raw of html.split('\n')) {
    const line = N.cleanText(raw);
    if (!line) continue;
    if (/^daugiau informacij/i.test(N.fold(line))) break;
    lines.push(line);
  }
  return lines;
}

function parseDetail(html, pageUrl) {
  const $ = H.load(html);
  const holder = $('.mkdf-portfolio-single-holder').first();
  const content = holder.find('.mkdf-ps-content-item').first();
  const catBox = holder.find('.mkdf-ps-categories').first();
  if (!holder.length || !content.length || !catBox.length) throw new Error(`padekman: animal page layout changed at ${pageUrl}`);
  const labels = catBox.find('a.mkdf-ps-info-category').map((_, a) => N.cleanText($(a).text())).get().filter(Boolean);

  const facts = {};
  const bio = [];
  for (const line of contentLines($, content)) {
    const m = line.match(/^([^:：]{2,40}?)\s*[:：]\s*(.*)$/);
    if (!m) { bio.push(line); continue; }
    const [, label, value] = m;
    if (!N.cleanText(value)) continue; // "Vardas:" with nothing after it
    const folded = N.fold(label);
    const site = SITE_LABELS.find(([, re]) => re.test(folded));
    if (folded === 'lytis') { if (!('sex' in facts)) facts.sex = siteSex(value); continue; }
    if (site) {
      const [field] = site;
      if (field in facts) continue;
      facts[field] = field === 'birth' ? `${N.cleanText(label)}: ${N.cleanText(value)}` : N.yesNo(value);
      continue;
    }
    const known = L.fromPairs([[label, value]]);
    for (const [k, v] of Object.entries(known)) if (!(k in facts)) facts[k] = v;
  }

  const photos = holder.find('.mkdf-ps-image img').map((_, img) => H.imgSrc($(img), pageUrl)).get().filter(Boolean);
  return { labels, facts, bio: bio.length ? bio.join('\n') : null, photos };
}

async function walkFeed(fetcher) {
  const items = [];
  const seen = new Set();
  let pageSize = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    let res;
    try { res = await fetcher.get(feedUrl(page)); }
    catch (e) {
      if (page > 1 && e.status === 404) return { items, complete: true }; // past the last page
      throw e;
    }
    const got = parseFeed(res.body, res.url);
    for (const it of got) {
      if (seen.has(it.nativeId)) throw new Error(`padekman: feed page ${page} repeats item ${it.nativeId} (paging not working)`);
      seen.add(it.nativeId);
      items.push(it);
    }
    if (page === 1) pageSize = got.length;
    if (!got.length || got.length < pageSize) return { items, complete: true };
  }
  return { items, complete: false }; // hit MAX_PAGES: do not trust as complete
}

async function collect({ fetcher, cache, log = () => {} }) {
  const { items, complete } = await walkFeed(fetcher);
  const animals = [];
  const skipped = [];
  for (const it of items) {
    const page = await fetcher.get(it.sourceUrl); // errors are not caught: a missing page fails the run
    const d = cache
      ? await cache.getOrParse(page.hash, 'padekman-1', () => parseDetail(page.body, page.url))
      : parseDetail(page.body, page.url);
    const f = fromLabels(d.labels);
    if (f.status === 'excluded') { skipped.push({ nativeId: it.nativeId, reason: f.statusEvidence }); continue; }
    const age = d.facts.age_text ?? d.facts.birth ?? null;
    animals.push({
      nativeId: it.nativeId,
      sourceUrl: it.sourceUrl,
      name: it.name,
      species: f.species,
      sex: d.facts.sex ?? null,
      age_text: age,
      size: d.facts.size ?? null,
      vaccinated: d.facts.vaccinated ?? null,
      neutered: d.facts.neutered ?? null,
      chipped: d.facts.chipped ?? null,
      photos: d.photos,
      bio_lt: d.bio,
      status: f.status,
      statusEvidence: f.statusEvidence,
      sourceUpdatedAt: null,
    });
  }
  log(`padekman: ${animals.length} animals, ${skipped.length} skipped, feed ${complete ? 'complete' : 'NOT complete'}`);
  return { animals, skipped, complete };
}

module.exports = {
  id: 'padekman',
  name: 'VšĮ Gyvūnų prieglauda „Padėk man“ / „Gyvūnų šansas“',
  website: 'https://padekman.lt/',
  hosts: ['padekman.lt', 'www.padekman.lt'],
  collect,
  _parseFeed: parseFeed,
  _parseDetail: parseDetail,
  _fromLabels: fromLabels,
};
