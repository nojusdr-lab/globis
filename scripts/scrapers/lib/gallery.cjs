'use strict';
const H = require('./html.cjs');
const { sha256 } = require('./hash.cjs');

// A source-specific gallery selector is mandatory. Never use a site-wide image,
// social emoji, og fallback, related-animal card or a guessed URL.
function galleryPhotos(body, url, { selector, attribute = 'src' }) {
  const $ = H.load(body), host = new URL(url).hostname.replace(/^www\./, '');
  return [...new Set($(selector).map((_, el) => attribute === 'src'
    ? H.imgSrc($(el), url) : H.abs($(el).attr(attribute), url)).get().filter(value => {
    if (!value) return false;
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && u.hostname.replace(/^www\./, '') === host;
  }))];
}

async function fillMissingGallery(animals, { fetcher, cache, log = () => {} }, { selector, attribute = 'src', version }) {
  for (const animal of animals.filter(a => !a.photos?.length)) {
    try {
      const page = await fetcher.get(animal.sourceUrl);
      const parse = () => galleryPhotos(page.body, page.url, { selector, attribute });
      animal.photos = await cache.getOrParse(sha256(page.body + '\n' + page.url), version, parse);
    } catch (error) { log(`Missing-photo gallery unavailable: ${error.message}`); }
  }
}

module.exports = { fillMissingGallery, galleryPhotos };
