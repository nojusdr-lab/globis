'use strict';
// VšĮ „Lesė“ (lese.lt), Vilnius ir Kaunas. VMVT row 4.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// No site terms forbid reuse (checked the volunteer and adoption rule pages; see report).
//
// Animals are a WordPress post type ("globotiniai") that is NOT exposed in /wp-json/wp/v2/types,
// so we read the public HTML list https://lese.lt/lese-globotiniai/.
// The site's own filter form has "stat" (1 = Ieško namų). We ask for stat=1 so we do not walk
// ~385 pages of adopted animals. Each card gives: link, name, status text, a date, one photo.
// Species, sex, age, health facts are not on the list, so they stay null (detail pages not read yet).
// Pagination: follow the theme's "a.next.page-numbers" link until the last page (span.current, no next).
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');

const ORIGIN = 'https://lese.lt';
const LIST_PATH = '/lese-globotiniai/';
const FILTER = { stat: '1' }; // "Ieško namų" in the site's own filter form

// Stable id from the detail URL slug (/globotiniai/<slug>/). Slugs may contain Lithuanian letters
// (percent-encoded), so fold them to ASCII to satisfy record.cjs nativeId rules.
function slugId(href) {
  const m = new URL(href).pathname.match(/^\/globotiniai\/([^/]+)\/?$/);
  if (!m) return null;
  let slug;
  try { slug = decodeURIComponent(m[1]); } catch { slug = m[1]; }
  slug = slug.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\w.-]+/g, '-');
  return slug || null;
}

function withFilter(href) {
  const url = new URL(href);
  for (const [k, v] of Object.entries(FILTER)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
  return url.href;
}

function parsePage(html, pageUrl) {
  const $ = H.load(html);
  const list = $('.animals-list');
  if (!list.length) throw new Error(`lese: no .animals-list on ${pageUrl} (layout changed?)`);
  const cards = [];
  list.find('.animals-list__animal').each((_, el) => {
    const $el = $(el);
    const href = H.abs($el.find('a').first().attr('href'), pageUrl);
    // Details: "<status text><br><date>". Only the first line is used (status); the date is unlabeled.
    const detailsHtml = $el.find('.animals-list__details').html() || '';
    const lines = detailsHtml.split(/<br\s*\/?>/i).map(s => N.cleanText(s)).filter(Boolean);
    const bg = $el.find('.animals-list__img').attr('data-bg-image') || '';
    const photo = (bg.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/) || [])[1];
    cards.push({
      href,
      name: N.cleanText($el.find('.animals-list__name').text()),
      statusText: lines[0] || null,
      photo: photo ? H.abs(photo, pageUrl) : null,
    });
  });
  const pag = $('.pagination');
  const nextHref = pag.find('a.next.page-numbers').attr('href') || null;
  const hasCurrent = pag.find('.page-numbers.current').length > 0;
  const hasNumbers = pag.find('.page-numbers').length > 0;
  return { cards, next: nextHref ? H.abs(nextHref, pageUrl) : null, hasCurrent, hasNumbers };
}

function createLeseAdapter({ maxPages = 60 } = {}) {
  async function collect({ fetcher, log = () => {} }) {
    const animals = [];
    const skipped = [];
    const seenIds = new Set();
    const seenPages = new Set();
    let url = withFilter(ORIGIN + LIST_PATH);
    let complete = false;

    for (let page = 1; page <= maxPages; page++) {
      if (seenPages.has(url)) { log(`lese: pagination loop at ${url}`); break; }
      seenPages.add(url);
      const res = await fetcher.get(url); // throws on any failure: the run fails, nothing is published
      const parsed = parsePage(res.body, res.url);

      for (const card of parsed.cards) {
        const nativeId = card.href && slugId(card.href);
        if (!nativeId) { skipped.push({ nativeId: card.href || '?', reason: 'no detail link' }); continue; }
        if (seenIds.has(nativeId)) continue; // same card twice (list shifted while paging)
        seenIds.add(nativeId);
        const st = N.status(card.statusText);
        if (st.status === 'excluded') { skipped.push({ nativeId, reason: st.statusEvidence }); continue; }
        animals.push({
          nativeId,
          sourceUrl: card.href,
          name: card.name,
          species: null,
          sex: null,
          age_text: null,
          size: null,
          vaccinated: null,
          neutered: null,
          chipped: null,
          photos: card.photo ? [card.photo] : [],
          bio_lt: null,
          status: st.status,
          statusEvidence: st.statusEvidence,
          sourceUpdatedAt: null,
        });
      }

      if (parsed.next) {
        const next = withFilter(parsed.next);
        if (new URL(next).origin !== new URL(res.url).origin) throw new Error(`lese: next page on another host: ${next}`);
        url = next;
        continue;
      }
      // Last page proof: a pagination block with the current page and no "next",
      // or page 1 with no pagination at all (everything fits on one page).
      complete = parsed.hasCurrent || (page === 1 && !parsed.hasNumbers);
      break;
    }
    log(`lese: ${animals.length} animals, ${skipped.length} skipped, complete=${complete}`);
    return { animals, skipped, complete };
  }

  return {
    id: 'lese',
    name: 'VšĮ „Lesė“',
    website: 'https://lese.lt/',
    hosts: ['lese.lt', 'www.lese.lt'],
    collect,
  };
}

module.exports = createLeseAdapter();
module.exports.createLeseAdapter = createLeseAdapter;
module.exports.parsePage = parsePage;
module.exports.slugId = slugId;
