'use strict';
// VšĮ „Katino svajonė“, Kaunas (katinosvajone.lt). VMVT row 3.
// robots.txt (2026-11-16): "User-agent: *" + "Crawl-delay: 10", nothing disallowed.
// No terms / copyright page found; footer only says "©2026 VŠĮ Katino Svajonė".
//
// Animals are NOT in the WordPress REST API (only post/page/media types are public).
// They are listed as HTML at /musu-globotiniai?pg=N, 16 per page, newest first.
// The list mixes every status (Dovanojama, Padovanota, Grįžo namo, Rasta, Dingus, Mirus);
// the status filter is a POST form, so we read the plain list and keep each animal's
// real status. The list card has only: link (slug), name, thumbnail, status word.
// Sex / neutered / age live only on detail pages, which we do not read yet (unknown = null).
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');

const ID = 'katinosvajone';
const BASE = 'https://www.katinosvajone.lt/';
const LIST = `${BASE}musu-globotiniai`;
const PARSER_VERSION = 'katinosvajone-list-1';
const MAX_PAGES = 300; // 175 pages on 2026-11-16

const pageUrl = n => (n === 1 ? LIST : `${LIST}?pg=${n}`);

function pageNumberOf(href) {
  try {
    const u = new URL(href);
    if (u.pathname.replace(/\/$/, '') !== '/musu-globotiniai') return null;
    const pg = u.searchParams.get('pg');
    return pg == null ? 1 : /^\d+$/.test(pg) ? Number(pg) : null;
  } catch { return null; }
}

// Pure parse of one list page. Throws if the page does not look like the list.
function parseListPage(html, url) {
  const $ = H.load(html);
  const blocks = $('.box-content.animals a.animal-block');
  const cards = blocks.toArray().map(el => {
    const $a = $(el);
    const link = H.abs($a.attr('href'), url);
    const m = link && new URL(link).pathname.match(/^\/musu-globotinis\/([\w-]+)\/?$/);
    const statusText = N.cleanText($a.find('small').first().text());
    const img = $a.find('img').first();
    return {
      nativeId: m ? m[1] : null,
      sourceUrl: link,
      name: N.cleanText($a.find('b').first().text()),
      photo: img.length ? H.imgSrc(img, url) : null,
      statusText,
    };
  });

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
  return { cards, pagination };
}

async function collect({ fetcher, cache, log }) {
  const animals = [];
  const skipped = [];
  const seen = new Set();
  let announcedLast = null;
  let complete = false;

  for (let n = 1; n <= MAX_PAGES; n++) {
    const url = pageUrl(n);
    const page = await fetcher.get(url); // errors propagate: a failed page fails the run
    const parsed = await cache.getOrParse(page.hash, PARSER_VERSION, () => parseListPage(page.body, url));
    if (!parsed.cards.length) throw new Error(`${ID}: no animal cards on ${url} (layout changed?)`);
    const p = parsed.pagination;
    if (!p || p.current !== n) throw new Error(`${ID}: page ${url} does not say it is page ${n}`);
    if (n === 1) announcedLast = p.last;

    for (const c of parsed.cards) {
      if (!c.nativeId || !c.sourceUrl) throw new Error(`${ID}: animal card without a link on ${url}`);
      if (seen.has(c.nativeId)) continue; // list shifted while walking; keep first sighting
      seen.add(c.nativeId);
      const st = N.status(c.statusText);
      if (st.status === 'excluded') { skipped.push({ nativeId: c.nativeId, reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId: c.nativeId,
        sourceUrl: c.sourceUrl,
        name: c.name,
        species: null,
        sex: null,
        age_text: null,
        size: null,
        vaccinated: null,
        neutered: null,
        chipped: null,
        photos: c.photo ? [c.photo] : [],
        bio_lt: null,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: null,
      });
    }

    if (p.next) {
      if (pageNumberOf(p.next) !== n + 1) throw new Error(`${ID}: unexpected next link ${p.next} on ${url}`);
      continue;
    }
    // No next link. The end is proven only when the "Pirmyn" item is there but disabled,
    // this page is the highest page number listed, and it matches what page 1 announced.
    complete = p.hasNextItem && p.last != null && p.current >= p.last && (announcedLast == null || n >= announcedLast);
    if (!complete) log(`${ID}: stopped at page ${n} without proof of the last page (page 1 announced ${announcedLast})`);
    break;
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
};
