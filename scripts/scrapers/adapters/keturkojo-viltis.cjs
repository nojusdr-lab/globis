'use strict';
// Asociacija „Keturkojo viltis“, Alytus (keturkojo-viltis.lt, with a hyphen). VMVT row 2.
// robots.txt: "User-agent: *" Allow: /, Disallow: /wp-admin/ /?s=, no crawl-delay (checked 2026-11-18).
// Animals are the public WordPress type "gyvunas" with taxonomy rusis (species).
// Pages carry "Spėjama gimimo data" (age) only; no status taxonomy, so status stays unknown.
const { createWordpressAdapter } = require('./wordpress-rest.cjs');

module.exports = createWordpressAdapter({
  id: 'keturkojo-viltis',
  name: 'Asociacija „Keturkojo viltis“',
  base: 'https://keturkojo-viltis.lt/',
  restBase: 'gyvunas',
  taxonomies: { rusis: 'species' },
  // Description only: drop the leading "Facebook nuoroda" link paragraph and the shelter's
  // contact footer (phone, website, addresses), which starts at the paragraph with "☎".
  bioHtml: h => h.replace(/<p>\s*<a[^>]*facebook\.com[^>]*>[^<]*<\/a>\s*<\/p>/gi, '').replace(/<p>[^<]*☎[\s\S]*$/, ''),
});
