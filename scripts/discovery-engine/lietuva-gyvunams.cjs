// Adapter for https://lietuvagyvunams.com (WordPress). Reads the public REST API,
// category "Ieško namų". It only reports; it never writes app data or publishes.
//
// Rules: respect robots.txt, one request at a time with a pause, same host only,
// never invent facts. The site has no sex/size/species fields, so those stay null.
// Any error or count mismatch fails the whole run (no partial results).
const SOURCE = {
  id: 'lietuvagyvunams',
  origin: 'https://lietuvagyvunams.com',
  category: 8, // "Ieško namų"
  shelterId: 'lietuvagyvunams',
  userAgent: 'GlobisBot/0.1 (+https://github.com/nojusdr-lab/globis)',
};
const FIELDS = 'id,slug,link,date,modified,title,excerpt,content,categories';
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

function siteUrl(value, pathPattern) {
  let url;
  try { url = new URL(value); } catch { return null; }
  return url.origin === SOURCE.origin && !url.username && !url.password && pathPattern.test(url.pathname) ? url.href : null;
}

function parsePost(post, observedAt) {
  if (!post || !Number.isSafeInteger(post.id) || post.id < 1) throw Error('Invalid post ID');
  if (!Array.isArray(post.categories) || !post.categories.includes(SOURCE.category)) {
    throw Error(`Post ${post.id} is not in the adoption category`);
  }
  const url = siteUrl(post.link, /^\/[a-z0-9-]+\/$/);
  if (!url) throw Error(`Unexpected listing URL for post ${post.id}`);
  const name = plain(post.title?.rendered);
  if (!name) throw Error(`Missing name for post ${post.id}`);

  const excerpt = plain(post.excerpt?.rendered);
  const age = /Amžius:\s*([^|\n]+)/i.exec(excerpt)?.[1].trim() ?? null;
  const city = /Miestas:\s*([^|\n]+)/i.exec(excerpt)?.[1].trim() ?? null;
  const content = post.content?.rendered ?? '';
  const photos = [...new Set([...content.matchAll(/<img\b[^>]*?\bsrc="([^"]+)"/gi)]
    .map(match => siteUrl(decode(match[1]), /^\/wp-content\/uploads\/[\w./-]+\.(?:jpe?g|png|webp)$/i))
    .filter(Boolean))];
  const reserved = [name, excerpt].find(text => /\brezervuot(?:as|a)\b/iu.test(text));

  return {
    id: `${SOURCE.id}:${post.id}`, source: SOURCE.id, url,
    name, species: null, sex: null, size: null,
    ageText: age && !/^nežinoma/i.test(age) ? age : null,
    city: city || null,
    photos,
    medical: { chipped: null, vaccinated: null, neutered: null },
    bioLt: plain(content) || null,
    status: reserved ? 'reserved' : 'available',
    statusEvidence: reserved ?? 'Kategorija „Ieško namų“',
    sourceUpdatedAt: typeof post.modified === 'string' ? post.modified : null,
    observedAt,
    shelter: { id: SOURCE.shelterId },
  };
}

// Minimal robots.txt check for "User-agent: *" groups: is this path disallowed?
function robotsAllows(robots, path) {
  let applies = false, verdict = true, length = -1;
  for (const raw of robots.split('\n')) {
    const [key, ...rest] = raw.split('#')[0].split(':');
    const value = rest.join(':').trim();
    const field = key.trim().toLowerCase();
    if (field === 'user-agent') applies = value === '*';
    else if (applies && (field === 'allow' || field === 'disallow') && value &&
             path.startsWith(value) && value.length > length) {
      length = value.length; verdict = field === 'allow';
    }
  }
  return verdict;
}

async function collect({ fetch = globalThis.fetch, now = Date.now, perPage = 100,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), delayMs = 2000 } = {}) {
  const startedAt = new Date(now()).toISOString();
  const headers = { 'User-Agent': SOURCE.userAgent, Accept: 'application/json' };
  try {
    const robots = await fetch(`${SOURCE.origin}/robots.txt`, { headers });
    if (robots.status !== 200) throw Error(`robots.txt returned ${robots.status}`);
    if (!robotsAllows(await robots.text(), '/wp-json/wp/v2/posts')) throw Error('robots.txt disallows the API');

    const pets = [], ids = new Set();
    let total = null, pages = 1;
    for (let page = 1; page <= pages; page++) {
      await sleep(delayMs);
      const response = await fetch(`${SOURCE.origin}/wp-json/wp/v2/posts?categories=${SOURCE.category}` +
        `&per_page=${perPage}&page=${page}&orderby=id&order=asc&_fields=${FIELDS}`, { headers });
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
        const pet = parsePost(post, observedAt);
        if (ids.has(pet.id)) throw Error(`Duplicate listing ${pet.id}`);
        ids.add(pet.id); pets.push(pet);
      }
    }
    if (!total || pets.length !== total) throw Error(`Expected ${total} listings, got ${pets.length}`);
    return { source: SOURCE.id, state: 'complete', startedAt, finishedAt: new Date(now()).toISOString(), total, pets };
  } catch (error) {
    return { source: SOURCE.id, state: 'failed', startedAt, finishedAt: new Date(now()).toISOString(),
      total: null, pets: [], error: String(error.message ?? error) };
  }
}

module.exports = { SOURCE, parsePost, collect, plain, robotsAllows };

// CLI: prints the run as JSON; exit code 1 when the run failed. Writes nothing.
if (require.main === module) {
  collect().then(run => {
    console.log(JSON.stringify(run, null, 1));
    process.exitCode = run.state === 'complete' ? 0 : 1;
  });
}
