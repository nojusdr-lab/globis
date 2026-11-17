'use strict';
// VšĮ „Šiaulių letenėlė“ (siauliuletenele.lt). VMVT row 18.
// robots.txt (2026-11-16): "User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php".
// Privacy policy (/privatumo-politika-2/) is the WordPress default text; no rule against copying
// or automated collection was found on the probed pages.
//
// Animals are ordinary WordPress posts in the categories "MŪSŲ ŠUNYS" (slug sunys) and
// "MŪSŲ KATĖS" (slug kates). The HTML category list loads pages 2+ through a POST to
// admin-ajax.php, so we use the public REST API instead (GET only, full text in one request):
//   /wp-json/wp/v2/categories            -> category ids, slugs and names
//   /wp-json/wp/v2/posts?categories=<id> -> the posts, paged until a short page or HTTP 400
// Detail pages are NOT read: the REST content is the same text the post page shows.
//
// What a post gives us (and nothing more):
//   name       post title, except place titles like "IŠ RADVILIŠKIO" / "NUO VERBŪNŲ" (null)
//   species    from the category: sunys -> dog, kates -> cat (both -> null)
//   age_text   the site's own age category name ("ŠUNYS, GIMĘ 2017-2023 M.", "KAČIUKAI IKI 6 MĖN."),
//              only when exactly one such category is set (family posts often carry two -> null)
//   photos     full-size images linked from the post gallery (site uploads only)
//   bio_lt     post text without galleries/videos (contacts removed by record.cjs)
//   status     normalize.status() on the first sentence of the text ("Rezervuota.", "Rezervuotas Aš
//              Kenzis."), or the category "RADO NAMUS". Everything else stays unknown.
// Many posts describe several animals (a mother with kittens). One post = one record; the text may
// say that some of them already found homes or died (category "NETEKTYS"). We keep such posts with
// status unknown unless the first sentence says otherwise, and never infer adoption.
const H = require('../lib/html.cjs');
const N = require('../lib/normalize.cjs');
const L = require('../lib/labels.cjs');
const { sha256 } = require('../lib/hash.cjs');

const PARSER_VERSION = 'siauliuletenele-1';
const ORIGIN = 'https://siauliuletenele.lt';
const LISTS = [{ slug: 'sunys', species: 'dog' }, { slug: 'kates', species: 'cat' }];
const AGE_SLUG = /^(sunys-gime-|kates-gimusios-|mazyliai-suniukai$|mazyliai-kaciukai$)/;
const ADOPTED_SLUG = 'padovanoti-gyvunai'; // "RADO NAMUS"
const LOST_SLUG = 'dinge'; // "DINGĘ": lost pets, not shelter animals
const PLACE_TITLE = /^(iš|nuo)\s/; // "IŠ RADVILIŠKIO", "NUO PAKŠTAIČIŲ": where from, not a name
const POST_FIELDS = 'id,link,title,modified_gmt,categories,content';

function api(path) { return `${ORIGIN}/wp-json/wp/v2/${path}`; }

async function pageThrough(fetcher, makeUrl, perPage, maxPages) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    let res;
    try { res = await fetcher.getJson(makeUrl(page)); }
    catch (e) {
      if (page > 1 && e.status === 400) return { items, complete: true }; // WP: page past the last one
      throw e;
    }
    if (!Array.isArray(res.json)) throw new Error(`siauliuletenele: unexpected JSON from ${res.url}`);
    items.push(...res.json);
    if (res.json.length < perPage) return { items, complete: true };
  }
  return { items, complete: false }; // stopped at maxPages: cannot prove we saw everything
}

// Post HTML -> { text, firstSentence, photos, labelled }
function parseContent(html) {
  const $ = H.load(`<div id="root">${html || ''}</div>`);
  const root = $('#root');
  const photos = [];
  const isUpload = u => !!u && new URL(u).hostname.replace(/^www\./, '') === 'siauliuletenele.lt'
    && /\/wp-content\/uploads\/.+\.(jpe?g|png|webp|gif)$/i.test(new URL(u).pathname);
  root.find('a[href]').each((_, a) => {
    const u = H.abs($(a).attr('href'), ORIGIN);
    if (isUpload(u) && $(a).find('img').length) photos.push(u);
  });
  root.find('img').each((_, img) => {
    if (isUpload(H.abs($(img).closest('a[href]').attr('href') || '', ORIGIN))) return; // full size taken above
    const u = H.imgSrc($(img), ORIGIN);
    if (isUpload(u)) photos.push(u);
  });
  root.find('.gallery, .wp-video, video, script, style, img').remove();
  root.find('p, div, br, li, h1, h2, h3, h4').each((_, el) => { $(el).append('\n'); });
  const raw = root.text();
  const text = N.cleanText(raw);
  const firstLine = raw.split('\n').map(N.cleanText).find(Boolean) || null;
  const firstSentence = firstLine ? N.cleanText(firstLine.split(/[.!?…]/)[0]) : null;
  return {
    text,
    firstSentence,
    photos: [...new Set(photos)],
    labelled: L.fromPairs(L.pairsFromText(raw)),
  };
}

