'use strict';
// VšĮ „Linksmosios pėdutės“, Klaipėda (www.linksmosiospedutes.lt). VMVT row 8.
// robots.txt (2026-11-16, Cloudflare managed): "User-agent: *" + "Content-Signal: search=yes,ai-train=no,use=reference"
// + "Allow: /", and a second "User-agent: *" group with "Disallow: /admin/". Named AI/training
// crawlers are disallowed; GlobisBot is not one of them and we do not train AI models.
// No terms page; the privacy policy says nothing about copying or automated collection.
// Footer: "Visos teisės saugomos © 2013 - 2025 VšĮ gyvūnų globos namai "Linksmosios pėdutės"".
// To respect "use=reference" we keep facts + a link back only (no description text copied).
//
// CMS is easywebmanager (not WordPress: /wp-json/ is 404). Two HTML listing pages:
//   /lt/suniukai/ (h1 "Šuniukai")  and  /lt/kaciukai/ (h1 "Kačiukai")
// Each card: <div class="product-small"><figure><a href="lt/<list>/<slug>-<ID>.html"><img src="index.php?...&id=<ID>...">
//   <div class="p_info"><a class="p_title" title="Name">Name</a></div></div>
// The list cards carry only name, photo and id. Status: the site's own navigation labels these
// pages "Šuniukai ieškantys namų" / "Kačiukai ieškantys namų" (= looking for a home).
// On 2026-11-16 both lists were a single page (no .paging block). If the CMS ever adds
// .paging links we follow every link that stays on the same listing path; if we stop at the
// page limit the run is not complete.
// We do not read /lt/rade-namus/ (adopted animals).
// Detail pages (2026-11-18): <div id="products-description-<ID>"> holds lines like
// "AMŽIUS: 2018 10 14<br>DYDIS: ...<br>SKIEPYTAS<br>ČIPUOTAS<br>KASTRUOTAS". We read those facts
// (one GET per animal, cached by page hash); the description text itself is not kept.
// A detail page that fails keeps the list-card facts; the run is not failed for one page.
const html = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'linksmosiospedutes-detail-2';

function parseDetail(body, nativeId) {
  const $ = html.load(body);
  const box = $(`#products-description-${nativeId}`).first();
  if (!box.length) return {};
  const inner = box.html() || '';
  const facts = L.fromPairs(L.pairsFromText(inner));
  // Lines stay separate: each "SKIEPYTAS" line is its own sentence. Commented-out blocks are not page text.
  const text = inner.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\b[^>]*>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return { ...L.fromProse(text), ...facts };
}

const BASE = 'https://www.linksmosiospedutes.lt/';
const LISTINGS = [`${BASE}lt/suniukai/`, `${BASE}lt/kaciukai/`];
const MAX_PAGES = 20;

const stripQuery = href => { const u = new URL(href); u.search = ''; u.hash = ''; return u.href; };

// The navigation link that points at this listing, e.g. "Šuniukai ieškantys namų".
// First word is the species word, the rest is the status words.
function listStatus($, listUrl, base) {
  let out = { status: 'unknown', statusEvidence: null };
  $('a[href]').each((_, a) => {
    const href = html.abs($(a).attr('href'), base);
    if (!href || stripQuery(href) !== listUrl) return;
    const text = N.cleanText($(a).text());
    if (!text || !text.includes(' ')) return;
    const st = N.status(text.slice(text.indexOf(' ') + 1));
    if (st.status !== 'unknown') { out = { status: st.status, statusEvidence: text }; return false; }
  });
  return out;
}

// "Salsa (VIDEO)" -> name "Salsa". A status word in a suffix ("Oronas - rezervuotas") is kept as status.
function splitTitle(title) {
  const parts = String(title || '').split(/\s+[-–]\s+|\s*\(\s*|\s*\)\s*/).map(s => N.cleanText(s)).filter(Boolean);
  const name = parts.shift() || null;
  let status = null;
  for (const p of parts) {
    const st = N.status(p);
    if (st.status !== 'unknown') { status = st; break; }
  }
  return { name, status };
}

