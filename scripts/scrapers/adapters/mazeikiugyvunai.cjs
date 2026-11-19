'use strict';
// Mažeikių gyvūnų globos draugija (mazeikiugyvunai.lt). VMVT row 12.
// The site is an Angular app that reads the shelter's own public integration API
// (gyvunuglobosdraugija.lt/api/public/integrations/animals). Neither host serves a robots.txt
// (both answer with the app's HTML, so no rules); no terms page (checked 2026-11-18).
// We ask only for adoptable animals. arrivalCircumstances (where the animal was found) is never read.
// No per-animal pages: sourceUrl is the home page with #<id>.
const N = require('../lib/normalize.cjs');

const SITE = 'https://mazeikiugyvunai.lt';
const API = 'https://gyvunuglobosdraugija.lt/api/public/integrations/animals';
const MAX_PAGES = 20;

function toAnimal(row) {
  const a = row.animal || {};
  return {
    nativeId: String(row.id),
    sourceUrl: `${SITE}/#${row.id}`,
    name: N.cleanText(a.name),
    species: N.species(a.type) ?? null,
    sex: N.sex(a.sex),
    age_text: N.cleanText(a.birthDate),
    photos: a.photoUrl ? [a.photoUrl] : [],
    bio_lt: N.cleanText(a.description) || null,
    // registrationDate: when the shelter registered the animal (its arrival).
    in_shelter: /^\d{4}-\d{2}-\d{2}$/.test(row.registrationDate ?? '') ? `nuo ${row.registrationDate}` : null,
    status: 'available',
    statusEvidence: null,
  };
}

module.exports = {
  id: 'mazeikiugyvunai',
  name: 'Mažeikių gyvūnų globos draugija',
  website: `${SITE}/`,
  hosts: ['mazeikiugyvunai.lt', 'gyvunuglobosdraugija.lt'],
  async collect({ fetcher, log = () => {} }) {
    const animals = [];
    let complete = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetcher.getJson(`${API}?page=${page}&adoptable=true`);
      const { data, totalItems, itemsPerPage } = res.json || {};
      if (!Array.isArray(data)) throw new Error(`Unexpected JSON from ${res.url}`);
      for (const row of data) if (row.adoptable === true && !row.outcome) animals.push(toAnimal(row));
      if (!data.length || page * itemsPerPage >= totalItems) { complete = true; break; }
    }
    log(`mazeikiugyvunai: ${animals.length} animals`);
    return { animals, skipped: [], complete };
  },
};
