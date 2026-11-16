'use strict';
// Collect animals from every enabled shelter website, one site after another per host,
// and publish each source's snapshot only if the run is complete and passes the guard.
// Usage: node scripts/scrapers/run.cjs [outDir] [id1,id2]
const path = require('node:path');
const adapters = require('./adapters/index.cjs');
const { createFetcher } = require('./lib/polite-fetch.cjs');
const { createParseCache } = require('./lib/parse-cache.cjs');
const { runSource } = require('./lib/run-source.cjs');
const { publish } = require('./lib/snapshot.cjs');

async function main() {
  const outDir = path.resolve(process.argv[2] || 'data/scraped');
  const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
  const cache = createParseCache(path.join(outDir, '.parse-cache'));
  const todo = adapters.filter(a => !only || only.has(a.id));
  const report = [];
  const workers = Array.from({ length: Math.min(4, todo.length) }, async () => {
    while (todo.length) {
      const adapter = todo.shift();
      const fetcher = createFetcher({ allowedHosts: adapter.hosts, log: m => console.log(`[${adapter.id}] ${m}`) });
      const run = await runSource(adapter, { fetcher, cache, log: m => console.log(m) });
      const result = publish(run, { outDir });
      report.push({ source: adapter.id, state: run.state, animals: run.animals.length, skipped: run.skipped.length, requests: run.requests, published: result.published, reason: result.reason, errors: run.errors.slice(0, 5) });
      console.log(JSON.stringify(report.at(-1)));
    }
  });
  await Promise.all(workers);
  require('node:fs').writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  if (report.some(r => r.state === 'failed')) process.exitCode = 1;
}

main();
