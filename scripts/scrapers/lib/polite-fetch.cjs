'use strict';
// Polite HTTP client for shelter sites.
// - GET only, only to hosts the adapter declared.
// - Reads robots.txt first. 404/410 = no rules. Any other failure = deny all (fail-closed).
// - One request at a time per host, at least minDelayMs apart (or robots Crawl-delay if larger).
// - Identifies itself honestly. No cookies, no logins, no header tricks.
const { parseRobots, isAllowed, crawlDelay, DENY_ALL, ALLOW_ALL } = require('./robots.cjs');
const { sha256 } = require('./hash.cjs');

const USER_AGENT = 'GlobisBot/0.1 (+https://github.com/nojusdr-lab/globis; gyvunu globos katalogas)';

class FetchError extends Error {
  constructor(message, { url, status, code, retryAfterMs } = {}) {
    super(message);
    this.url = url; this.status = status; this.code = code; this.retryAfterMs = retryAfterMs;
  }
}

function createFetcher({
  fetchImpl = globalThis.fetch,
  allowedHosts,
  userAgent = USER_AGENT,
  minDelayMs = 5000,
  timeoutMs = 20000,
  maxBytes = 5 * 1024 * 1024,
  sleep = ms => new Promise(r => setTimeout(r, ms)),
  now = () => Date.now(),
  log = () => {},
  signal,
  gate,
} = {}) {
  if (!Array.isArray(allowedHosts) || !allowedHosts.length) throw new Error('allowedHosts required');
  const hosts = new Set(allowedHosts.map(h => h.toLowerCase()));
  const robotsByOrigin = new Map();
  const robotsFailures = new Map();
  const evidence = [];
  const lastRequestAt = new Map();
  const queueByHost = new Map();
  let requests = 0;

  async function rawGet(url, method = 'GET') {
    signal?.throwIfAborted();
    const host = url.hostname;
    const prev = queueByHost.get(host) || Promise.resolve();
    let release;
    const turn = new Promise(r => { release = r; });
    queueByHost.set(host, prev.then(() => turn));
    await prev;
    let releaseShared;
    try {
      signal?.throwIfAborted();
      const robots = robotsByOrigin.get(url.origin);
      const delay = Math.max(minDelayMs, ((robots && crawlDelay(robots, userAgent)) || 0) * 1000);
      const last = lastRequestAt.get(host);
      if (last != null) {
        const wait = last + delay - now();
        if (wait > 0) await sleep(wait);
      }
      signal?.throwIfAborted();
      if (gate) releaseShared = await gate.enter(host, delay, timeoutMs, signal);
      lastRequestAt.set(host, now());
      requests++;
      log(`${method} ${url.href}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url.href, {
          method,
          redirect: 'manual',
          signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
          headers: { 'user-agent': userAgent, accept: 'text/html,application/json;q=0.9,*/*;q=0.5' },
        });
        let body;
        if (res.body?.getReader) {
          const reader = res.body.getReader(), chunks = [];
          let bytes = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > maxBytes) {
                await reader.cancel();
                throw new FetchError('Response too large', { url: url.href, code: 'too_large' });
              }
              chunks.push(Buffer.from(value));
            }
            body = Buffer.concat(chunks).toString('utf8');
          } finally { reader.releaseLock(); }
        } else {
          body = await res.text();
          if (Buffer.byteLength(body) > maxBytes) throw new FetchError('Response too large', { url: url.href, code: 'too_large' });
        }
        evidence.push({ url: url.href, method, status: res.status, hash: method === 'HEAD' ? null : sha256(body),
          observedAt: new Date(now()).toISOString() });
        if (res.status === 429 || res.status >= 500) gate?.defer(host, retryAfter(res.headers.get('retry-after')));
        return { status: res.status, headers: res.headers, body };
      } finally {
        clearTimeout(timer);
      }
    } finally {
      try { if (releaseShared) releaseShared(); }
      finally { release(); }
    }
  }

  async function loadRobots(origin) {
    if (robotsByOrigin.has(origin)) return robotsByOrigin.get(origin);
    let robots;
    try {
      // RFC 9309: follow up to 5 redirects (e.g. http -> https), only to declared hosts.
      let url = new URL('/robots.txt', origin);
      let res = await rawGet(url);
      for (let i = 0; i < 5 && [301, 302, 303, 307, 308].includes(res.status); i++) {
        const next = new URL(res.headers.get('location') || '', url);
        if (!hosts.has(next.hostname.toLowerCase())) break;
        url = next;
        res = await rawGet(url);
      }
      if (res.status >= 200 && res.status < 300) robots = parseRobots(res.body);
      else if (res.status === 404 || res.status === 410) robots = ALLOW_ALL;
      else {
        robots = DENY_ALL;
        robotsFailures.set(origin, { status: res.status, retryAfterMs: retryAfter(res.headers.get('retry-after')) });
      }
    } catch (error) {
      robots = DENY_ALL;
      robotsFailures.set(origin, { status: error.status, retryAfterMs: error.retryAfterMs });
    }
    robotsByOrigin.set(origin, robots);
    return robots;
  }

  async function get(href, { redirects = 3, method = 'GET' } = {}) {
    signal?.throwIfAborted();
    if (!['GET', 'HEAD'].includes(method)) throw new FetchError('Read-only requests only', { code: 'method' });
    const url = new URL(href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new FetchError('Unsupported protocol', { url: href, code: 'protocol' });
    if (url.username || url.password) throw new FetchError('Credentials in URL', { url: href, code: 'credentials' });
    if (!hosts.has(url.hostname.toLowerCase())) throw new FetchError(`Host not allowed: ${url.hostname}`, { url: href, code: 'host' });
    const robots = await loadRobots(url.origin);
    if (!isAllowed(robots, userAgent, url.pathname + url.search)) {
      const failure = robotsFailures.get(url.origin);
      if (failure) throw new FetchError('robots.txt unavailable; collection stopped', { url: href, code: 'robots_unavailable', ...failure });
      throw new FetchError(`Blocked by robots.txt: ${url.pathname}`, { url: href, code: 'robots' });
    }
    const res = await rawGet(url, method);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location || redirects <= 0) throw new FetchError('Bad redirect', { url: href, status: res.status, code: 'redirect' });
      return get(new URL(location, url).href, { redirects: redirects - 1, method });
    }
    if (res.status === 401 || res.status === 403) throw new FetchError('Access restricted', { url: href, status: res.status, code: 'restricted' });
    if (res.status < 200 || res.status >= 300) throw new FetchError(`HTTP ${res.status}`, {
      url: href, status: res.status, code: 'http', retryAfterMs: retryAfter(res.headers.get('retry-after')) });
    return { url: url.href, status: res.status, body: res.body, contentType: res.headers.get('content-type') || '', hash: sha256(res.body) };
  }

  async function getJson(href) {
    const page = await get(href);
    try { return { ...page, json: JSON.parse(page.body) }; }
    catch { throw new FetchError('Invalid JSON', { url: href, code: 'json' }); }
  }

  function retryAfter(value) {
    if (!value) return null;
    const ms = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now();
    return Number.isFinite(ms) ? Math.max(0, ms) : null;
  }

  return { get, getJson, head: href => get(href, { method: 'HEAD' }), robotsFor: loadRobots,
    stats: () => ({ requests }), evidence: () => evidence.map(e => ({ ...e })) };
}

module.exports = { createFetcher, FetchError, USER_AGENT };
