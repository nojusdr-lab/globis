'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ScheduleQueue } = require('../lib/schedule-queue.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-schedule-'));
  let time = 1000;
  const file = path.join(dir, 'queue.sqlite');
  const queue = new ScheduleQueue(file, { now: () => time, refreshMs: 3600000, retryBaseMs: 120000 });
  t.after(() => { queue.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { queue, file, now: () => time, advance: ms => { time += ms; } };
}

const source = (id, hosts = [id + '.invalid']) => ({ id, hosts });

test('a single shared pool takes the next organization and never overlaps a domain', t => {
  const { queue } = fixture(t);
  queue.sync([source('slow', ['same.invalid']), source('same', ['www.same.invalid']), source('fast')]);
  const first = queue.claim('a');
  const second = queue.claim('b');
  assert.equal(first.id, 'fast'); // stable id ordering at the same due time
  assert.equal(second.id, 'same');
  assert.equal(queue.claim('c'), null);
  queue.finish(second, { ok: true, animals: 3 });
  assert.equal(queue.claim('c').id, 'slow');
});

test('two queue connections cannot claim one organization twice; leases recover with fencing', t => {
  const { queue, file, advance, now } = fixture(t);
  queue.sync([source('one')]);
  const old = queue.claim('old', 100);
  const other = new ScheduleQueue(file, { now });
  t.after(() => other.close());
  assert.equal(other.claim('other'), null);
  advance(101);
  const replacement = other.claim('new');
  assert.equal(replacement.id, 'one');
  assert.equal(queue.finish(old, { ok: true, animals: 999 }), false);
  assert.equal(other.finish(replacement, { ok: true, animals: 2 }), true);
  assert.equal(queue.status()[0].animals, 2);
});

test('the two minute tick does not erase source refresh times or server Retry-After', t => {
  const { queue, advance } = fixture(t);
  queue.sync([source('one')]);
  queue.finish(queue.claim('w'), { ok: false, error: 'HTTP 429', retryAfterMs: 600000 });
  advance(120000);
  queue.sync([source('one')]);
  assert.equal(queue.claim('w'), null);
  advance(480000);
  queue.finish(queue.claim('w'), { ok: true, animals: 4 });
  advance(120000);
  assert.equal(queue.claim('w'), null);
  assert.equal(queue.status()[0].failures, 0);
});

test('failed checks retain the last success and restart cannot re-enable removed sources', t => {
  const { queue, advance } = fixture(t);
  queue.sync([source('one')]);
  queue.finish(queue.claim('w'), { ok: true, animals: 4 });
  const good = queue.status()[0].last_success;
  advance(3600000);
  queue.finish(queue.claim('w'), { ok: false, error: 'partial' });
  assert.equal(queue.status()[0].animals, 4);
  assert.equal(queue.status()[0].last_success, good);
  queue.sync([]);
  advance(86400000);
  assert.equal(queue.claim('w'), null);
});

test('separate instances share at most four workers for the entire registry', t => {
  const { queue } = fixture(t);
  queue.sync(['a','b','c','d','e'].map(id => source(id)));
  const jobs = Array.from({ length: 4 }, (_, i) => queue.claim('worker-' + i));
  assert.ok(jobs.every(Boolean));
  assert.equal(queue.claim('fifth'), null);
  queue.finish(jobs[0], { ok: true, animals: 1 });
  assert.equal(queue.claim('fifth').id, 'e');
});

test('a known good snapshot seeds its observation time once without resetting failures', t => {
  const { queue, advance } = fixture(t);
  queue.sync([source('one')]);
  assert.equal(queue.bootstrap('one', 900, 3), true);
  assert.equal(queue.claim('w'), null);
  advance(3600000);
  queue.finish(queue.claim('w'), { ok: false, error: 'site failed' });
  assert.equal(queue.bootstrap('one', 900, 3), false);
  assert.equal(queue.status()[0].failures, 1);
  assert.equal(queue.status()[0].last_success, 900);
});
