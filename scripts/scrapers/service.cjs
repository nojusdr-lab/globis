'use strict';
// Local deterministic scheduler: ticks every two minutes, collects only due sources.
// No Supabase writes, Git commits, LLM calls, cookies or credentials.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { ScheduleQueue } = require('./lib/schedule-queue.cjs');
const { createFetcher } = require('./lib/polite-fetch.cjs');
const { createParseCache } = require('./lib/parse-cache.cjs');
const { runSource } = require('./lib/run-source.cjs');
const { publish, writeJsonAtomic } = require('./lib/snapshot.cjs');
const { writeReports } = require('./coverage.cjs');
const { auditRun } = require('./lib/quality.cjs');

function enabledAdapters() {
  // Re-read decisions every tick so pausing a source takes effect without restarting.
  const { sources } = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8'));
  const enabled = new Set(sources.filter(s => s.decision === 'adapter').map(s => s.adapterId || s.id));
  return require('./adapters/index.cjs').filter(a => enabled.has(a.id));
}

class ScraperService {
  constructor({ outDir, adapters, now = Date.now, refreshMs = 6 * 3600000,
    poolSize = 4, tickMs = 120000, maxRunMs = 45 * 60000,
    fetcherFactory = createFetcher, log = console.log } = {}) {
    if (!outDir || !Number.isInteger(poolSize) || poolSize < 1 || poolSize > 4) throw Error('Expected outDir and 1–4 workers');
    this.outDir = path.resolve(outDir); this.now = now; this.poolSize = poolSize;
    this.tickMs = tickMs; this.maxRunMs = maxRunMs; this.log = log;
    this.fetcherFactory = fetcherFactory; this.configured = adapters;
    this.worker = `${process.pid}:${randomUUID()}`; this.active = new Map(); this.stopping = false;
    fs.mkdirSync(this.outDir, { recursive: true, mode: 0o700 });
    this.queue = new ScheduleQueue(path.join(this.outDir, 'queue.sqlite'), { now, refreshMs });
    this.cache = createParseCache(path.join(this.outDir, '.parse-cache'));
  }
  tick() {
    if (this.stopping) return;
    this.lastTick = this.now();
    this.adapters = this.configured || enabledAdapters();
    this.queue.sync(this.adapters);
    for (const adapter of this.adapters) {
      const file = path.join(this.outDir, adapter.id, 'published.json');
      if (!fs.existsSync(file)) continue;
      const attemptFile = path.join(this.outDir, adapter.id, 'last-run.json');
      if (fs.existsSync(attemptFile)) {
        const attempt = JSON.parse(fs.readFileSync(attemptFile, 'utf8'));
        if (attempt.state !== 'complete' || attempt.published === false) continue;
      }
      const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
      const quality = auditRun({ animals: snapshot.animals, finishedAt: snapshot.publishedAt }, adapter);
      if (!quality.invalid) this.queue.bootstrap(adapter.id, Date.parse(snapshot.publishedAt), snapshot.animals.length);
    }
    this.pump(); this.report();
  }
  pump() {
    if (this.stopping) return;
    while (this.active.size < this.poolSize) {
      const job = this.queue.claim(this.worker);
      if (!job) break;
      const controller = new AbortController();
      const promise = this.execute(job, controller).catch(error => {
        this.fatal = error; this.stopping = true;
        this.log('Scheduler stopped: ' + error.message);
      }).finally(() => {
        this.active.delete(job.id);
        if (!this.stopping) this.pump();
        this.report();
      });
      this.active.set(job.id, { promise, controller });
    }
  }
  async execute(job, controller) {
    const adapter = this.adapters.find(a => a.id === job.id);
    const heartbeat = setInterval(() => {
      try { if (!this.queue.renew(job)) controller.abort(); }
      catch (error) { this.fatal = error; this.stopping = true; controller.abort(); }
    }, 10000);
    const deadline = setTimeout(() => controller.abort(new Error('Source run deadline exceeded')), this.maxRunMs);
    try {
      const fetcher = this.fetcherFactory({ allowedHosts: adapter.hosts, signal: controller.signal,
        log: message => this.log(`[${adapter.id}] ${message}`) });
      const run = await runSource(adapter, { fetcher, cache: this.cache,
        now: () => new Date(this.now()).toISOString(), log: message => this.log(`[${adapter.id}] ${message}`) });
      if (controller.signal.aborted) { run.state = 'failed'; run.errors.push('Run stopped or lease lost'); }
      const retryAfterMs = run.failure?.code === 'robots' ? 24 * 3600000 : run.failure?.retryAfterMs;
      const accepted = this.queue.finish(job, { ok: false, animals: run.animals.length, retryAfterMs }, () => {
        const result = publish(run, { outDir: this.outDir });
        return { ok: result.published, error: run.errors.join('; ') || result.reason };
      });
      this.log(JSON.stringify({ source: adapter.id, state: run.state, checked: run.quality.checked,
        invalid: run.quality.invalid, leaseAccepted: accepted }));
    } finally { clearInterval(heartbeat); clearTimeout(deadline); }
  }
  report() {
    writeReports(this.outDir);
    writeJsonAtomic(path.join(this.outDir, 'service-status.json'), {
      updatedAt: new Date(this.now()).toISOString(), lastTick: this.lastTick ? new Date(this.lastTick).toISOString() : null,
      nextTick: this.stopping ? null : new Date((this.lastTick || this.now()) + this.tickMs).toISOString(),
      tickMs: this.tickMs, state: this.fatal ? 'failed' : this.stopping ? 'stopped' : 'running',
      active: [...this.active.keys()], sources: this.queue.status(),
    });
  }
  async idle() {
    while (this.active.size) await Promise.all([...this.active.values()].map(a => a.promise));
    if (this.fatal) throw this.fatal;
  }
  async close() {
    if (this.closed) return;
    this.stopping = true;
    for (const active of this.active.values()) active.controller.abort();
    try { await this.idle(); }
    finally {
      try { this.report(); }
      finally { this.queue.close(); this.closed = true; }
    }
  }
}

async function main() {
  const args = process.argv.slice(2), once = args.includes('--once');
  const unknown = args.filter(a => a.startsWith('--') && a !== '--once');
  if (unknown.length) throw Error('Unknown option: ' + unknown.join(', '));
  const outDir = args.find(a => !a.startsWith('--')) || 'data/scraped-local';
  process.umask(0o077);
  const service = new ScraperService({ outDir });
  let timer;
  const stop = async () => { clearInterval(timer); await service.close(); };
  const onSignal = () => { stop().catch(error => { console.error(error.message); process.exitCode = 1; }); };
  process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
  try {
    service.tick();
    if (once) { await service.idle(); await stop(); }
    else timer = setInterval(() => {
      try { if (service.fatal) throw service.fatal; service.tick(); }
      catch (error) { console.error(error.message); process.exitCode = 1; onSignal(); }
    }, service.tickMs);
  } catch (error) { await stop(); throw error; }
}

module.exports = { ScraperService, enabledAdapters };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
