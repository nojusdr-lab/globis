'use strict';
// Offline, exhaustive registry coverage and per-animal audit. No network or LLM calls.
const fs = require('node:fs');
const path = require('node:path');
const { parseInventory } = require('../discovery-engine/vmvt-inventory.cjs');
const { auditRun } = require('./lib/quality.cjs');

function buildCoverage({ inventory, sources, adapters, snapshots = {}, attempts = {}, now = new Date().toISOString() }) {
  const organizations = inventory.map(row => {
    const number = Number(row.vmvt_row);
    const source = sources.find(s => s.vmvtRow === number);
    const adapter = source?.decision === 'adapter' && adapters.find(a => a.id === (source.adapterId || source.id));
    const snapshot = adapter ? snapshots[adapter.id] : null;
    const attempt = adapter ? attempts[adapter.id] : null;
    let state, reason;
    if (row.vmvt_status === 'inactive') { state = 'inactive'; reason = 'VMVT: veiklos nevykdo'; }
    else if (adapter) {
      state = snapshot?.validationInvalid ? 'validation_failed' : !snapshot ? (attempt?.state === 'failed' || attempt?.state === 'partial' ? 'failed' : 'not_collected')
        : attempt && (attempt.state !== 'complete' || attempt.published === false) ? 'last_good_retained' : 'collected';
      reason = attempt?.errors?.slice(0, 3).join('; ') || attempt?.reason || (snapshot ? 'Vietinė publikuota kopija' : 'Gyva patikra dar nebaigta');
    } else if (source) { state = source.decision; reason = source.note || source.terms || 'Adapteris neįjungtas'; }
    else if (row.destinations.some(d => d.type === 'website' && inventory.some(other => other !== row && other.destinations.some(o => o.url === d.url)))) {
      state = 'identity_review'; reason = 'Kitos registro eilutės naudoja tą patį kanalą; gyvūnų automatiškai nepriskiriame';
    } else if (row.destinations.some(d => d.type === 'facebook')) {
      state = 'social_access_required'; reason = 'Organizacijos profilis nėra gyvūnų sąrašas; autorizuotas gyvūnų kanalas neprijungtas';
    } else { state = 'unreviewed'; reason = 'Patvirtinto gyvūnų adapterio nėra'; }
    return { vmvtRow: number, organization: row.registered_name, registryStatus: row.vmvt_status,
      registryUrls: row.destinations.map(d => d.url), website: source?.website ?? null,
      adapterId: adapter?.id ?? null, state, reason,
      animals: snapshot ? snapshot.animals.length : null, lastAttempt: attempt?.finishedAt ?? null,
      lastPublished: snapshot?.publishedAt ?? null, accessChecked: source?.checked ?? null };
  });
  return { generatedAt: now, summary: { registryRows: inventory.length,
    withLinks: inventory.filter(r => r.destinations.length).length,
    enabledCollectors: organizations.filter(r => r.adapterId).length,
    collected: organizations.filter(r => r.state === 'collected').length,
    byState: organizations.reduce((out, r) => { out[r.state] = (out[r.state] || 0) + 1; return out; }, {}) }, organizations };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function writeReports(outDir) {
  const adapters = require('./adapters/index.cjs');
  const sources = require('./sources.json').sources;
  const inventory = parseInventory(fs.readFileSync(path.join(__dirname, '../../docs/discovery-engine/vmvt-guardian-inventory.tsv'), 'utf8'));
  const snapshots = {}, attempts = {}, animals = [];
  for (const adapter of adapters) {
    const dir = path.join(outDir, adapter.id);
    const snapshot = readJson(path.join(dir, 'published.json'));
    const attempt = readJson(path.join(dir, 'last-run.json'));
    if (snapshot) {
      snapshots[adapter.id] = snapshot;
      const quality = auditRun({ animals: snapshot.animals, finishedAt: snapshot.publishedAt }, adapter);
      snapshot.validationInvalid = quality.invalid;
      const images = new Map((readJson(path.join(dir, 'image-health.json'))?.records || []).map(r => [r.id, r]));
      const photos = new Map(snapshot.animals.map(a => [a.id, a.photos]));
      animals.push(...quality.records.map(record => {
        const prior = images.get(record.id), current = photos.get(record.id) || [];
        const matches = prior && (prior.checks?.[0]?.url === current[0] || prior.preferredUrl === current[0]);
        return { ...record, source: adapter.id, observationAt: snapshot.publishedAt, auditAt: new Date().toISOString(),
          image: { state: !current.length ? 'missing' : matches ? prior.state : 'pending',
            checkedAt: matches ? prior.checks?.[0]?.checkedAt ?? null : null } };
      }));
    }
    if (attempt) attempts[adapter.id] = attempt;
  }
  const report = buildCoverage({ inventory, sources, adapters, snapshots, attempts });
  report.summary.animalsChecked = animals.length;
  report.summary.invalidAnimals = animals.filter(a => a.result === 'invalid').length;
  report.summary.animalsWithWarnings = animals.filter(a => a.warnings.length).length;
  report.summary.images = animals.reduce((o, a) => { o[a.image.state] = (o[a.image.state] || 0) + 1; return o; }, {});
  const cell = text => String(text ?? '—').replace(/[|\r\n]/g, ' ');
  const markdown = [
    '# Rinkiklių padengimas', '', `Patikra: ${report.generatedAt}. Registro eilutės: ${report.summary.registryRows}; su nuorodomis: ${report.summary.withLinks}.`,
    `Įjungti rinkikliai: ${report.summary.enabledCollectors}. Patikrintų publikuotų įrašų: ${animals.length}; struktūros klaidų: ${report.summary.invalidAnimals}.`, '',
    'Tai automatinė struktūros ir ištraukimo patikra. Ji nepatvirtina, kad pati prieglauda pateikė teisingą informaciją. Nežinomi faktai neužpildomi spėjimais.', '',
    '| VMVT | Organizacija | Būsena | Gyvūnai | Priežastis |', '|---|---|---|---|---|',
    ...report.organizations.map(r => `| ${r.vmvtRow} | ${cell(r.organization)} | ${r.state} | ${r.animals ?? '—'} | ${cell(r.reason)} |`), '',
  ].join('\n');
  fs.mkdirSync(outDir, { recursive: true });
  for (const [file, body] of [['coverage.json', JSON.stringify(report, null, 2) + '\n'],
    ['coverage.md', markdown], ['animals-audit.jsonl', animals.map(a => JSON.stringify(a)).join('\n') + '\n']]) {
    const target = path.join(outDir, file), temporary = target + '.' + process.pid + '.tmp';
    fs.writeFileSync(temporary, body); fs.renameSync(temporary, target);
  }
  return report;
}

module.exports = { buildCoverage, writeReports };
if (require.main === module) {
  try { console.log(JSON.stringify(writeReports(path.resolve(process.argv[2] || 'data/scraped')).summary)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
