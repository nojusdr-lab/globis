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
// Facts: the list card has only the link, a thumbnail and a generic title. The detail page
// /portfolio/<slug>/ (probe 2026-11-16) has "<p><strong>Label</strong>value</p>" lines:
// Gyvūno statusas (seen: "Beglobis"), Globėjas / prieglauda, Miestas, Rūšis, Veislė, Lytis, Amžius,
// Radimo vieta ir laikas, plus the full-size photo. Species, sex and age exist only there, so we
// read one detail page per animal (the list is small: 1 animal on 2026-11-16).
// Status: normalize.status() on "Gyvūno statusas". "Beglobis" (stray) is not a status word, so it
// stays unknown: the site does not say the animal is offered for adoption (it may be waiting for
// its owner). Size, health (vaccinated/neutered/chipped), bio and dates are not written: null.
// Breed, city and the finding place are not fields we keep. Titles like "Beglobis gyvūnas" or
// "Beglobis šuo Nr. 5" are labels, not names: name stays null for them.
// The archive of handed-over animals (/beglobiu-gyvunu-archyvas/) is not read.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');

const ORIGIN = 'https://jbu.lt';
const LIST_URL = `${ORIGIN}/beglobiai-gyvunai/`;
const MAX_PAGES = 10;
// Titles that label the card instead of naming the animal.
const GENERIC_TITLE = /^beglob(is|ė|iai|ės)(\s|$)/;
const L = require('../lib/labels.cjs');

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

// Detail page: "<p><strong>Rūšis</strong>Šuo</p>" lines and the full-size photo.
function parseDetail(html, pageUrl) {
  const $ = H.load(html);
  const box = $('section.portfolio-single');
  if (!box.length) throw new Error(`jbu: no portfolio-single section on ${pageUrl} (layout changed?)`);
  const pairs = [];
  box.find('p').each((_, p) => {
    const strong = $(p).children('strong').first();
    if (!strong.length) return;
    const label = N.cleanText(strong.text());
    const value = N.cleanText($(p).text().slice(strong.text().length));
    if (label && value) pairs.push([label, value]);
  });
  const statusText = (pairs.find(([l]) => /^gyvūno statusas$/.test(N.fold(l))) || [])[1] || null;
  const img = box.find('img.wp-post-image').first();
  return {
    title: N.cleanText($('h1').first().text()),
    facts: L.fromPairs(pairs),
    statusText,
    photo: img.length ? H.imgSrc(img, pageUrl) : null,
  };
}

function statusOf(texts) {
  for (const text of texts) {
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
    const detailPage = await fetcher.get(c.sourceUrl); // errors propagate
    const d = parseDetail(detailPage.body, detailPage.url);
    const st = statusOf([d.statusText, c.subtitle]);
    if (st.status === 'excluded') { skipped.push({ nativeId: c.nativeId, reason: st.statusEvidence }); continue; }
    const title = d.title || c.title;
    const f = d.facts;
    animals.push({
      nativeId: c.nativeId,
      sourceUrl: c.sourceUrl,
      name: title && !GENERIC_TITLE.test(N.fold(title)) ? title : null,
      species: f.species ?? null,
      sex: f.sex ?? null,
      age_text: f.age_text ?? null,
      size: f.size ?? null,
      vaccinated: f.vaccinated ?? null,
      neutered: f.neutered ?? null,
      chipped: f.chipped ?? null,
      photos: [d.photo || c.photo].filter(Boolean),
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
  _parseDetail: parseDetail,
};
