// https://kggn.lt (KGGN "Nojus"): post type "globotiniai". Species, sex, age and status are
// the site's own categories. Only animals the site marks "Dovanojamas" are read.
const wp = require('./wp-rest.cjs');

const SOURCE = {
  id: 'kggn',
  origin: 'https://kggn.lt',
  shelterId: 'kggnlt',
  path: '/wp-json/wp/v2/globotiniai',
  // statusas=18 is "Dovanojamas"; parsePost checks the name, so a renumbered site fails the run.
  query: 'statusas=18&_embed=wp:featuredmedia,wp:term' +
    '&_fields=id,link,modified,title,content,_links,_embedded',
  parse: parsePost,
};
const SPECIES = { suo: 'dog', kate: 'cat' };
const SEX = { patinas: 'male', patele: 'female' };

function parsePost(post, observedAt) {
  const pet = wp.base(SOURCE, post, observedAt, /^\/globotiniai\/[a-z0-9-]+\/$/);
  const one = taxonomy => { const found = wp.terms(post, taxonomy); return found.length === 1 ? found[0] : null; };
  if (one('statusas')?.slug !== 'dovanojamas') throw Error(`Post ${post.id} is not marked "Dovanojamas"`);
  const reserved = wp.RESERVED.test(pet.name) ? pet.name : null;
  return {
    ...pet,
    species: SPECIES[one('gyvunas')?.slug] ?? null,
    sex: SEX[one('lytis')?.slug] ?? null,
    ageText: wp.plain(one('amzius')?.name) || null,
    status: reserved ? 'reserved' : 'available',
    statusEvidence: reserved ?? 'Statusas „Dovanojamas“',
  };
}

module.exports = { SOURCE, parsePost, collect: options => wp.collect(SOURCE, options) };
