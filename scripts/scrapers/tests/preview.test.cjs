'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(t, report) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-preview-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
  return dir;
}

const complete = { source: 'shelter', state: 'complete', animals: 1, skipped: 0,
  requests: 2, published: true, reason: null, errors: [] };

function summary(src, dst) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'live-summary.cjs'), src, dst],
    { encoding: 'utf8' });
}

test('summary keeps counts and excludes animal text, photos and unexpected report fields', t => {
  const src = fixture(t, [{ ...complete, debug: 'PRIVATE_DEBUG' }]);
  fs.mkdirSync(path.join(src, 'shelter'));
  const animal = { name: 'PRIVATE_NAME', bio_lt: 'PRIVATE_BIO'.repeat(1000),
    photos: Array(100).fill('https://shelter.invalid/PRIVATE_PHOTO'), status: 'unknown', vaccinated: false };
  fs.writeFileSync(path.join(src, 'shelter', 'published.json'), JSON.stringify({ animals: [animal] }));
  const dst = path.join(src, 'review');
  const result = summary(src, dst);
  assert.equal(result.status, 0, result.stderr);
  const text = fs.readFileSync(path.join(dst, 'summary.json'), 'utf8');
  assert.doesNotMatch(text + result.stdout, /PRIVATE_/);
  assert.ok(Buffer.byteLength(text) < 1500);
  const row = JSON.parse(text).sources[0];
  assert.equal(row.animals, 1);
  assert.deepEqual(row.byStatus, { unknown: 1 });
  assert.equal(row.known.vaccinated, 1, 'a known false is still a sourced fact');
});

test('summary bounds errors and marks preserved snapshots separately from the failed run', t => {
  const src = fixture(t, [{ ...complete, state: 'failed', animals: 0, published: false,
    errors: Array(30).fill('ERROR\n' + 'x'.repeat(10000)), reason: 'run is failed' }]);
  fs.mkdirSync(path.join(src, 'shelter'));
  fs.writeFileSync(path.join(src, 'shelter', 'published.json'),
    JSON.stringify({ animals: [{ status: 'reserved', name: 'Old snapshot' }] }));
  const dst = path.join(src, 'review');
  const result = summary(src, dst);
  assert.equal(result.status, 0, result.stderr);
  const text = fs.readFileSync(path.join(dst, 'summary.json'), 'utf8');
  assert.ok(Buffer.byteLength(text) < 2000, 'a large error must not fill the model context');
  const row = JSON.parse(text).sources[0];
  assert.equal(row.state, 'failed');
  assert.equal(row.animals, 0);
  assert.equal(row.snapshot, 'previous');
  assert.equal(row.snapshotAnimals, 1);
  assert.ok(row.errors.length <= 3);
  assert.ok(row.errors.every(error => error.length <= 200 && !error.includes('\n')));
});

test('missing report and corrupt published snapshot produce a nonzero summary result', t => {
  const src = fixture(t, [complete]);
  const dst = path.join(src, 'review');
  fs.mkdirSync(path.join(src, 'shelter'));
  fs.writeFileSync(path.join(src, 'shelter', 'published.json'), '{broken');
  assert.notEqual(summary(src, dst).status, 0);
  fs.rmSync(path.join(src, 'report.json'));
  assert.notEqual(summary(src, dst).status, 0);
});

function previewFixture(t, body) {
  const dir = fixture(t, [complete]);
  const preload = path.join(dir, 'offline.cjs');
  const index = path.join(__dirname, '..', 'adapters', 'index.cjs');
  fs.writeFileSync(preload, `
    if (process.argv[1].endsWith('/run.cjs')) {
      if (process.env.SUPABASE_DB_URL) throw Error('Preview received database credentials');
      const id = ${JSON.stringify(index)};
      require.cache[id] = { id, filename: id, loaded: true, exports: [{
        id: 'fixture', hosts: ['fixture.invalid'],
        async collect() { ${body} }
      }] };
    }
  `);
  const invoke = () => spawnSync(process.execPath,
    [path.join(__dirname, '..', 'preview.cjs'), 'fixture', dir], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, SUPABASE_DB_URL: 'postgres://must-not-connect.invalid',
        NODE_OPTIONS: '--require=' + preload },
    });
  return { dir, invoke };
}

test('preview runs the real collector with an offline adapter and keeps large logs out of stdout', t => {
  const { dir, invoke } = previewFixture(t, `
    console.log('LARGE_DETAIL'.repeat(5000));
    return { complete: true, animals: [{
      nativeId: 'a', sourceUrl: 'https://fixture.invalid/a', name: 'Fixture', photos: []
    }] };
  `);
  const result = invoke();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fixture: complete animals=1/);
  assert.ok(Buffer.byteLength(result.stdout) < 1500);
  assert.doesNotMatch(result.stdout + result.stderr, /LARGE_DETAIL|must-not-connect/);
  assert.match(fs.readFileSync(path.join(dir, 'run.log'), 'utf8'), /LARGE_DETAIL/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'fixture', 'published.json'))).animals.length, 1);
});

test('preview returns failure for a partial run even when the collector exits zero', t => {
  const { invoke } = previewFixture(t, 'return { complete: false, animals: [] };');
  const result = invoke();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /fixture: partial animals=0/);
});

test('preview reports a failed run and preserves the last good source snapshot', t => {
  const { dir, invoke } = previewFixture(t, 'throw Error("Offline request failed");');
  fs.mkdirSync(path.join(dir, 'fixture'));
  const prior = JSON.stringify({ animals: [{ id: 'fixture:a', status: 'unknown' }] });
  fs.writeFileSync(path.join(dir, 'fixture', 'published.json'), prior);
  const result = invoke();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /fixture: failed animals=0/);
  assert.match(result.stdout, /snapshot=previous\(1\)/);
  assert.equal(fs.readFileSync(path.join(dir, 'fixture', 'published.json'), 'utf8'), prior);
});

test('a collector crash cannot present the previous report as the current result', t => {
  const { dir, invoke } = previewFixture(t, 'process.exit(7);');
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ sources: [complete] }));
  const result = invoke();
  assert.equal(result.status, 7, result.stderr);
  assert.doesNotMatch(result.stdout, /shelter: complete/);
  assert.match(result.stderr, /report|Report/);
  assert.equal(fs.existsSync(path.join(dir, 'report.json')), false);
  assert.equal(fs.existsSync(path.join(dir, 'summary.json')), false);
});
