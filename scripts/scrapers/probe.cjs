'use strict';
// One-time reconnaissance run (from GitHub Actions, where the network is open).
// For each shelter website: save robots.txt as-is, then - only where robots.txt allows -
// the homepage, the known listing pages, terms/privacy pages linked from the homepage,
// and the WordPress REST type list. Output is raw pages for writing adapters and tests.
// Same polite fetcher as real runs: robots first, 5 s+ between requests per site.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { createFetcher, USER_AGENT } = require('./lib/polite-fetch.cjs');

const MAX_PAGES = 9;
const out = process.argv[2] || path.join(__dirname, 'probe-output');
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;

function hostsFor(url) {
  const h = new URL(url).hostname;
  return [...new Set([h, h.startsWith('www.') ? h.slice(4) : `www.${h}`])];
}

async function probe(src) {
  const dir = path.join(out, src.id);
  fs.mkdirSync(dir, { recursive: true });
  const log = [];
  const f = createFetcher({ allowedHosts: hostsFor(src.website), minDelayMs: 5000, log: m => log.push(m) });
  const origin = new URL(src.website).origin;
  let n = 0;
  const save = (name, body) => fs.writeFileSync(path.join(dir, `${String(++n).padStart(2, '0')}-${name}.gz`), zlib.gzipSync(body));
  const index = { id: src.id, website: src.website, userAgent: USER_AGENT, at: new Date().toISOString(), pages: [] };

  try {
    const r = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow' });
    const body = await r.text();
    index.robots = { status: r.status, finalUrl: r.url, contentType: r.headers.get('content-type'), text: body.slice(0, 20000) };
  } catch (e) { index.robots = { error: e.message }; }

  const queue = [src.website, ...(src.listing || []), `${origin}/wp-json/wp/v2/types`];
  const seen = new Set();
  while (queue.length && index.pages.length < MAX_PAGES) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const page = await f.get(url);
      index.pages.push({ url, finalUrl: page.url, status: page.status, contentType: page.contentType, bytes: page.body.length, hash: page.hash });
      save(slug(url), page.body);
      if (url === src.website) {
        for (const m of page.body.matchAll(/href="([^"#]+)"/g)) {
          let href; try { href = new URL(m[1], page.url).href; } catch { continue; }
          if (/taisykl|salyg|sąlyg|privatum|autorin|copyright|terms/i.test(href) && hostsFor(src.website).includes(new URL(href).hostname)) queue.splice(1, 0, href);
        }
      }
      if (/\/wp-json\/wp\/v2\/types$/.test(url)) {
        try {
          const types = JSON.parse(page.body);
          const builtin = new Set(['post', 'page', 'attachment', 'nav_menu_item', 'wp_block', 'wp_template', 'wp_template_part', 'wp_global_styles', 'wp_navigation', 'wp_font_family', 'wp_font_face', 'elementor_library', 'e-floating-buttons']);
          for (const t of Object.values(types)) if (t && !builtin.has(t.slug) && t.rest_base) queue.unshift(`${origin}/wp-json/wp/v2/${t.rest_base}?per_page=5`);
          queue.push(`${origin}/wp-json/wp/v2/posts?per_page=5`);
        } catch { /* not JSON */ }
      }
    } catch (e) {
      index.pages.push({ url, error: e.message, code: e.code ?? null, status: e.status ?? null });
    }
  }
  index.requests = f.stats().requests + 1;
  index.log = log;
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 2));
  return index;
}

const slug = url => url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 80);

async function main() {
  const { sources } = require('./sources.json');
  const todo = sources.filter(s => s.decision !== 'other_thread' && (!only || only.has(s.id)));
  // Different sites in parallel (each site still gets one slow request at a time).
  const results = [];
  const workers = Array.from({ length: 6 }, async () => {
    while (todo.length) {
      const src = todo.shift();
      const r = await probe(src).catch(e => ({ id: src.id, error: e.message }));
      results.push({ id: r.id, robots: r.robots?.status ?? r.robots?.error, pages: (r.pages || []).map(p => p.status ?? p.code) });
      console.log(JSON.stringify(results.at(-1)));
    }
  });
  await Promise.all(workers);
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(results, null, 2));
}

main();
