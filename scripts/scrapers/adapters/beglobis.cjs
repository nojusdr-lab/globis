'use strict';
// VšĮ „Beglobis“, Vilnius (www.beglobis.com). VMVT row 35.
// robots.txt (probe 2026-11-16): HTTP 404 = no rules. No terms/privacy page in the probe; the
// footer only says "© 2026. Visos teisės saugomos." (generic copyright line, no rule on collection).
//
// Not WordPress (/wp-json/wp/v2/types = 404): an old custom PHP CMS (UAB Artogama) with
// <base href="http://www.beglobis.com/index.php">. Animals are "modproduct" items, links
// "<Slug>-684.html?productid=<id>&reset=1".
//
// What we know (only the home page was probed): the left column block "Ieško namų" shows a few
// featured animals as .seekingItem cards (detail link + one thumbnail, no text) and links to the
// full list "/Dovanojami-684.html" ("Visi “Beglobio” gyvūnai »"). The structure of that full list
// and of detail pages is not known yet, so this adapter reads only the home page block and always
// returns complete:false (the block is a subset, never the whole list -> never published).
//
// Facts: nativeId = productid, sourceUrl = card link, photo = card thumbnail, status from the
// block heading "Ieško namų" via normalize.status(). The name exists only as an ASCII URL slug
// ("Aruka-684.html"), which may have lost Lithuanian letters, so name stays null.
// Species, sex, age, size, health and bio are not on the home page: null.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');

const ORIGIN = 'http://www.beglobis.com';
const HOME_URL = `${ORIGIN}/`;
const FULL_LIST_PATH = '/Dovanojami-684.html';

function parseHome(html, pageUrl) {
  const $ = H.load(html);
  const base = H.abs($('base').attr('href') || pageUrl, pageUrl) || pageUrl;
  const heading = $('#left h2.title').filter((_, el) => $(el).next('.block').find('.seekingItem').length > 0).first();
  if (!heading.length) throw new Error(`beglobis: no "Ieško namų" block on ${pageUrl} (layout changed?)`);
  const headingText = N.cleanText(heading.text());
  const block = heading.next('.block');
  const cards = [];
  block.find('.seekingItem').each((_, el) => {
    const a = $(el).find('a').first();
    const href = H.abs(a.attr('href'), base);
    const id = href && new URL(href).searchParams.get('productid');
    if (!href || !/^\d+$/.test(id || '')) throw new Error(`beglobis: card without productid on ${pageUrl}`);
    const img = a.find('img').first();
    cards.push({ nativeId: id, sourceUrl: href, photo: img.length ? H.imgSrc(img, base) : null });
  });
  const fullList = block.find('a.buttonLink').map((_, a) => H.abs($(a).attr('href'), base)).get()
    .find(u => new URL(u).pathname === FULL_LIST_PATH) || null;
  return { headingText, cards, fullList };
}

async function collect({ fetcher, log = () => {} }) {
  const page = await fetcher.get(HOME_URL);
  const { headingText, cards, fullList } = parseHome(page.body, page.url);
  const st = N.status(headingText);
  const animals = [];
  const skipped = [];
  const seen = new Set();
  for (const c of cards) {
    if (seen.has(c.nativeId)) continue;
    seen.add(c.nativeId);
    if (st.status === 'excluded') { skipped.push({ nativeId: c.nativeId, reason: st.statusEvidence }); continue; }
    animals.push({
      nativeId: c.nativeId,
      sourceUrl: c.sourceUrl,
      name: null,
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
  // The home block is a featured subset of the full list (fullList link). We cannot prove we saw
  // every animal, so the run is never complete.
  log(`beglobis: ${animals.length} animals from the home page block; full list ${fullList || 'link not found'} not read (structure unknown): incomplete`);
  return { animals, skipped, complete: false };
}

module.exports = {
  id: 'beglobis',
  name: 'VšĮ „Beglobis“',
  website: 'http://www.beglobis.com/',
  hosts: ['beglobis.com', 'www.beglobis.com'],
  collect,
  _parseHome: parseHome,
};
