'use strict';
// Check a primary image with HEAD. No image downloads and no face/image model.
// Inconclusive/access failures are kept distinct from a confirmed HTTP 404/410.
async function auditImages(animals, { fetcher, allowedHosts, now = () => new Date().toISOString(), onRecord = () => {} }) {
  const cache = new Map(), paused = new Map(), records = [];
  async function check(url) {
    let parsed;
    try { parsed = new URL(url); } catch { return { state: 'invalid_url', url }; }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || !allowedHosts.includes(parsed.hostname)) {
      return { state: 'unapproved_host', url };
    }
    if (paused.has(parsed.hostname)) return { state: 'deferred', url, reason: paused.get(parsed.hostname) };
    if (cache.has(url)) return cache.get(url);
    let result;
    try {
      const response = await fetcher.head(url);
      result = { state: /^image\//i.test(response.contentType) ? 'healthy' : 'unexpected_content_type', url,
        status: response.status, contentType: response.contentType, checkedAt: now() };
    } catch (error) {
      result = { url, state: [404, 410].includes(error.status) ? 'broken' : 'inconclusive',
        status: error.status ?? null, code: error.code ?? null, checkedAt: now() };
      if ([401, 403, 405, 429].includes(error.status) || error.status >= 500 ||
          error.code === 'robots' || error.code === 'robots_unavailable') paused.set(parsed.hostname, error.code || 'http_' + error.status);
    }
    cache.set(url, result); return result;
  }
  for (const animal of animals) {
    const checks = [];
    for (const url of animal.photos || []) {
      const result = await check(url); checks.push(result);
      if (result.state === 'healthy' || !['broken', 'unexpected_content_type'].includes(result.state)) break;
    }
    const healthy = checks.find(c => c.state === 'healthy');
    const record = { id: animal.id, sourceUrl: animal.sourceUrl ?? null,
      state: healthy ? (checks.length === 1 ? 'healthy' : 'fallback_available') : checks[0]?.state || 'missing',
      preferredUrl: healthy?.url ?? null, checks };
    records.push(record); onRecord(record);
  }
  return { generatedAt: now(), checked: records.length,
    byState: records.reduce((o, r) => { o[r.state] = (o[r.state] || 0) + 1; return o; }, {}), records };
}

module.exports = { auditImages };
