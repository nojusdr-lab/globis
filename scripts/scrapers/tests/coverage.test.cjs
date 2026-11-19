'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseInventory } = require('../../discovery-engine/vmvt-inventory.cjs');
const { buildCoverage } = require('../coverage.cjs');
const inventory = parseInventory(fs.readFileSync(path.join(__dirname, '../../../docs/discovery-engine/vmvt-guardian-inventory.tsv'), 'utf8'));
const sources = require('../sources.json').sources;
const adapters = require('../adapters/index.cjs');

test('every registry row has its own result, including the inactive organization', () => {
  const report = buildCoverage({ inventory, sources, adapters });
  assert.equal(report.organizations.length, 96);
  assert.equal(report.summary.withLinks, 95);
  assert.equal(report.organizations.find(r => r.vmvtRow === 27).state, 'inactive');
  assert.equal(report.summary.enabledCollectors, 19);
  assert.equal(report.organizations.find(r => r.vmvtRow === 2).adapterId, 'keturkojo-viltis');
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