// Status only from words written by the shelter. Free-text "rasta"/"grįžo namo" at the start of a
// post usually means "found as a stray" here, so "excluded" from text is NOT trusted (stays unknown).
function statusFor(cats, firstSentence) {
  const adopted = cats.find(c => c.slug === ADOPTED_SLUG);
  if (adopted) return N.status(adopted.name);
  const st = N.status(firstSentence);
  if (st.status === 'reserved' || st.status === 'confirmed_adopted' || st.status === 'available') return st;
  return { status: 'unknown', statusEvidence: null };
}

function createSiauliuLetenele({ perPage = 100, maxPages = 20 } = {}) {
  async function collect({ fetcher, cache, log = () => {} }) {
    const catRes = await pageThrough(fetcher, p => api(`categories?per_page=100&page=${p}&_fields=id,slug,name`), 100, 5);
    let complete = catRes.complete;
    const catById = new Map(catRes.items.map(c => [c.id, { id: c.id, slug: String(c.slug), name: N.cleanText(c.name) }]));
    const catBySlug = new Map([...catById.values()].map(c => [c.slug, c]));

    const posts = new Map();
    for (const list of LISTS) {
      const cat = catBySlug.get(list.slug);
      if (!cat) throw new Error(`siauliuletenele: category "${list.slug}" not found (site changed?)`);
      const r = await pageThrough(fetcher, p => api(`posts?categories=${cat.id}&per_page=${perPage}&page=${p}&_fields=${POST_FIELDS}`), perPage, maxPages);
      complete &&= r.complete;
      for (const post of r.items) if (!posts.has(post.id)) posts.set(post.id, post);
    }

    const animals = [];
    const skipped = [];
    for (const post of posts.values()) {
      const nativeId = String(post.id);
      const cats = (post.categories || []).map(id => catById.get(id)).filter(Boolean);
      const lost = cats.find(c => c.slug === LOST_SLUG);
      if (lost) { skipped.push({ nativeId, reason: lost.name }); continue; }

      const parsed = cache
        ? await cache.getOrParse(sha256(post.content?.rendered || ''), PARSER_VERSION, () => parseContent(post.content?.rendered))
        : parseContent(post.content?.rendered);

      const speciesSet = new Set(LISTS.filter(l => cats.some(c => c.slug === l.slug)).map(l => l.species));
      const ageCats = cats.filter(c => AGE_SLUG.test(c.slug));
      const title = N.cleanText(post.title?.rendered);
      const st = statusFor(cats, parsed.firstSentence);
      const lab = parsed.labelled;

      animals.push({
        nativeId,
        sourceUrl: post.link,
        name: title && !PLACE_TITLE.test(N.fold(title)) ? title : null,
        species: speciesSet.size === 1 ? [...speciesSet][0] : null,
        sex: lab.sex ?? null,
        age_text: ageCats.length === 1 ? ageCats[0].name : null,
        size: lab.size ?? null,
        vaccinated: lab.vaccinated ?? null,
        neutered: lab.neutered ?? null,
        chipped: lab.chipped ?? null,
        photos: parsed.photos,
        bio_lt: parsed.text,
        status: st.status,
        statusEvidence: st.statusEvidence,
        sourceUpdatedAt: post.modified_gmt ? `${post.modified_gmt}Z` : null,
      });
    }
    log(`siauliuletenele: ${animals.length} animals, ${skipped.length} skipped, complete=${complete}`);
    return { animals, skipped, complete };
  }

  return {
    id: 'siauliuletenele',
    name: 'VšĮ „Šiaulių letenėlė“',
    website: 'https://siauliuletenele.lt/',
    hosts: ['siauliuletenele.lt', 'www.siauliuletenele.lt'],
    collect,
  };
}

module.exports = createSiauliuLetenele();
module.exports.createSiauliuLetenele = createSiauliuLetenele;
module.exports.parseContent = parseContent;
module.exports.statusFor = statusFor;
