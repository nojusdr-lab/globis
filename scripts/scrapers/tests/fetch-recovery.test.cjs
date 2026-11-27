'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFetcher } = require('../lib/polite-fetch.cjs');

test('HTTP rate limits expose Retry-After without issuing an immediate retry', async () => {
  let pages = 0;
  const f = createFetcher({ allowedHosts: ['site.invalid'], minDelayMs: 0,
    fetchImpl: async url => url.endsWith('/robots.txt') ? new Response('User-agent: *\nAllow: /')
      : (pages++, new Response('', { status: 429, headers: { 'retry-after': '600' } })) });
  await assert.rejects(f.get('https://site.invalid/animals'), e => e.status === 429 && e.retryAfterMs === 600000);
  assert.equal(pages, 1);
});

test('run cancellation stops requests and evidence retains hashes without storing page text', async () => {
  const controller = new AbortController();
  const f = createFetcher({ allowedHosts: ['site.invalid'], minDelayMs: 0, signal: controller.signal,
    fetchImpl: async url => new Response(url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : 'private contact should not enter evidence') });
  await f.get('https://site.invalid/animals');
  const evidence = f.evidence();
  assert.match(evidence.find(e => e.url.endsWith('/animals')).hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(evidence), /private contact/);
  controller.abort();
  await assert.rejects(f.get('https://site.invalid/another'), /abort/i);
});

test('response size is measured in bytes rather than JavaScript string length', async () => {
  const f = createFetcher({ allowedHosts: ['site.invalid'], minDelayMs: 0, maxBytes: 32,
    fetchImpl: async url => new Response(url.endsWith('/robots.txt') ? '' : '🐕'.repeat(10)) });
  await assert.rejects(f.get('https://site.invalid/large'), e => e.code === 'too_large');
});
