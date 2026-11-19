'use strict';
// Fail-closed publishing of one source's snapshot.
// A failed, partial, empty or suspiciously shrunken run never replaces the last good copy.
// A big drop is accepted only after the same set of animals is seen in `confirmRuns`
// complete runs in a row (so a real wave of adoptions is not blocked forever).
// Animals that disappear become `no_longer_listed`. That is not proof of adoption.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('./hash.cjs');

// Same rule as public.publish_source_run (supabase/migrations/20261117000000_publish_guard_small_sources.sql).
const DEFAULT_GUARD = { maxLostRatio: 0.05, maxLostAbsolute: 3, confirmRuns: 3 };

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function checkRun(run, previous, guard) {
  if (run.state !== 'complete') return `run is ${run.state}`;
  if (!run.animals.length) return 'run has no animals';
  const ids = run.animals.map(a => a.id);
  if (new Set(ids).size !== ids.length) return 'duplicate animal ids';
  if (!previous) return null;
  const observed = Date.parse(run.startedAt), prior = Date.parse(previous.runStartedAt);
  if (Number.isFinite(observed) && Number.isFinite(prior) && observed <= prior) return 'observation is not newer than published snapshot';
  const now = new Set(ids);
  const lost = previous.animals.filter(a => !now.has(a.id)).length;
  const limit = Math.max(guard.maxLostAbsolute, Math.floor(previous.animals.length * guard.maxLostRatio));
  if (lost > limit) return `lost ${lost} of ${previous.animals.length} animals (limit ${limit})`;
  return null;
}

function publish(run, { outDir, guard: guardIn = {}, now = () => new Date().toISOString() } = {}) {
  const guard = { ...DEFAULT_GUARD, ...guardIn };
  const dir = path.join(outDir, run.source);
  const publishedFile = path.join(dir, 'published.json');
  const stateFile = path.join(dir, 'state.json');
  const previous = readJson(publishedFile, null);
  const state = readJson(stateFile, { pending: null });
  writeJsonAtomic(path.join(dir, 'last-run.json'), summary(run));
  if (run.quality) writeJsonAtomic(path.join(dir, 'validation.json'), run.quality);
  if (run.evidence) writeJsonAtomic(path.join(dir, 'evidence.json'), run.evidence);
  const result = value => {
    writeJsonAtomic(path.join(dir, 'last-run.json'), { ...summary(run), published: value.published, reason: value.reason });
    return value;
  };

  let problem = checkRun(run, previous, guard);
  if (problem && /^lost /.test(problem)) {
    const idsHash = sha256(run.animals.map(a => a.id).sort().join('\n'));
    const same = state.pending?.idsHash === idsHash;
    const stamp = Date.parse(run.startedAt), previousStamp = Date.parse(state.pending?.startedAt);
    const replay = Number.isFinite(stamp) && Number.isFinite(previousStamp) && stamp <= previousStamp;
    const seen = same ? state.pending.count + (replay ? 0 : 1) : 1;
    if (seen >= guard.confirmRuns) problem = null;
    else {
      writeJsonAtomic(stateFile, { ...state, pending: { idsHash, count: seen, reason: problem,
        startedAt: replay ? state.pending.startedAt : run.startedAt } });
      return result({ published: false, reason: `${problem}; waiting for ${guard.confirmRuns - seen} more identical run(s)` });
    }
  }
  if (problem) {
    if (run.state !== 'complete' && state.pending) writeJsonAtomic(stateFile, { ...state, pending: null });
    return result({ published: false, reason: problem });
  }

  const observedAt = run.finishedAt || now();
  const history = [];
  const before = new Map((previous?.animals || []).map(a => [a.id, a]));
  for (const a of run.animals) {
    const old = before.get(a.id);
    if (!old || old.status !== a.status) history.push({ id: a.id, status: a.status, evidence: a.statusEvidence, observedAt });
    before.delete(a.id);
  }
  for (const gone of before.values()) {
    history.push({ id: gone.id, status: 'no_longer_listed', evidence: null, observedAt, lastSeen: gone });
  }
  const snapshot = { source: run.source, publishedAt: observedAt, runStartedAt: run.startedAt, animals: run.animals, noLongerListed: [...before.keys()] };
  writeJsonAtomic(publishedFile, snapshot);
  writeJsonAtomic(stateFile, { pending: null, lastPublishedAt: observedAt });
  if (history.length) {
    fs.appendFileSync(path.join(dir, 'history.jsonl'), history.map(h => JSON.stringify(h)).join('\n') + '\n');
  }
  return result({ published: true, reason: null, changes: history.length });
}

function summary(run) {
  return { source: run.source, state: run.state, startedAt: run.startedAt, finishedAt: run.finishedAt,
    animals: run.animals.length, skipped: run.skipped.length, errors: run.errors, requests: run.requests,
    quality: run.quality ? { checked: run.quality.checked, invalid: run.quality.invalid, withWarnings: run.quality.withWarnings } : null };
}

module.exports = { publish, checkRun, DEFAULT_GUARD, writeJsonAtomic };
