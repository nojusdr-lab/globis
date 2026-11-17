// https://sos-gyvunai.lt: post type "gyvunas". The site's categories give species and an age
// group. It has no status, sex or size fields, so status stays "unknown" and the rest null.
const wp = require('./wp-rest.cjs');

const SOURCE = {
  id: 'sosgyvunai',
  origin: 'https://sos-gyvunai.lt',
  shelterId: 'sos-gyvunailt',
  path: '/wp-json/wp/v2/gyvunas',
  query: '_embed=wp:featuredmedia,wp:term&_fields=id,link,modified,title,content,_links,_embedded',
  parse: parsePost,
};
const SPECIES = { kates: 'cat', sunys: 'dog' };
const AGE = { jaunikliai: 'Jauniklis', jaunos: 'Jaunas', jauni: 'Jaunas',
  suaugusios: 'Suaugęs', suauge: 'Suaugęs', senjores: 'Senjoras', senjorai: 'Senjoras' };

function parsePost(post, observedAt) {
  const pet = wp.base(SOURCE, post, observedAt, /^\/[a-z0-9-]+\/$/);
  // Slugs look like "kates" and "kates-suaugusios". Conflicting categories mean unknown.
  const slugs = wp.terms(post, 'gyvunai').map(term => String(term.slug).split('-'));
  const only = values => { const set = [...new Set(values.filter(Boolean))]; return set.length === 1 ? set[0] : null; };
  const reserved = wp.RESERVED.test(pet.name) ? pet.name : null;
  return {
    ...pet,
    species: only(slugs.map(([kind]) => SPECIES[kind])),
    ageText: only(slugs.map(([, group]) => AGE[group])),
    status: reserved ? 'reserved' : 'unknown',
    statusEvidence: reserved,
  };
}

module.exports = { SOURCE, parsePost, collect: options => wp.collect(SOURCE, options) };
