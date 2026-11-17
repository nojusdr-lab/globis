'use strict';
// VšĮ „Lesė“ (lese.lt), Vilnius ir Kaunas. VMVT row 4.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// No site terms forbid reuse (checked the volunteer and adoption rule pages).
//
// Animals are a WordPress post type ("globotiniai") NOT exposed in /wp-json/wp/v2/types, so we
// read the public HTML list with the site's own filter form:
//   stat=1 ("Ieško namų") holds available, "Rezervuotas" and "Karantinuojamas" animals (probe
//   2026-11-17). Other stat values are adopted / returned / died / old "Kita" records: not read.
//   type=<value> (Šuo, Katė, ...) narrows the same list by species. One walk per type sets species,
//   instead of one request per animal.
// Each card gives: link, name, status text, an unlabeled date (ignored), one photo.
// Detail pages (/globotiniai/<slug>/) carry labelled facts (Rūšis, Lytis, Dydis, Sterilizacija,
// Skiepai, age table, description) but are NOT read here, to keep requests per run small.
// Pagination: follow "a.next.page-numbers" until the last page (span.current, no next).
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');

const ORIGIN = 'https://lese.lt';
const LIST_PATH = '/lese-globotiniai/';
const STAT_LOOKING = '1'; // "Ieško namų" in the site's filter form

// Stable id from the detail URL slug (/globotiniai/<slug>/), folded to ASCII for record.cjs.
function slugId(href) {
  const m = new URL(href).pathname.match(/^\/globotiniai\/([^/]+)\/?$/);
  if (!m) return null;
  let slug;
  try { slug = decodeURIComponent(m[1]); } catch { slug = m[1]; }
  slug = slug.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\w.-]+/g, '-');
  return slug || null;
}

function listUrl(params) {
  const url = new URL(LIST_PATH, ORIGIN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.href;
}

// Keep the filter on "next" links even if the theme ever drops it.
function withParams(href, params) {
  const url = new URL(href);
  for (const [k, v] of Object.entries(params)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
  return url.href;
}

function parsePage(html, pageUrl) {
  const $ = H.load(html);
  const selected = name => $(`select#${name} option[selected]`).attr('value') ?? null;
  const types = $('select#type option').map((_, o) => ({ value: $(o).attr('value'), label: N.cleanText($(o).text()) })).get()
    .filter(t => t.value && t.value !== 'all');
  const list = $('.animals-list');
  const cards = [];
  list.find('.animals-list__animal').each((_, el) => {
    const $el = $(el);
    const href = H.abs($el.find('a').first().attr('href'), pageUrl);
    // Details: "<status text><br><date>". Only the first line (status) is used; the date has no label.
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
  return {
    hasList: list.length > 0,
    cards,
    types,
    selectedStat: selected('stat'),
    selectedType: selected('type'),
    next: nextHref ? H.abs(nextHref, pageUrl) : null,
    hasCurrent: pag.find('.page-numbers.current').length > 0,
    hasNumbers: pag.find('.page-numbers').length > 0,
  };
}

function createLeseAdapter({ maxPages = 40 } = {}) {
  // Walks one filtered list to its last page. Returns cards, the form's type options and whether
  // the end was proven. Any fetch error throws (run fails, nothing published).
  async function walk(fetcher, params, log) {
    let url = listUrl(params);
    const seenPages = new Set();
    const cards = [];
    let types = [];
    for (let page = 1; page <= maxPages; page++) {
      if (seenPages.has(url)) { log(`lese: pagination loop at ${url}`); return { cards, types, complete: false }; }
      seenPages.add(url);
      const res = await fetcher.get(url);
      const p = parsePage(res.body, res.url);
      // The site must show our filter as selected, or we could be walking the 385-page full list.
      if (p.selectedStat !== params.stat) throw new Error(`lese: stat filter not applied on ${url}`);
      if (params.type && p.selectedType !== params.type) throw new Error(`lese: type filter not applied on ${url}`);
      if (!p.hasList) {
        // A type with no animals may render no list; the filter check above proves it is the right page.
        if (params.type && page === 1 && !p.hasNumbers) return { cards, types, complete: true };
        throw new Error(`lese: no .animals-list on ${url} (layout changed?)`);
      }
      if (page === 1) types = p.types;
      cards.push(...p.cards);
      if (p.next) {
        const next = withParams(p.next, params);
        if (new URL(next).origin !== ORIGIN) throw new Error(`lese: next page on another host: ${next}`);
        url = next;
        continue;
      }
      return { cards, types, complete: p.hasCurrent || (page === 1 && !p.hasNumbers) };
    }
    return { cards, types, complete: false }; // hit maxPages: not proven
  }

  async function collect({ fetcher, log = () => {} }) {
    const all = await walk(fetcher, { stat: STAT_LOOKING }, log);
    let complete = all.complete;

    // Species from the site's own type filter. Seen in two types = ambiguous = null.
    const speciesById = new Map();
    const extraCards = [];
    for (const t of all.types) {
      const species = N.species(t.label);
      const r = await walk(fetcher, { stat: STAT_LOOKING, type: t.value }, log);
      complete &&= r.complete;
      for (const c of r.cards) {
        const id = c.href && slugId(c.href);
        if (!id) continue;
        speciesById.set(id, speciesById.has(id) && speciesById.get(id) !== species ? null : species);
        extraCards.push(c);
      }
    }
    if (!all.types.length) log('lese: no type options in the filter form; species stays unknown');

    const animals = [];
    const skipped = [];
    const seenIds = new Set();
    // Cards from type walks are included too: the list can shift between requests.
    for (const card of [...all.cards, ...extraCards]) {
      const nativeId = card.href && slugId(card.href);
      if (!nativeId) { skipped.push({ nativeId: card.href || '?', reason: 'no detail link' }); continue; }
      if (seenIds.has(nativeId)) continue;
      seenIds.add(nativeId);
      const st = N.status(card.statusText);
      if (st.status === 'excluded') { skipped.push({ nativeId, reason: st.statusEvidence }); continue; }
      animals.push({
        nativeId,
        sourceUrl: card.href,
        name: card.name,
        species: speciesById.get(nativeId) ?? null,
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