function parseListing(body, pageUrl, listUrl) {
  const $ = html.load(body);
  const base = html.abs($('base[href]').attr('href') || pageUrl, pageUrl) || pageUrl;
  const heading = N.cleanText($('h1.title').first().text());
  if (!heading) throw new Error(`linksmosiospedutes: listing heading not found on ${pageUrl} (layout changed?)`);
  const species = N.species(heading);
  const pageStatus = listStatus($, listUrl, base);

  const cards = $('.product-small');
  // We have never seen an empty list on this site, so zero cards is treated as a layout change.
  if (!cards.length) throw new Error(`linksmosiospedutes: no animal cards on ${pageUrl}`);

  const animals = [];
  const skipped = [];
  cards.each((_, card) => {
    const $card = $(card);
    const $a = $card.find('a.p_title').first();
    const href = html.abs($a.attr('href') || $card.find('figure a').first().attr('href'), base);
    const m = href && new URL(href).pathname.match(/-(\d+)\.html$/);
    if (!m) { skipped.push({ nativeId: href || '?', reason: 'no animal id in link' }); return; }
    const nativeId = m[1];
    const t = splitTitle($a.attr('title') || $a.text());
    if (!t.name) { skipped.push({ nativeId, reason: 'no name on card' }); return; }
    const st = t.status || pageStatus;
    if (st.status === 'excluded') { skipped.push({ nativeId, reason: st.statusEvidence }); return; }
    const photo = html.imgSrc($card.find('figure img').first(), base);
    animals.push({
      nativeId,
      sourceUrl: href,
      name: t.name,
      species,
      sex: null,
      age_text: null,
      size: null,
      vaccinated: null,
      neutered: null,
      chipped: null,
      photos: photo ? [photo] : [],
      bio_lt: null,
      status: st.status,
      statusEvidence: st.status === 'unknown' ? null : st.statusEvidence,
      sourceUpdatedAt: null,
    });
  });

  // Pagination links (none seen on 2026-11-16) that stay on this listing path.
  const listPath = new URL(listUrl).pathname;
  const pages = [];
  $('.paging a[href]').each((_, a) => {
    const href = html.abs($(a).attr('href'), base);
    if (!href) return;
    const u = new URL(href);
    u.hash = '';
    if (u.origin === new URL(listUrl).origin && u.pathname === listPath) pages.push(u.href);
  });
  return { animals, skipped, pages };
}

async function collect({ fetcher, cache, log = () => {} }) {
  const byId = new Map();
  const skipped = [];
  let complete = true;
  for (const listUrl of LISTINGS) {
    const queue = [listUrl];
    const seen = new Set(queue);
    let fetched = 0;
    while (queue.length) {
      if (fetched >= MAX_PAGES) { complete = false; break; } // could not prove we reached the end
      const url = queue.shift();
      const res = await fetcher.get(url); // throws on any failure: run becomes 'failed'
      fetched++;
      const out = parseListing(res.body, res.url, listUrl);
      log(`${url}: ${out.animals.length} animals, ${out.skipped.length} skipped`);
      for (const a of out.animals) {
        const prev = byId.get(a.nativeId);
        if (!prev) { byId.set(a.nativeId, a); continue; }
        // Same id on two lists: keep one record; facts that disagree become unknown.
        if (prev.species !== a.species) prev.species = null;
        if (prev.status !== a.status) { prev.status = 'unknown'; prev.statusEvidence = null; }
      }
      skipped.push(...out.skipped);
      for (const p of out.pages) if (!seen.has(p)) { seen.add(p); queue.push(p); }
    }
  }
  const animals = [...byId.values()];
  for (const a of animals) {
    let res;
    try { res = await fetcher.get(a.sourceUrl); }
    catch (e) { log(`${a.sourceUrl}: detail not read (${e.message})`); continue; }
    const d = await cache.getOrParse(sha256(res.body), PARSER_VERSION, () => parseDetail(res.body, a.nativeId));
    for (const k of ['species', 'sex', 'age_text', 'size', 'vaccinated', 'neutered', 'chipped']) {
      if (d[k] != null && k !== 'species') a[k] = d[k];
    }
  }
  log(`linksmosiospedutes: ${animals.length} animals, ${skipped.length} skipped`);
  return { animals, skipped, complete };
}

module.exports = {
  id: 'linksmosiospedutes',
  name: 'VšĮ „Linksmosios pėdutės“, Klaipėda',
  website: BASE,
  hosts: ['www.linksmosiospedutes.lt', 'linksmosiospedutes.lt'],
  collect,
  _parseListing: parseListing,
  _parseDetail: parseDetail,
};
