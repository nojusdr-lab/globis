'use strict';
// VšĮ „Katino svajonė“, Kaunas (katinosvajone.lt). VMVT row 3.
// robots.txt (2026-11-16): "User-agent: *" + "Crawl-delay: 10", nothing disallowed.
// No terms / copyright page found; footer only says "©2026 VŠĮ Katino Svajonė".
//
// Animals are NOT in the WordPress REST API (only post/page/media types are public).
// The full list /musu-globotiniai (175 pages, every status since 2014) also accepts the
// status filter as a GET parameter: /musu-globotiniai?pet_status=for_adoption[&pg=N]
// shows only "Dovanojama(-as)" animals (3 pages × 16 on 2026-11-17). We read only that.
// List cards have: slug, name, thumbnail, status word.
// Detail pages /musu-globotinis/<slug> have a labelled list (dl.pet-details-list):
// Statusas, Lytis, Amžius, Atlikta sterilizacija, plus gallery photos. A second
// dl under "Kontaktai" holds phone numbers: we never read it.
// Requests per run: robots.txt + filtered list pages + one detail page per listed animal.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');

const ID = 'katinosvajone';
const BASE = 'https://www.katinosvajone.lt/';
const LIST = `${BASE}musu-globotiniai`;
const FILTER = 'for_adoption';
const LIST_PARSER = 'katinosvajone-list-2';
const DETAIL_PARSER = 'katinosvajone-detail-1';
const MAX_PAGES = 30; // 3 filtered pages on 2026-11-17

const pageUrl = n => (n === 1 ? `${LIST}?pet_status=${FILTER}` : `${LIST}?pet_status=${FILTER}&pg=${n}`);

function pageNumberOf(href) {
  try {
    const u = new URL(href);
    if (u.pathname.replace(/\/$/, '') !== '/musu-globotiniai') return null;
    if (u.searchParams.get('pet_status') !== FILTER) return null; // must stay inside the filter
    const pg = u.searchParams.get('pg');
    return pg == null ? 1 : /^\d+$/.test(pg) ? Number(pg) : null;
  } catch { return null; }
}

// Pure parse of one list page.
function parseListPage(html, url) {
  const $ = H.load(html);
  const cards = $('.box-content.animals a.animal-block').toArray().map(el => {
    const $a = $(el);
    const link = H.abs($a.attr('href'), url);
    const m = link && new URL(link).pathname.match(/^\/musu-globotinis\/([\w-]+)\/?$/);
    const img = $a.find('img').first();
    return {
      nativeId: m ? m[1] : null,
      sourceUrl: link,
      name: N.cleanText($a.find('b').first().text()),
      photo: img.length ? H.imgSrc(img, url) : null,
      statusText: N.cleanText($a.find('small').first().text()),
    };
  });

  const filterSelected = $(`select[name="pet_status"] option[value="${FILTER}"]`).is('[selected]');
  const $pg = $('.pagination ul.pages').first();
  let pagination = null;
  if ($pg.length) {
    const currentText = N.cleanText($pg.find('li.current').first().text());
    const numbers = $pg.find('li.pagination-item').toArray()
      .map(li => Number(N.cleanText($(li).text())))
      .filter(n => Number.isInteger(n) && n > 0);
    const $next = $pg.find('li.next').first();
    const nextHref = $next.find('a[href]').attr('href');
    pagination = {
      current: /^\d+$/.test(currentText || '') ? Number(currentText) : null,
      last: numbers.length ? Math.max(...numbers) : null,
      hasNextItem: $next.length > 0,
      next: nextHref ? H.abs(nextHref, url) : null,
    };
  }
  return { cards, pagination, filterSelected };
}

