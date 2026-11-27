'use strict';
// Asociacija „Keturkojo viltis“, Alytus (keturkojo-viltis.lt, with a hyphen). VMVT row 2.
// robots.txt: "User-agent: *" Allow: /, Disallow: /wp-admin/ /?s=, no crawl-delay (checked 2026-11-18).
// Animals are the public WordPress type "gyvunas" with taxonomy rusis (species).
// REST content carries the story and sometimes "Spėjama gimimo data". The public animal page also has a
// fact list (<dt>Lytis</dt><dd>Patelė</dd>, birth date) and a status line ("Ieško namų"), so each page is
// read once per run (one request per animal, cached by page hash). A failed page keeps the REST facts.
const { createWordpressAdapter } = require('./wordpress-rest.cjs');
const L = require('../lib/labels.cjs');
const N = require('../lib/normalize.cjs');
const { sha256 } = require('../lib/hash.cjs');

const DETAIL_VERSION = 'keturkojo-viltis-detail-1';

function parseDetail(html) {
  const pairs = [...String(html).matchAll(/<dt>([^<]+)<\/dt>\s*<dd>([^<]+)<\/dd>/g)].map(m => [m[1], m[2]]);
  const facts = L.fromPairs(pairs);
  const st = String(html).match(/<p class="kv-status[^"]*">([^<]+)<\/p>/);
  return { ...facts, ...(st ? N.status(st[1]) : {}) };
}

const base = createWordpressAdapter({
  id: 'keturkojo-viltis',
  name: 'Asociacija „Keturkojo viltis“',
  base: 'https://keturkojo-viltis.lt/',
  restBase: 'gyvunas',
  taxonomies: { rusis: 'species' },
  // Description only: drop the leading "Facebook nuoroda" link paragraph and the shelter's
  // contact footer (phone, website, addresses), which starts at the paragraph with "☎".
  bioHtml: h => h.replace(/<p>\s*<a[^>]*facebook\.com[^>]*>[^<]*<\/a>\s*<\/p>/gi, '').replace(/<p>[^<]*☎[\s\S]*$/, ''),
});

module.exports = {
  ...base,
  async collect(ctx) {
    const result = await base.collect(ctx);
    for (const a of result.animals) {
      let res;
      try { res = await ctx.fetcher.get(a.sourceUrl); }
      catch (e) { ctx.log?.(`${a.sourceUrl}: detail not read (${e.message})`); continue; }
      const d = await ctx.cache.getOrParse(sha256(res.body), DETAIL_VERSION, () => parseDetail(res.body));
      // The page's fact list is the shelter's own record, so it wins over the REST text.
      for (const k of ['sex', 'age_text', 'species', 'size', 'vaccinated', 'neutered', 'chipped']) if (d[k] != null) a[k] = d[k];
      if (d.status && d.status !== 'unknown') { a.status = d.status; a.statusEvidence = d.statusEvidence; }
    }
    return result;
  },
  _parseDetail: parseDetail,
};
