'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ScraperService } = require('../service.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');

test('two minute ticks audit every animal, publish only complete runs and retain prior data on failure', async t => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-service-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  let time = Date.now(), broken = false, count = 0;
  const adapter = { id: 'fixture', hosts: ['site.invalid'], async collect({ fetcher }) {
    count++;
    await fetcher.get('https://site.invalid/list');
    return { complete: !broken, animals: [{ nativeId: 'a', sourceUrl: 'https://site.invalid/a', name: 'Fixture' }] };
  } };
  const service = new ScraperService({ outDir, adapters: [adapter], now: () => time,
    refreshMs: 3600000, log: () => {},
    fetcherFactory: options => createFetcher({ ...options, minDelayMs: 0,
      fetchImpl: async () => new Response('') }) });
  t.after(() => service.close());
  service.tick(); service.tick();
  await service.idle();
  assert.equal(count, 1);
  const published = fs.readFileSync(path.join(outDir, 'fixture/published.json'), 'utf8');
  const validation = JSON.parse(fs.readFileSync(path.join(outDir, 'fixture/validation.json')));
  assert.equal(validation.checked, 1);
  assert.equal(validation.invalid, 0);
  time += 120000;
  service.tick(); await service.idle();
  assert.equal(count, 1);
  time += 3600000; broken = true;
  service.tick(); await service.idle();
  assert.equal(count, 2);
  assert.equal(fs.readFileSync(path.join(outDir, 'fixture/published.json'), 'utf8'), published);
  const status = JSON.parse(fs.readFileSync(path.join(outDir, 'service-status.json')));
  assert.equal(status.tickMs, 120000);
  assert.equal(status.sources[0].failures, 1);
  assert.equal(status.sources[0].animals, 1);
});

test('scheduled collection checks primary images and promotes a verified fallback without removing source links', async t => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-service-photo-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const adapter = { id: 'fixture', hosts: ['site.invalid'], collect: async () => ({ complete: true,
    animals: [{ nativeId: 'a', sourceUrl: 'https://site.invalid/a', photos: ['https://site.invalid/bad.jpg', 'https://site.invalid/good.jpg'] }] }) };
  const service = new ScraperService({ outDir, adapters: [adapter], log: () => {},
    fetcherFactory: options => createFetcher({ ...options, minDelayMs: 0,
      fetchImpl: async url => new Response('', { status: url.endsWith('bad.jpg') ? 404 : 200,
        headers: { 'content-type': url.endsWith('/robots.txt') ? 'text/plain' : 'image/jpeg' } }) }) });
  t.after(() => service.close());
  service.tick(); await service.idle();
  const snapshot = JSON.parse(fs.readFileSync(path.join(outDir, 'fixture/published.json')));
  assert.deepEqual(snapshot.animals[0].photos, ['https://site.invalid/good.jpg', 'https://site.invalid/bad.jpg']);
  const report = JSON.parse(fs.readFileSync(path.join(outDir, 'fixture/image-health.json')));
  assert.equal(report.records[0].state, 'fallback_available');
});

test('one-off reports cannot overwrite the persistent daemon status', async t => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-one-off-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outDir, 'service-status.json'), '{"state":"persistent-daemon"}');
  const service = new ScraperService({ outDir, adapters: [], statusFile: 'last-one-off-status.json' });
  try { service.tick(); await service.idle(); }
  finally { await service.close(); }
  assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'service-status.json'))).state, 'persistent-daemon');
  assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'last-one-off-status.json'))).state, 'stopped');
});

test('a restricted source is deferred for a day rather than retried every two minutes', async t => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-restricted-source-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const now = 1700000000000;
  const service = new ScraperService({ outDir, now: () => now, log: () => {}, adapters: [{ id: 'fixture', hosts: ['site.invalid'],
    collect: async () => { throw Object.assign(new Error('Restricted'), { code: 'robots_unavailable', status: 403 }); } }] });
  try {
    service.tick(); await service.idle();
    assert.ok(service.queue.status()[0].next_due >= now + 86400000);
  } finally { await service.close(); }
});
