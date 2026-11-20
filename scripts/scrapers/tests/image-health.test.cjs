'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { auditImages } = require('../lib/image-health.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');

test('image checks visit every animal, reuse identical URLs and do not download image bodies', async () => {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: ['images.invalid'], minDelayMs: 0,
    fetchImpl: async (url, options) => {
      calls.push([url, options.method]);
      return new Response('', { headers: { 'content-type': url.endsWith('/robots.txt') ? 'text/plain' : 'image/jpeg' } });
    } });
  const result = await auditImages([
    { id: 'a', photos: ['https://images.invalid/a.jpg'] }, { id: 'b', photos: ['https://images.invalid/a.jpg'] },
    { id: 'c', photos: [] },
  ], { fetcher, allowedHosts: ['images.invalid'] });
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.records.map(r => r.state), ['healthy', 'healthy', 'missing']);
  assert.deepEqual(calls, [['https://images.invalid/robots.txt', 'GET'], ['https://images.invalid/a.jpg', 'HEAD']]);
});

test('broken primary image finds an existing fallback; unknown hosts are never fetched', async () => {
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: ['images.invalid'], minDelayMs: 0,
    fetchImpl: async (url, options) => {
      calls.push([url, options.method]);
      return new Response('', { status: url.endsWith('bad.jpg') ? 404 : 200,
        headers: { 'content-type': url.endsWith('/robots.txt') ? 'text/plain' : 'image/jpeg' } });
    } });
  const animals = [{ id: 'a', photos: ['https://images.invalid/bad.jpg', 'https://images.invalid/good.jpg'] },
    { id: 'b', photos: ['https://unapproved.invalid/private'] }];
  const result = await auditImages(animals, { fetcher, allowedHosts: ['images.invalid'] });
  assert.equal(result.records[0].state, 'fallback_available');
  assert.equal(result.records[0].preferredUrl, 'https://images.invalid/good.jpg');
  assert.equal(result.records[1].state, 'unapproved_host');
  assert.ok(!calls.some(c => c[0].includes('unapproved')));
  assert.equal(animals[0].photos[0], 'https://images.invalid/bad.jpg', 'audit never deletes or silently rewrites source evidence');
});

test('a resumed audit reuses recent successful checks but invalidates a changed primary URL', async () => {
  const f = createFetcher({ allowedHosts: ['images.invalid'], minDelayMs: 0,
    fetchImpl: async url => new Response('', { headers: { 'content-type': url.endsWith('/robots.txt') ? 'text/plain' : 'image/jpeg' } }) });
  const animals = [{ id: 'a', photos: ['https://images.invalid/old.jpg'] }];
  const initial = await auditImages(animals, { fetcher: f, allowedHosts: ['images.invalid'] });
  const count = f.stats().requests;
  const resumed = await auditImages(animals, { fetcher: f, allowedHosts: ['images.invalid'], priorRecords: initial.records });
  assert.equal(f.stats().requests, count);
  assert.equal(resumed.records[0].reused, true);
  await auditImages([{ id: 'a', photos: ['https://images.invalid/new.jpg'] }],
    { fetcher: f, allowedHosts: ['images.invalid'], priorRecords: initial.records });
  assert.equal(f.stats().requests, count + 1);
});
