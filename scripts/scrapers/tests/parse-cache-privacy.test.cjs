'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createParseCache } = require('../lib/parse-cache.cjs');

test('parsed biography contacts are removed before caching and legacy cache hits are scrubbed on disk', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-private-cache-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const raw = { bio_lt: 'Draugiškas, gimęs 2022. +370 600 12345 jonas@example.invalid' };
  await createParseCache(dir).getOrParse('abc123', 'fixture', () => raw);
  const file = path.join(dir, fs.readdirSync(dir)[0]);
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /12345|example\.invalid/);
  fs.writeFileSync(file, JSON.stringify(raw));
  const hit = await createParseCache(dir).getOrParse('abc123', 'fixture', () => { throw Error('should use cached data'); });
  assert.doesNotMatch(hit.bio_lt, /12345|example\.invalid/);
  assert.match(hit.bio_lt, /gimęs 2022/);
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /12345|example\.invalid/);
});
