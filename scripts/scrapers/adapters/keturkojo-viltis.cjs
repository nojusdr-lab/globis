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
});
