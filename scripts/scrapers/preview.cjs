'use strict';
// One source, no database writes. Keep detailed collector output on disk.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { writeSummary, formatSummary } = require('./live-summary.cjs');

function main() {
  const [source, output] = process.argv.slice(2);
  if (!source || !/^[a-z0-9-]+$/.test(source)) {
    console.error('Usage: npm run scrape:preview -- <source-id> [output-directory]');
    return 1;
  }
  const outDir = path.resolve(output || 'data/scraped-preview');
  fs.mkdirSync(outDir, { recursive: true });
  // A crash must not reuse the preceding run's report. Published snapshots remain.
  fs.rmSync(path.join(outDir, 'report.json'), { force: true });
  fs.rmSync(path.join(outDir, 'summary.json'), { force: true });
  const logFile = path.join(outDir, 'run.log');
  const log = fs.openSync(logFile, 'w');
  const env = { ...process.env };
  delete env.SUPABASE_DB_URL;
  let result;
  try {
    result = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), outDir, source], {
      env, stdio: ['ignore', log, log],
    });
  } finally {
    fs.closeSync(log);
  }
  const status = result.status ?? 1;
  if (result.error || result.signal) {
    console.error('Collector did not finish. See ' + logFile);
  }
  try {
    const summary = writeSummary(outDir, outDir);
    console.log(formatSummary(summary));
    console.log('Report: ' + path.join(outDir, 'summary.json'));
    console.log('Log: ' + logFile);
    const incomplete = summary.sources.some(row => row.state !== 'complete' || !row.published);
    return status || (incomplete ? 1 : 0);
  } catch {
    console.error('No valid report for this run. See ' + logFile);
    return status || 1;
  }
}

if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
