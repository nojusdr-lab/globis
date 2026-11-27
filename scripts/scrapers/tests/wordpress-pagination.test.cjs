'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWordpressAdapter } = require('../adapters/wordpress-rest.cjs');
const { createFetcher } = require('../lib/polite-fetch.cjs');
const { createParseCache } = require('../lib/parse-cache.cjs');
const { runSource } = require('../lib/run-source.cjs');
const { publish } = require('../lib/snapshot.cjs');
const { fakeFetch, fakeClock } = require('./helpers.cjs');

const post = id => ({ id, link: `https://shelter.test/animal/${id}/`, title: { rendered: `Animal ${id}` },
  content: { rendered: '' }, featured_media: 0 });
const page = (ids, total, pages) => ({ body: ids.map(post), headers: {
  ...(total == null ? {} : { 'x-wp-total': String(total) }),
  ...(pages == null ? {} : { 'x-wp-totalpages': String(pages) }),
} });
const end = { status: 400, body: { code: 'rest_post_invalid_page_number', data: { status: 400 } } };

async function collect(responses, { maxPages = 5, at = '2026-11-27T00:00:00Z' } = {}) {
  const adapter = createWordpressAdapter({ id: 'pagination', name: 'Synthetic shelter',
    base: 'https://shelter.test/', restBase: 'animal', perPage: 2, maxPages });
  const calls = [];
  const fetcher = createFetcher({ allowedHosts: adapter.hosts, ...fakeClock(), fetchImpl: fakeFetch(url => {
    const u = new URL(url);
    if (u.pathname === '/robots.txt') return { body: 'User-agent: *\nDisallow: /private/' };
    return responses[Number(u.searchParams.get('page')) - 1];
  }, calls) });
  const run = await runSource(adapter, { fetcher, cache: createParseCache(null), now: () => at });
  return { run, calls };
}

test('WordPress: a real page-two HTTP 400 cannot publish a truncated list or erase the last good copy', async t => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-wp-pagination-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const first = (await collect([page([1, 2]), page([3])])).run;
  assert.equal(publish(first, { outDir }).published, true);
  const file = path.join(outDir, 'pagination/published.json'), before = fs.readFileSync(file, 'utf8');
  const next = (await collect([page([1, 2]), { status: 400, body: { code: 'rest_invalid_param' } }],
    { at: '2026-11-27T01:00:00Z' })).run;
  assert.equal(next.state, 'failed');
  assert.equal(publish(next, { outDir }).published, false);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('WordPress: only its explicit past-the-end code ends an unannounced full final page', async () => {
  assert.equal((await collect([page([1, 2]), end])).run.state, 'complete');
  for (const body of ['bad request', { code: 'rest_invalid_param' }, [{ code: 'rest_post_invalid_page_number' }]]) {
    assert.equal((await collect([page([1, 2]), { status: 400, body }])).run.state, 'failed');
  }
  assert.equal((await collect([end])).run.state, 'failed', 'first-page errors never mean an empty success');
});

test('WordPress: explicit totals finish a full last page without an extra request', async () => {
  const { run, calls } = await collect([page([1, 2], 2, 1)]);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 2);
  assert.equal(calls.length, 2, 'robots and the declared one data page');
});

test('WordPress: a short page is not the end when metadata declares more pages', async () => {
  const { run } = await collect([page([1], 3, 2), page([2, 3], 3, 2)]);
  assert.equal(run.state, 'complete');
  assert.equal(run.animals.length, 3);
});

test('WordPress: changing totals, missing rows and premature end cannot be called complete', async () => {
  for (const responses of [
    [page([1, 2], 3, 2), page([3], 4, 2)],
    [page([1, 2], 4, 2), page([3], 4, 2)],
    [page([1, 2], 5, 3), end],
  ]) assert.notEqual((await collect(responses)).run.state, 'complete');
});

test('WordPress: hitting the cap stays partial; repeated IDs cannot hide a missing animal', async () => {
  assert.equal((await collect([page([1, 2], 3, 2)], { maxPages: 1 })).run.state, 'partial');
  assert.equal((await collect([page([1, 2], 3, 2), page([2], 3, 2)])).run.state, 'partial');
});

test('WordPress: malformed/unsafe counts fail; a total-only header also proves the end', async () => {
  for (const value of ['unknown', '-1', '2.5', '9007199254740993']) {
    assert.equal((await collect([page([1], 1, value)])).run.state, 'failed');
  }
  const { run, calls } = await collect([page([1, 2], 2)]);
  assert.equal(run.state, 'complete');
  assert.equal(calls.length, 2);
});

test('WordPress: recognized error code is exposed without retaining the error response body', async () => {
  const fetcher = createFetcher({ allowedHosts: ['shelter.test'], ...fakeClock(), fetchImpl: fakeFetch({
    'https://shelter.test/robots.txt': { body: 'User-agent: *' },
    'https://shelter.test/fail': { status: 400, body: { code: 'rest_post_invalid_page_number',
      message: 'private-message-sentinel', data: { value: 'private-data-sentinel' } } },
  }) });
  await assert.rejects(fetcher.getJson('https://shelter.test/fail'), error => {
    assert.equal(error.status, 400);
    assert.equal(error.responseCode, 'rest_post_invalid_page_number');
    assert.doesNotMatch(JSON.stringify(error), /private-message|private-data/);
    return true;
  });
});
