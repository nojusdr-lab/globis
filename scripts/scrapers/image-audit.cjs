'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createFetcher } = require('./lib/polite-fetch.cjs');
const { auditImages } = require('./lib/image-health.cjs');
const { writeJsonAtomic } = require('./lib/snapshot.cjs');
const adapters = require('./adapters/index.cjs');
const { HttpGate } = require('./lib/http-gate.cjs');

async function main() {
  const outDir = path.resolve(process.argv[2] || 'data/scraped-local');
  const jobs = adapters.filter(a => fs.existsSync(path.join(outDir, a.id, 'published.json')));
  const results = [];
  fs.mkdirSync(outDir, { recursive: true });
  const gate = new HttpGate(path.join(outDir, '.http-gate.sqlite'));
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (jobs.length) {
      const adapter = jobs.shift();
      const animals = JSON.parse(fs.readFileSync(path.join(outDir, adapter.id, 'published.json'))).animals;
      // CDN used in the shelter's own API. No arbitrary discovered hosts.
      const hosts = [...adapter.hosts, ...(adapter.photoHosts || [])];
      const fetcher = createFetcher({ allowedHosts: hosts, gate });
      const records = [];
      const file = path.join(outDir, adapter.id, 'image-health.json');
      writeJsonAtomic(file, { state: 'running', expected: animals.length, checked: 0, records: [] });
      const report = await auditImages(animals, { fetcher, allowedHosts: hosts, onRecord: record => {
        records.push(record);
        if (records.length % 10 === 0) writeJsonAtomic(file, { state: 'running', expected: animals.length, checked: records.length, records });
      } });
      writeJsonAtomic(file, { state: 'complete', ...report });
      results.push({ source: adapter.id, checked: report.checked, byState: report.byState, requests: fetcher.stats().requests });
      writeJsonAtomic(path.join(outDir, 'image-health-summary.json'), results);
      console.log(JSON.stringify(results.at(-1)));
    }
  }));
  gate.close();
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
