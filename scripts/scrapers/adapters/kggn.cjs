'use strict';
// Kauno gyvūnų gerovės namai „Nojus“ (kggn.lt). VMVT row 6.
// robots.txt: "User-agent: *" + "Crawl-delay: 10", nothing disallowed (checked 2026-11-16).
// Animals are the public WordPress type "globotiniai" with taxonomies
// gyvunas (species), lytis (sex), statusas (status), amzius (age / birth year).
const { createWordpressAdapter } = require('./wordpress-rest.cjs');

module.exports = createWordpressAdapter({
  id: 'kggn',
  name: 'Kauno gyvūnų gerovės namai „Nojus“',
  base: 'https://kggn.lt/',
  restBase: 'globotiniai',
  taxonomies: { gyvunas: 'species', lytis: 'sex', statusas: 'status', amzius: 'age_text' },
});
