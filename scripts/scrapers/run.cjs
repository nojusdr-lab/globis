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
  const unknown = only ? [...only].filter(id => !adapters.some(a => a.id === id)) : [];
  if (unknown.length) throw new Error(`Unknown source id(s): ${unknown.join(', ')}`);
  const todo = adapters.filter(a => !only || only.has(a.id));
  require('node:fs').mkdirSync(outDir, { recursive: true });
  const { HttpGate } = require('./lib/http-gate.cjs');
  const gate = new HttpGate(path.join(outDir, '.http-gate.sqlite'));
  const report = [];
  // Optional: also load each run into Supabase Postgres. Connection string comes only from the environment (CI secret).
  let db = null;
  let databaseError = null;
  if (process.env.SUPABASE_DB_URL) {
    const { Client } = require('pg');
    const { postgresConfig } = require('./lib/postgres-config.cjs');
    try {
      db = new Client(postgresConfig());
      await db.connect();
    } catch (error) {
      // The local snapshots still provide the bundled fallback during an outage.
      databaseError = 'error: ' + error.message;
      process.exitCode = 1;
      try { if (db) await db.end(); }
      catch (closeError) { console.error('Database cleanup failed: ' + closeError.message); }
      db = null;
    }
  }
  const { loadRun } = require('./lib/supabase-load.cjs');
  let dbQueue = Promise.resolve();
  const workers = Array.from({ length: Math.min(4, todo.length) }, async () => {
    while (todo.length) {
      const adapter = todo.shift();
      const fetcher = createFetcher({ allowedHosts: adapter.hosts, gate, log: m => console.log(`[${adapter.id}] ${m}`) });
      const run = await runSource(adapter, { fetcher, cache, log: m => console.log(m) });
      const result = publish(run, { outDir });
      const sourceReport = { source: adapter.id, state: run.state, animals: run.animals.length,
        skipped: run.skipped.length, requests: run.requests, published: result.published,
        reason: result.reason, errors: run.errors.slice(0, 5) };
      if (databaseError) sourceReport.db = databaseError;
      report.push(sourceReport);
      if (db) {
        // One shared client: serialize loads so transactions from parallel workers never interleave.
        dbQueue = dbQueue.then(() => loadRun(db, adapter, run)).then(
          r => {
            sourceReport.db = r.published ? 'published' : r.reason;
            if (!r.published) process.exitCode = 1;
          },
          e => { sourceReport.db = `error: ${e.message}`; process.exitCode = 1; });
        await dbQueue;
      }
      console.log(JSON.stringify(sourceReport));
    }
  });
  await Promise.all(workers);
  require('node:fs').writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  if (db) await db.end();
  gate.close();
  if (report.some(r => r.state !== 'complete' || !r.published)) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
