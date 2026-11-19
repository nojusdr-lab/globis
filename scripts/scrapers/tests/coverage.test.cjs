'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseInventory } = require('../../discovery-engine/vmvt-inventory.cjs');
const { buildCoverage, writeReports } = require('../coverage.cjs');
const inventory = parseInventory(fs.readFileSync(path.join(__dirname, '../../../docs/discovery-engine/vmvt-guardian-inventory.tsv'), 'utf8'));
const sources = require('../sources.json').sources;
const adapters = require('../adapters/index.cjs');

test('every registry row has its own result, including the inactive organization', () => {
  const report = buildCoverage({ inventory, sources, adapters });
  assert.equal(report.organizations.length, 96);
  assert.equal(report.summary.withLinks, 95);
  assert.equal(report.organizations.find(r => r.vmvtRow === 27).state, 'inactive');
  assert.equal(report.summary.enabledCollectors, 20);
  assert.equal(report.organizations.find(r => r.vmvtRow === 2).adapterId, 'keturkojo-viltis');
  assert.equal(report.organizations.find(r => r.vmvtRow === 56).adapterId, 'egzoticsos', 'own website discovered behind a Facebook registry entry');
  assert.equal(report.organizations.find(r => r.vmvtRow === 52).state, 'blocked', 'explicit terms prohibit automated collection');
  assert.equal(report.organizations.find(r => r.vmvtRow === 28).state, 'adoption_confirmation_required', 'recently found animals are not automatically adoptable');
});

test('a shared URL does not assign one shelters animals to a different organization', () => {
  const report = buildCoverage({ inventory, sources, adapters });
  const different = report.organizations.find(r => r.vmvtRow === 62);
  assert.equal(different.state, 'identity_review');
  assert.equal(different.adapterId, null);
  assert.equal(different.animals, null);
});

test('a good saved snapshot is visibly stale after a failed collection, never an empty success', () => {
  const snapshots = { kggn: { publishedAt: '2026-11-18T00:00:00Z', animals: [] } };
  const attempts = { kggn: { state: 'failed', finishedAt: '2026-11-19T00:00:00Z', errors: ['HTTP 503'] } };
  const report = buildCoverage({ inventory, sources, adapters, snapshots, attempts });
  const row = report.organizations.find(r => r.vmvtRow === 6);
  assert.equal(row.state, 'last_good_retained');
  assert.equal(row.lastAttempt, '2026-11-19T00:00:00Z');
  assert.equal(row.lastPublished, '2026-11-18T00:00:00Z');
});

test('the per-animal report cannot claim an old image check for a changed primary URL', t => {
  const os = require('node:os');
  const { makeAnimal } = require('../lib/record.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-image-report-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'kggn'));
  const a = makeAnimal('kggn', { nativeId: 'a', sourceUrl: 'https://kggn.lt/a', photos: ['https://kggn.lt/old.jpg'] });
  const snapshot = { source: 'kggn', publishedAt: new Date().toISOString(), animals: [a] };
  const file = path.join(dir, 'kggn/published.json');
  fs.writeFileSync(file, JSON.stringify(snapshot));
  fs.writeFileSync(path.join(dir, 'kggn/image-health.json'), JSON.stringify({ records: [{ id: a.id, state: 'healthy',
    preferredUrl: a.photos[0], checks: [{ url: a.photos[0], checkedAt: new Date().toISOString() }] }] }));
  assert.equal(writeReports(dir).summary.images.healthy, 1);
  a.photos = ['https://kggn.lt/new.jpg']; fs.writeFileSync(file, JSON.stringify(snapshot));
  assert.equal(writeReports(dir).summary.images.pending, 1);
});

test('a running reporter sees an updated source pause instead of cached access permission', t => {
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-source-policy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sourceFile = path.join(dir, 'policy.json');
  fs.writeFileSync(sourceFile, JSON.stringify({ sources: [{ id: 'kggn', vmvtRow: 6, decision: 'adapter' }] }));
  assert.equal(writeReports(dir, { sourceFile }).organizations.find(r => r.vmvtRow === 6).state, 'not_collected');
  fs.writeFileSync(sourceFile, JSON.stringify({ sources: [{ id: 'kggn', vmvtRow: 6, decision: 'paused', note: 'Access withdrawn' }] }));
  const row = writeReports(dir, { sourceFile }).organizations.find(r => r.vmvtRow === 6);
  assert.equal(row.state, 'paused');
  assert.equal(row.adapterId, null);
  assert.equal(row.reason, 'Access withdrawn');
});
