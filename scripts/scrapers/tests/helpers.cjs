'use strict';
// Fake network for tests: a map of URL -> response. No real requests are made.
function fakeFetch(routes, calls = []) {
  return async (url, init) => {
    calls.push({ url, ua: init.headers['user-agent'], method: init.method });
    const r = typeof routes === 'function' ? routes(url) : routes[url];
    if (!r) return response(404, 'not found');
    if (r instanceof Error) throw r;
    return response(r.status ?? 200, typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? r), r.headers);
  };
}
function response(status, body, headers = {}) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { status, text: async () => body, headers: { get: k => h.get(k.toLowerCase()) ?? null } };
}
function fakeClock() {
  let t = 1_000_000;
  const sleeps = [];
  return { now: () => t, sleep: async ms => { sleeps.push(ms); t += ms; }, sleeps };
}
module.exports = { fakeFetch, fakeClock };
