'use strict';
// VšĮ Gyvūnų prieglauda „Padėk man“ / „Gyvūnų šansas“, Visaginas (padekman.lt). VMVT row 39.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// No terms/privacy/copyright page found on the site (only a "© 2021" footer line).
//
// Animals are WordPress "portfolio-item" posts (Mikado "pawfriends" theme). That type is NOT in
// /wp-json/wp/v2/types (only posts/pages/media/blocks/product), so REST cannot be used.
// The home page has the theme's portfolio list for the category "Ieško namų" (slug ishchut-dom):
// 20 cards per page, each with post id, name, photo, detail link and category labels
// (status "Ieško namų"/"Rado namus", species "Šunys"/"Katės").
// Pagination of that list is AJAX only (POST to admin-ajax.php, links are href="#"). Our fetcher
// is GET only, so we read page 1 and return complete:false while data-max-num-pages > 1.
// Detail pages are not read (their structure is not known yet), so sex/age/health/bio stay null.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');

const ORIGIN = 'https://padekman.lt';
const LIST_URL = `${ORIGIN}/`;
const CATEGORY = 'ishchut-dom'; // "Ieško namų"

function parseList(html, pageUrl) {
  const $ = H.load(html);
  const holder = $('.mkdf-portfolio-list-holder').filter((_, el) => $(el).attr('data-category') === CATEGORY).first();
  if (!holder.length) throw new Error(`padekman: no "${CATEGORY}" portfolio list on ${pageUrl} (layout changed?)`);
  const maxPages = Number(holder.attr('data-max-num-pages'));
  if (!Number.isInteger(maxPages) || maxPages < 0) throw new Error(`padekman: no page count on ${pageUrl}`);

  const cards = [];
  holder.find('article.mkdf-pl-item').each((_, el) => {
    const $el = $(el);
    const id = ($el.attr('class') || '').match(/\bpost-(\d+)\b/);
    const href = H.abs($el.find('a.mkdf-pli-link').attr('href'), pageUrl);
    if (!id || !href) throw new Error(`padekman: card without id or link on ${pageUrl}`);
    const labels = $el.find('.mkdf-pli-category').map((_, a) => N.cleanText($(a).text())).get().filter(Boolean);
    const img = $el.find('.mkdf-pli-image img').first();
    cards.push({
      nativeId: id[1],
      sourceUrl: href,
      name: N.cleanText($el.find('.mkdf-pli-title').text()),
      labels,
      photo: img.length ? H.imgSrc(img, pageUrl) : null,
    });
  });
  return { cards, maxPages };
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

async function collect({ fetcher, log = () => {} }) {
  const page = await fetcher.get(LIST_URL);
  const { cards, maxPages } = parseList(page.body, page.url);
  const animals = [];
  const skipped = [];
  const seen = new Set();
  for (const c of cards) {
    if (seen.has(c.nativeId)) continue;
    seen.add(c.nativeId);
    const f = fromLabels(c.labels);
    if (f.status === 'excluded') { skipped.push({ nativeId: c.nativeId, reason: f.statusEvidence }); continue; }
    animals.push({
      nativeId: c.nativeId,
      sourceUrl: c.sourceUrl,
      name: c.name,
      species: f.species,
      sex: null,
      age_text: null,
      size: null,
      vaccinated: null,
      neutered: null,
      chipped: null,
      photos: c.photo ? [c.photo] : [],
      bio_lt: null,
      status: f.status,
      statusEvidence: f.statusEvidence,
      sourceUpdatedAt: null,
    });
  }
  // Only page 1 is reachable with GET. Complete only when the list says it has a single page.
  const complete = maxPages <= 1;
  log(`padekman: ${animals.length} animals, ${skipped.length} skipped, page 1 of ${maxPages}${complete ? '' : ' (rest needs AJAX POST: incomplete)'}`);
  return { animals, skipped, complete };
}

module.exports = {
  id: 'padekman',
  name: 'VšĮ Gyvūnų prieglauda „Padėk man“ / „Gyvūnų šansas“',
  website: 'https://padekman.lt/',
  hosts: ['padekman.lt', 'www.padekman.lt'],
  collect,
  _parseList: parseList,
  _fromLabels: fromLabels,
};
