'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function collectOffline(t, { sources, databaseResults, databaseError = false }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-runner-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const preload = path.join(dir, 'offline.cjs');
  const scriptRoot = path.resolve(__dirname, '..');
  fs.writeFileSync(preload, `
    const fs = require('node:fs');
    const path = require('node:path');
    const root = ${JSON.stringify(scriptRoot)};
    const sources = ${JSON.stringify(sources)};
    const setModule = (file, exports) => {
      const id = require.resolve(file);
      require.cache[id] = { id, filename: id, loaded: true, exports };
    };
    setModule(path.join(root, 'adapters/index.cjs'), sources.map(source => ({
      id: source.id, hosts: ['fixture.invalid'],
      async collect() { return {
        complete: source.complete !== false,
        animals: [{ nativeId: 'a', name: source.id, photos: [],
          sourceUrl: 'https://fixture.invalid/' + source.id + '/a' }]
      }; }
    })));
    setModule(require.resolve('pg', { paths: [root] }), { Client: class {
      async connect() { if (${databaseError}) throw Error('Offline database is unavailable'); }
      async end() { fs.writeFileSync(${JSON.stringify(path.join(dir, 'db-closed'))}, 'closed'); }
    } });
    let active = false;
    const results = ${JSON.stringify(databaseResults ?? {})};
    setModule(path.join(root, 'lib/supabase-load.cjs'), { async loadRun(db, adapter) {
      if (active) throw Error('Database loads overlapped');
      active = true;
      await new Promise(resolve => setTimeout(resolve, 15));
      active = false;
      const result = results[adapter.id] ?? { published: true };
      if (result.error) throw Error(result.error);
      return result;
    } });
    globalThis.fetch = async () => { throw Error('External fetch forbidden in runner tests'); };
  `);
  const result = spawnSync(process.execPath, [path.join(scriptRoot, 'run.cjs'), dir], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SUPABASE_DB_URL: databaseResults || databaseError ? 'postgres://offline@fixture.invalid/globis' : '',
      NODE_OPTIONS: '--require=' + preload },
  });
  const file = path.join(dir, 'report.json');
  const report = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  return { dir, result, report };
}

test('parallel sources retain their own database outcome and one log row per source', t => {
  const { result, report, dir } = collectOffline(t, {
    sources: [{ id: 'alpha' }, { id: 'beta' }, { id: 'gamma' }],
    databaseResults: { alpha: { error: 'Offline alpha write failed' },
      beta: { published: true }, gamma: { published: true } },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(report.map(row => [row.source, row.db]), [
    ['alpha', 'error: Offline alpha write failed'], ['beta', 'published'], ['gamma', 'published'],
  ]);
  const logged = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(logged.map(row => row.source).sort(), ['alpha', 'beta', 'gamma']);
  assert.ok(fs.existsSync(path.join(dir, 'db-closed')));
});

test('partial collection is a failed CLI run even when it preserved the previous snapshot', t => {
  const { result, report } = collectOffline(t, { sources: [{ id: 'alpha', complete: false }] });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(report[0].state, 'partial');
  assert.equal(report[0].published, false);
});

test('a database publication refusal is reported as a failed CLI run', t => {
  const { result, report } = collectOffline(t, {
    sources: [{ id: 'alpha' }],
    databaseResults: { alpha: { published: false, reason: 'Publish guard rejected this run' } },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(report[0].db, 'Publish guard rejected this run');
});

test('a database outage still permits local collection and writes a failed report', t => {
  const { result, report, dir } = collectOffline(t, { sources: [{ id: 'alpha' }], databaseError: true });
  assert.equal(result.status, 1, result.stderr);
  assert.ok(report, 'an unavailable database must not discard the local collection report');
  assert.equal(report[0].state, 'complete');
  assert.equal(report[0].published, true);
  assert.match(report[0].db, /^error:/);
  assert.ok(fs.existsSync(path.join(dir, 'alpha', 'published.json')));
});
