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
