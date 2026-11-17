// Shared reader for shelter sites built on WordPress (public REST API). Report only:
// it never writes app data or publishes.
//
// Rules: respect robots.txt (including Crawl-delay), one request at a time with a pause,
// same host only, never invent facts. Any error or count mismatch fails the whole run.
const USER_AGENT = 'GlobisBot/0.1 (+https://github.com/nojusdr-lab/globis)';
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] !== '#') return entities[code.toLowerCase()] ?? match;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  });
}

// HTML to plain text. Emoji images keep their alt text; scripts and styles are dropped.
function plain(html) {
  if (typeof html !== 'string') return '';
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*?\balt="([^"]*)"[^>]*>/gi, '$1')
    .replace(/<\/(p|div|h\d|li|figure)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decode(text).split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
}

function siteUrl(origin, value, pathPattern) {
  let url;
  try { url = new URL(value); } catch { return null; }
  return url.origin === origin && !url.username && !url.password && pathPattern.test(url.pathname) ? url.href : null;
}

const UPLOAD = /^\/wp-content\/uploads\/[\w./-]+\.(?:jpe?g|png|webp)$/i;

// Photos from the site's own uploads folder: the featured image first, then images in the text.
function photos(origin, post) {
  const featured = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  const inText = [...(post.content?.rendered ?? '').matchAll(/<img\b[^>]*?\bsrc="([^"]+)"/gi)]
    .map(match => decode(match[1]));
  return [...new Set([featured, ...inText].map(src => siteUrl(origin, src, UPLOAD)).filter(Boolean))];
}

// Slugs of the post's terms in one taxonomy (needs the "_embed=wp:term" query).
function terms(post, taxonomy) {
  return (post._embedded?.['wp:term'] ?? []).flat().filter(term => term?.taxonomy === taxonomy);
}

// Checks shared by every adapter; returns the fields every listing has.
function base(source, post, observedAt, linkPattern) {
  if (!post || !Number.isSafeInteger(post.id) || post.id < 1) throw Error('Invalid post ID');
  const url = siteUrl(source.origin, post.link, linkPattern);
  if (!url) throw Error(`Unexpected listing URL for post ${post.id}`);
  const name = plain(post.title?.rendered);
  if (!name) throw Error(`Missing name for post ${post.id}`);
  return {
    id: `${source.id}:${post.id}`, source: source.id, url,
    name, species: null, sex: null, size: null, ageText: null, city: null,
    photos: photos(source.origin, post),
    medical: { chipped: null, vaccinated: null, neutered: null },
    bioLt: plain(post.content?.rendered) || null,
    status: 'unknown', statusEvidence: null,
    sourceUpdatedAt: typeof post.modified === 'string' ? post.modified : null,
    observedAt,
    shelter: { id: source.shelterId },
  };
}

// Minimal robots.txt reader for "User-agent: *" groups.
function robotsRules(robots, path) {
  let applies = false, allowed = true, length = -1, crawlDelayMs = 0;
  for (const raw of robots.split('\n')) {
    const [key, ...rest] = raw.split('#')[0].split(':');
    const value = rest.join(':').trim();
    const field = key.trim().toLowerCase();
    if (field === 'user-agent') applies = value === '*';
    else if (!applies) continue;
    else if (field === 'crawl-delay' && Number(value) > 0) crawlDelayMs = Number(value) * 1000;
    else if ((field === 'allow' || field === 'disallow') && value &&
             path.startsWith(value) && value.length > length) {
      length = value.length; allowed = field === 'allow';
    }
  }
  return { allowed, crawlDelayMs };
}
const robotsAllows = (robots, path) => robotsRules(robots, path).allowed;

async function collect(source, { fetch = globalThis.fetch, now = Date.now, perPage = 100,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), delayMs = 2000 } = {}) {
  const startedAt = new Date(now()).toISOString();
  const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json' };
  try {
    const robots = await fetch(`${source.origin}/robots.txt`, { headers });
    if (robots.status !== 200) throw Error(`robots.txt returned ${robots.status}`);
    const rules = robotsRules(await robots.text(), source.path);
    if (!rules.allowed) throw Error('robots.txt disallows the API');
    const pause = Math.max(delayMs, rules.crawlDelayMs);

    const pets = [], ids = new Set();
    let total = null, pages = 1;
    for (let page = 1; page <= pages; page++) {
      await sleep(pause);
      const response = await fetch(`${source.origin}${source.path}?${source.query}` +
        `&per_page=${perPage}&page=${page}&orderby=id&order=asc`, { headers });
      if (response.status !== 200) throw Error(`Page ${page} returned ${response.status}`);
      const pageTotal = Number(response.headers.get('x-wp-total'));
      const pageCount = Number(response.headers.get('x-wp-totalpages'));
      if (!Number.isSafeInteger(pageTotal) || !Number.isSafeInteger(pageCount) || pageCount > 50 ||
          (total !== null && pageTotal !== total)) throw Error('Missing or changing total count');
      total = pageTotal; pages = pageCount;
      const posts = await response.json();
      if (!Array.isArray(posts)) throw Error(`Page ${page} is not a list`);
      const observedAt = new Date(now()).toISOString();
      for (const post of posts) {
        const pet = source.parse(post, observedAt);
        if (ids.has(pet.id)) throw Error(`Duplicate listing ${pet.id}`);
        ids.add(pet.id); pets.push(pet);
      }
    }
    if (!total || pets.length !== total) throw Error(`Expected ${total} listings, got ${pets.length}`);
    return { source: source.id, state: 'complete', startedAt, finishedAt: new Date(now()).toISOString(), total, pets };
  } catch (error) {
    return { source: source.id, state: 'failed', startedAt, finishedAt: new Date(now()).toISOString(),
      total: null, pets: [], error: String(error.message ?? error) };
  }
}

const RESERVED = /\brezervuot(?:as|a)\b/iu;

module.exports = { base, collect, plain, robotsAllows, terms, RESERVED };
