'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { HttpGate } = require('../lib/http-gate.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');

test('separate fetchers share one in-flight request and start interval for a domain', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-http-gate-'));
  const a = new HttpGate(path.join(dir, 'gate.sqlite')), b = new HttpGate(path.join(dir, 'gate.sqlite'));
  t.after(() => { a.close(); b.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  let active = 0, maximum = 0;
  const starts = [];
  const fetchImpl = async () => {
    starts.push(Date.now()); active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 25)); active--;
    return new Response('');
  };
  const first = createFetcher({ allowedHosts: ['site.invalid'], gate: a, minDelayMs: 40, fetchImpl });
  const second = createFetcher({ allowedHosts: ['www.site.invalid'], gate: b, minDelayMs: 40, fetchImpl });
  await Promise.all([first.get('https://site.invalid/a'), second.get('https://www.site.invalid/b')]);
  assert.equal(maximum, 1);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 35);
});
