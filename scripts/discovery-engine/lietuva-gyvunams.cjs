// https://lietuvagyvunams.com: posts in the category "Ieško namų".
// The site has no sex/size/species fields, so those stay null.
const wp = require('./wp-rest.cjs');

const SOURCE = {
  id: 'lietuvagyvunams',
  origin: 'https://lietuvagyvunams.com',
  category: 8, // "Ieško namų"
  shelterId: 'lietuvagyvunams',
  path: '/wp-json/wp/v2/posts',
  query: 'categories=8&_fields=id,slug,link,date,modified,title,excerpt,content,categories',
  parse: parsePost,
};

function parsePost(post, observedAt) {
  const pet = wp.base(SOURCE, post, observedAt, /^\/[a-z0-9-]+\/$/);
  if (!Array.isArray(post.categories) || !post.categories.includes(SOURCE.category)) {
    throw Error(`Post ${post.id} is not in the adoption category`);
  }
  const excerpt = wp.plain(post.excerpt?.rendered);
  const age = /Amžius:\s*([^|\n]+)/i.exec(excerpt)?.[1].trim() ?? null;
  const city = /Miestas:\s*([^|\n]+)/i.exec(excerpt)?.[1].trim() ?? null;
  const reserved = [pet.name, excerpt].find(text => wp.RESERVED.test(text));
  return {
    ...pet,
    ageText: age && !/^nežinoma/i.test(age) ? age : null,
    city: city || null,
    status: reserved ? 'reserved' : 'available',
    statusEvidence: reserved ?? 'Kategorija „Ieško namų“',
  };
}

module.exports = { SOURCE, parsePost, collect: options => wp.collect(SOURCE, options) };
