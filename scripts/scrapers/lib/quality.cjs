'use strict';
// Structural and extraction checks, never a claim that the shelter's facts are true.
const { MENTIONS } = require('../audit.cjs');

function auditRun(run, adapter, candidates = run.animals.map(animal => ({ animal }))) {
  const ids = new Map();
  for (const { animal } of candidates) if (animal) ids.set(animal.id, (ids.get(animal.id) || 0) + 1);
  const records = candidates.map(({ animal: a, error, nativeId, sourceUrl }) => {
    const errors = [], warnings = [];
    if (error) errors.push('invalid_record');
    if (a) {
      if (adapter.hosts?.length && !adapter.hosts.includes(new URL(a.sourceUrl).hostname)) errors.push('source_host_mismatch');
      if (ids.get(a.id) > 1) errors.push('duplicate_id');
      if (a.source !== adapter.id || !a.id.startsWith(adapter.id + ':')) errors.push('identity_mismatch');
      if (a.status !== 'unknown' && !a.statusEvidence) errors.push('status_without_evidence');
      if (!a.name) warnings.push('missing_name');
      if (!a.photos.length) warnings.push('missing_photo');
      if (!a.bio_lt) warnings.push('missing_description');
      if (a.photos.some(p => p.startsWith('http:'))) warnings.push('http_photo');
      for (const [field, pattern] of Object.entries(MENTIONS)) {
        if (a[field] == null && pattern.test(a.bio_lt || '')) warnings.push('mentioned_unparsed_' + field);
      }
    }
    return { id: a?.id ?? (nativeId ? adapter.id + ':' + nativeId : null),
      sourceUrl: a?.sourceUrl ?? sourceUrl ?? null, checkedAt: run.finishedAt,
      result: errors.length ? 'invalid' : 'pass', errors, warnings };
  });
  return { version: 1, source: adapter.id, checkedAt: run.finishedAt, checked: records.length,
    invalid: records.filter(r => r.errors.length).length,
    withWarnings: records.filter(r => r.warnings.length).length, records };
}

module.exports = { auditRun };
