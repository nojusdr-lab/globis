'use strict';
// Runs one adapter and turns its output into a validated run.
// Any thrown error or adapter-reported incompleteness makes the run non-publishable.
const { makeAnimal } = require('./record.cjs');
const { auditRun } = require('./quality.cjs');

async function runSource(adapter, { fetcher, cache, log = () => {}, now = () => new Date().toISOString() }) {
  const run = { source: adapter.id, state: 'running', startedAt: now(), finishedAt: null, animals: [], skipped: [], errors: [], requests: 0 };
  const candidates = [];
  try {
    const out = await adapter.collect({ fetcher, cache, log });
    for (const raw of out.animals || []) {
      try {
        const animal = makeAnimal(adapter.id, raw);
        run.animals.push(animal);
        candidates.push({ animal });
      } catch (e) {
        run.errors.push(`invalid animal ${raw?.nativeId ?? '?'}: ${e.message}`);
        candidates.push({ error: e.message, nativeId: raw?.nativeId, sourceUrl: raw?.sourceUrl });
      }
    }
    run.skipped = out.skipped || [];
    run.state = out.complete === true && !run.errors.length ? 'complete' : 'partial';
  } catch (e) {
    run.state = 'failed';
    run.errors.push(e.message);
    run.failure = { code: e.code ?? null, status: e.status ?? null, retryAfterMs: e.retryAfterMs ?? null };
  }
  run.finishedAt = now();
  run.requests = fetcher?.stats?.().requests ?? 0;
  run.quality = auditRun(run, adapter, candidates);
  if (run.quality.invalid && run.state === 'complete') {
    run.state = 'partial';
    run.errors.push(`quality: ${run.quality.invalid} invalid candidate(s)`);
  }
  run.evidence = fetcher?.evidence?.() ?? [];
  return run;
}

module.exports = { runSource };
