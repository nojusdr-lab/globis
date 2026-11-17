'use strict';
// Runs one adapter and turns its output into a validated run.
// Any thrown error or adapter-reported incompleteness makes the run non-publishable.
const { makeAnimal } = require('./record.cjs');

async function runSource(adapter, { fetcher, cache, log = () => {}, now = () => new Date().toISOString() }) {
  const run = { source: adapter.id, state: 'running', startedAt: now(), finishedAt: null, animals: [], skipped: [], errors: [], requests: 0 };
  try {
    const out = await adapter.collect({ fetcher, cache, log });
    for (const raw of out.animals || []) {
      try { run.animals.push(makeAnimal(adapter.id, raw)); }
      catch (e) { run.errors.push(`invalid animal ${raw?.nativeId ?? '?'}: ${e.message}`); }
    }
    run.skipped = out.skipped || [];
    run.state = out.complete === true && !run.errors.length ? 'complete' : 'partial';
  } catch (e) {
    run.state = 'failed';
    run.errors.push(e.message);
  }
  run.finishedAt = now();
  run.requests = fetcher?.stats?.().requests ?? 0;
  return run;
}

module.exports = { runSource };
