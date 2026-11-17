'use strict';
// Public Facebook page profiles for the VMVT rows (name, short description, URL, followers text).
// Owner decision 2026-11-17: public pages may be read. Limits: logged-out GET only, no login, no
// CAPTCHA or anti-bot bypass, 6 s between requests, og: tags only (no posts, no people).
// A login wall or error is recorded as such and never retried. Animals are NOT read from here.
// Usage: node scripts/scrapers/facebook-pages.cjs [out.json]
const fs = require('node:fs');
const path = require('node:path');

const UA = 'GlobisBot/1.0 (+https://github.com/nojusdr-lab/globis)';
const DELAY_MS = 6000;
const TSV = path.join(__dirname, '../../docs/discovery-engine/vmvt-guardian-inventory.tsv');

const decode = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

function parseProfile(html) {
  const og = p => { const m = html.match(new RegExp(`<meta property="og:${p}" content="([^"]*)"`)); return m ? decode(m[1]) : null; };
  const name = og('title');
  if (!name || /^(log in|prisijung)/i.test(name)) return { state: 'login_wall' };
  return { state: 'ok', name, description: og('description'), url: og('url') };
}

function facebookRows(tsv) {
  const [head, ...rows] = tsv.trim().split('\n').map(l => l.split('\t'));
  const i = Object.fromEntries(head.map((h, n) => [h, n]));
  return rows.filter(r => r[i.channel_types].includes('facebook'))
    .map(r => ({ vmvtRow: +r[i.vmvt_row], registeredName: r[i.registered_name], url: r[i.listed_urls] }));
}

async function main() {
  const out = path.resolve(process.argv[2] || 'data/scraped/facebook-pages.json');
  const rows = facebookRows(fs.readFileSync(TSV, 'utf8'));
  const result = [];
  for (const row of rows) {
    let rec;
    try {
      const res = await fetch(row.url, { headers: { 'user-agent': UA, 'accept-language': 'lt' }, signal: AbortSignal.timeout(20000) });
      rec = res.ok ? parseProfile(await res.text()) : { state: `http_${res.status}` };
    } catch (e) { rec = { state: 'error', error: String(e.message).slice(0, 80) }; }
    result.push({ ...row, ...rec, fetchedAt: new Date().toISOString() });
    console.log(`${row.vmvtRow} ${rec.state}`);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  const n = s => result.filter(r => r.state === s).length;
  console.log(`rows ${result.length} ok ${n('ok')} login_wall ${n('login_wall')} other ${result.length - n('ok') - n('login_wall')}`);
}

module.exports = { parseProfile, facebookRows };
if (require.main === module) main();