// Pure parse of one detail page. Only the first dl.pet-details-list (Aprašymas);
// the next one is "Kontaktai" (phone numbers) and is ignored.
function parseDetailPage(html, url) {
  const $ = H.load(html);
  const $dl = $('dl.pet-details-list').first();
  if (!$dl.length) return null;
  const pairs = $dl.find('dt').toArray()
    .map(dt => [N.cleanText($(dt).text()), N.cleanText($(dt).next('dd').text())])
    .filter(([a, b]) => a && b);
  const photos = $('#gallery img').toArray().map(img => H.imgSrc($(img), url)).filter(Boolean);
  return { facts: L.fromPairs(pairs), photos };
}

async function collect({ fetcher, cache, log }) {
  const cards = [];
  const seen = new Set();
  let announcedLast = null;
  let complete = false;

  for (let n = 1; n <= MAX_PAGES; n++) {
    const url = pageUrl(n);
    const page = await fetcher.get(url); // errors propagate: a failed page fails the run
    const parsed = await cache.getOrParse(page.hash, LIST_PARSER, () => parseListPage(page.body, url));
    if (!parsed.filterSelected) throw new Error(`${ID}: status filter not applied on ${url}`);
    if (!parsed.cards.length) throw new Error(`${ID}: no animal cards on ${url} (layout changed?)`);
    const p = parsed.pagination;
    if (!p || p.current !== n) throw new Error(`${ID}: page ${url} does not say it is page ${n}`);
    if (n === 1) announcedLast = p.last;

    for (const c of parsed.cards) {
      if (!c.nativeId || !c.sourceUrl) throw new Error(`${ID}: animal card without a link on ${url}`);
      if (seen.has(c.nativeId)) continue; // list shifted while walking; keep first sighting
      seen.add(c.nativeId);
      cards.push(c);
    }

    if (p.next) {
      if (pageNumberOf(p.next) !== n + 1) throw new Error(`${ID}: unexpected next link ${p.next} on ${url}`);
      continue;
    }
    // No next link. The end is proven only when the "Pirmyn" item is there but disabled
    // (<li class="next"><span>, as on the real last page), this page is the highest page
    // number listed, and it is not before what page 1 announced.
    complete = p.hasNextItem && p.last != null && p.current >= p.last && (announcedLast == null || n >= announcedLast);
    if (!complete) log(`${ID}: stopped at page ${n} without proof of the last page (page 1 announced ${announcedLast})`);
    break;
  }

  const animals = [];
  const skipped = [];
  for (const c of cards) {
    const page = await fetcher.get(c.sourceUrl);
    const d = await cache.getOrParse(page.hash, DETAIL_PARSER, () => parseDetailPage(page.body, c.sourceUrl));
    if (!d) throw new Error(`${ID}: no details list on ${c.sourceUrl} (layout changed?)`);
    const f = d.facts;
    // The detail page's "Statusas" is the animal's own page; fall back to the list word.
    const st = f.status && f.status !== 'unknown' ? { status: f.status, statusEvidence: f.statusEvidence } : N.status(c.statusText);
    if (st.status === 'excluded') { skipped.push({ nativeId: c.nativeId, reason: st.statusEvidence }); continue; }
    animals.push({
      nativeId: c.nativeId,
      sourceUrl: c.sourceUrl,
      name: c.name,
      species: f.species ?? null,
      sex: f.sex ?? null,
      age_text: f.age_text ?? null,
      size: f.size ?? null,
      vaccinated: f.vaccinated ?? null,
      neutered: f.neutered ?? null,
      chipped: f.chipped ?? null,
      photos: d.photos.length ? d.photos : c.photo ? [c.photo] : [],
      bio_lt: null, // detail pages have no description text
      status: st.status,
      statusEvidence: st.statusEvidence,
      sourceUpdatedAt: null,
    });
  }

  log(`${ID}: ${animals.length} animals, ${skipped.length} skipped, complete=${complete}`);
  return { animals, skipped, complete };
}

module.exports = {
  id: ID,
  name: 'VšĮ „Katino svajonė“',
  website: BASE,
  hosts: ['www.katinosvajone.lt', 'katinosvajone.lt'],
  collect,
  parseListPage,
  parseDetailPage,
};
