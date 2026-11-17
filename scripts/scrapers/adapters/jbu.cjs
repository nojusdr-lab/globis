'use strict';
// UAB „Joniškio butų ūkis“ (jbu.lt), municipal stray-animal catcher and temporary carer
// for Joniškio r. VMVT row 19.
// robots.txt (probe 2026-11-16, https://jbu.lt/robots.txt): "User-agent: *" only, nothing
// disallowed, no Crawl-delay. http:// redirects to https://.
// Terms: no terms page in the probe; footer says only "© 2024 Joniškio butų ūkis. Visos teisės
// saugomos." (generic copyright line, nothing about copying or automated collection). We keep
// facts and photo links, not their texts.
//
// WordPress 7.1 + WPBakery + the theme's "portfolio" grid. The page /beglobiai-gyvunai/ shows a
// <ul class="portfolio" data-category="44" data-per-page="20"> with one <li class="isotope-item">
// per animal: link /portfolio/<slug>/, one thumbnail, a title (seen: "Beglobis gyvūnas", a generic
// label, not a name) and an empty .subtitle. Pagination lives in .portfolio-pagination (empty on
// the probed page: 1 animal < 20 per page).
//
// Facts on the list: nativeId = portfolio slug, sourceUrl, photo. Status only if the card's
// subtitle or title text is a status word (normalize.status); otherwise unknown. Species, sex,
// age, size, health and bio are not on the list: null. Detail pages were not probed, so we do not
// read them yet. The archive of handed-over animals (/beglobiu-gyvunu-archyvas/) is not read.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');

const ORIGIN = 'https://jbu.lt';
const LIST_URL = `${ORIGIN}/beglobiai-gyvunai/`;
const MAX_PAGES = 10;
// Titles that label the card instead of naming the animal.
const GENERIC_TITLE = /^(beglobis|beglobė|beglobiai) gyvūn(as|ai|ė)$/;

function parseList(html, pageUrl) {
  const $ = H.load(html);
  const grid = $('ul.portfolio').first();
  if (!grid.length) throw new Error(`jbu: no portfolio grid on ${pageUrl} (layout changed?)`);
  const perPage = Number(grid.attr('data-per-page')) || null;
  const cards = [];
  grid.children('li.isotope-item').each((_, li) => {
    const $li = $(li);
    const link = $li.find('a.portfolio-title').attr('href') || $li.find('a.item-hover').attr('href');
    const href = H.abs(link, pageUrl);
    const m = href && new URL(href).pathname.match(/^\/portfolio\/([\w-]{1,120})\/?$/);
    if (!m) throw new Error(`jbu: card without /portfolio/<slug>/ link on ${pageUrl}`);
    const img = $li.find('.item-img img').first();
    cards.push({
      nativeId: m[1],
      sourceUrl: href,
      title: N.cleanText($li.find('.portfolio-title').text()),
      subtitle: N.cleanText($li.find('.subtitle').text()),
      photo: img.length ? H.imgSrc(img, pageUrl) : null,
    });
  });
  const pageLinks = $('.portfolio-pagination a[href]').map((_, a) => H.abs($(a).attr('href'), pageUrl)).get()
    .filter(u => u && new URL(u).hostname === new URL(pageUrl).hostname);
  const paginationEmpty = !N.cleanText($('.portfolio-pagination').text()) && !$('.portfolio-pagination *').length;
  return { cards, perPage, pageLinks, paginationEmpty };
}

function statusOf(card) {
  for (const text of [card.subtitle, card.title]) {
    const s = N.status(text);
    if (s.status !== 'unknown') return s;
  }
  return { status: 'unknown', statusEvidence: null };
}

async function collect({ fetcher, log = () => {} }) {
  const queue = [LIST_URL];
  const visited = new Set();
  const cards = [];
  let complete = true;
  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    if (visited.size >= MAX_PAGES) { complete = false; break; }
    visited.add(url);
    const page = await fetcher.get(url); // errors propagate: a failed page fails the run
    visited.add(page.url);
    const p = parseList(page.body, page.url);
    cards.push(...p.cards);
    for (const u of p.pageLinks) if (!visited.has(u)) queue.push(u);
    // A full page with no followable page links may hide more animals (e.g. "load more" by script):
    // we cannot prove we saw the end.
    if (p.perPage && p.cards.length >= p.perPage && !p.pageLinks.length) complete = false;
    if (!p.paginationEmpty && !p.pageLinks.length) complete = false;
  }

  const animals = [];
  const skipped = [];
  const seen = new Set();
  for (const c of cards) {
    if (seen.has(c.nativeId)) continue;
    seen.add(c.nativeId);
    const st = statusOf(c);
    if (st.status === 'excluded') { skipped.push({ nativeId: c.nativeId, reason: st.statusEvidence }); continue; }
    const title = c.title && st.status === 'unknown' && !GENERIC_TITLE.test(N.fold(c.title)) ? c.title : null;
    animals.push({
      nativeId: c.nativeId,
      sourceUrl: c.sourceUrl,
      name: title,
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
  log(`jbu: ${animals.length} animals, ${skipped.length} skipped, ${visited.size} list page(s)${complete ? '' : ', end not proven'}`);
  return { animals, skipped, complete };
}

module.exports = {
  id: 'jbu',
  name: 'UAB „Joniškio butų ūkis“',
  website: LIST_URL,
  hosts: ['jbu.lt', 'www.jbu.lt'],
  collect,
  _parseList: parseList,
};
