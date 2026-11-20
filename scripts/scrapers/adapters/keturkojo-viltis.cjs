'use strict';
// Asociacija „Keturkojo viltis“, Alytus. VMVT row 2.
// Public WordPress gyvunas/rusis; robots allows these pages, disallows /wp-admin/ and /?s=.
// REST supplies the story. Each public detail page supplies its own labelled
// facts/status and, where the API lacks an image, the animal's own gallery.
// Read the page once for both purposes. REST has no authoritative status, so a
// failed detail keeps REST candidates for diagnosis but cannot replace a good snapshot.
const { createWordpressAdapter } = require('./wordpress-rest.cjs');
const { galleryPhotos } = require('../lib/gallery.cjs');
const H = require('../lib/html.cjs');
const L = require('../lib/labels.cjs');
const N = require('../lib/normalize.cjs');
const { sha256 } = require('../lib/hash.cjs');
const BASE = 'https://keturkojo-viltis.lt/';
const DETAIL_VERSION = 'keturkojo-viltis-detail-2';

function parseDetail(body, url = BASE) {
  const $ = H.load(body), panel = $('.kv-animal__panel').first();
  // Related animal cards and the footer cannot replace this animal's facts.
  const facts = L.fromPairs(H.pairs($, panel.find('.kv-facts')));
  return { ...facts, ...N.status(panel.find('.kv-status').first().text()),
    photos: galleryPhotos(body, url, { selector: '.kv-gallery__main img' }) };
}

const base = createWordpressAdapter({
  id: 'keturkojo-viltis', name: 'Asociacija „Keturkojo viltis“', base: BASE,
  restBase: 'gyvunas', taxonomies: { rusis: 'species' },
  // Drop the leading Facebook paragraph and the shelter contact footer.
  bioHtml: h => h.replace(/<p>\s*<a[^>]*facebook\.com[^>]*>[^<]*<\/a>\s*<\/p>/gi, '').replace(/<p>[^<]*☎[\s\S]*$/, ''),
});

module.exports = {
  ...base,
  async collect(ctx) {
    const result = await base.collect(ctx);
    for (const a of result.animals) {
      let res;
      try { res = await ctx.fetcher.get(a.sourceUrl); }
      catch (e) {
        if (['robots', 'robots_unavailable'].includes(e.code) || [401, 403, 429].includes(e.status)) throw e;
        result.complete = false;
        ctx.log?.(`${a.sourceUrl}: required status detail not read (${e.message})`);
        continue;
      }
      const detail = await ctx.cache.getOrParse(sha256(res.url + '\n' + res.body), DETAIL_VERSION,
        () => parseDetail(res.body, res.url));
      for (const key of ['sex', 'age_text', 'species', 'size', 'vaccinated', 'neutered', 'chipped']) {
        if (detail[key] != null) a[key] = detail[key];
      }
      if (detail.status && detail.status !== 'unknown') { a.status = detail.status; a.statusEvidence = detail.statusEvidence; }
      if (!a.photos.length) a.photos = detail.photos;
    }
    result.animals = result.animals.filter(a => {
      if (a.status !== 'excluded') return true;
      result.skipped.push({ nativeId: a.nativeId, reason: a.statusEvidence });
      return false;
    });
    return result;
  },
  _parseDetail: parseDetail,
};
