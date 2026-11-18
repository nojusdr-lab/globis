'use strict';
// Counts only. Full observations stay in the local run directory or CI artifact.
const fs = require('node:fs');
const path = require('node:path');
const fields = ['name', 'species', 'sex', 'age_text', 'size', 'photos',
  'vaccinated', 'neutered', 'chipped', 'bio_lt'];

function shortText(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 200);
}

function summarize(src) {
  const report = JSON.parse(fs.readFileSync(path.join(src, 'report.json'), 'utf8'));
  if (!Array.isArray(report) || report.length === 0) throw new Error('Missing source reports');
  return {
    at: new Date().toISOString(),
    sources: report.map(row => {
      if (!/^[a-z0-9-]+$/.test(row.source) || !['complete', 'partial', 'failed'].includes(row.state) ||
          !Number.isSafeInteger(row.animals) || row.animals < 0 || typeof row.published !== 'boolean') {
        throw new Error('Invalid source report');
      }
      const file = path.join(src, row.source, 'published.json');
      const hasSnapshot = fs.existsSync(file);
      if (row.published && !hasSnapshot) throw new Error('Published snapshot is missing: ' + row.source);
      const animals = hasSnapshot ? JSON.parse(fs.readFileSync(file, 'utf8')).animals : [];
      if (!Array.isArray(animals)) throw new Error('Invalid snapshot: ' + row.source);
      const byStatus = Object.create(null);
      for (const animal of animals) {
        const status = ['available', 'reserved', 'unknown', 'confirmed_adopted', 'no_longer_listed']
          .includes(animal.status) ? animal.status : 'unknown';
        byStatus[status] = (byStatus[status] ?? 0) + 1;
      }
      return {
        source: row.source, state: row.state, animals: row.animals,
        skipped: row.skipped, requests: row.requests, published: row.published,
        reason: shortText(row.reason) || null,
        errors: (row.errors ?? []).slice(0, 3).map(shortText),
        ...(row.db ? { db: shortText(row.db) } : {}),
        snapshot: hasSnapshot ? (row.published ? 'current' : 'previous') : 'none',
        snapshotAnimals: animals.length,
        byStatus,
        known: Object.fromEntries(fields.map(key => [key, animals.filter(animal =>
          animal[key] != null && !(Array.isArray(animal[key]) && !animal[key].length)).length])),
      };
    }),
  };
}

function writeSummary(src, dst) {
  const summary = summarize(src);
  fs.mkdirSync(dst, { recursive: true });
  fs.writeFileSync(path.join(dst, 'summary.json'), JSON.stringify(summary) + '\n');
  return summary;
}

function formatSummary(summary) {
  return summary.sources.map(row => {
    const outcome = row.published ? 'published' : (row.reason || 'not published');
    const errors = row.errors.length ? ' | ' + row.errors.join(' | ') : '';
    const database = row.db ? ' db=' + row.db : '';
    return row.source + ': ' + row.state + ' animals=' + row.animals +
      ' requests=' + row.requests + ' ' + outcome +
      ' snapshot=' + row.snapshot + '(' + row.snapshotAnimals + ')' + database + errors;
  }).join('\n');
}

if (require.main === module) {
  try {
    const [src, dst] = process.argv.slice(2);
    if (!src || !dst) throw new Error('Usage: node scripts/scrapers/live-summary.cjs <runDir> <summaryDir>');
    console.log(formatSummary(writeSummary(src, dst)));
  } catch (error) {
    console.error(shortText(error.message));
    process.exitCode = 1;
  }
}

module.exports = { writeSummary, formatSummary };
