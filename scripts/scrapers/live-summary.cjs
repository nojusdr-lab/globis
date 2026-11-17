'use strict';
// Turns a run.cjs output folder into a short review file per source:
// counts by status, how many facts are known, and the first 5 animals as parsed.
const fs = require('node:fs');
const path = require('node:path');
const [src, dst] = process.argv.slice(2);
fs.mkdirSync(dst, { recursive: true });
const report = JSON.parse(fs.readFileSync(path.join(src, 'report.json'), 'utf8'));
const out = { at: new Date().toISOString(), sources: [] };
for (const r of report) {
  const file = path.join(src, r.source, 'published.json');
  const snap = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { animals: [] };
  const count = k => snap.animals.filter(a => a[k] != null && !(Array.isArray(a[k]) && !a[k].length)).length;
  const byStatus = {};
  for (const a of snap.animals) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  out.sources.push({ ...r, byStatus, known: Object.fromEntries(['name', 'species', 'sex', 'age_text', 'size', 'photos', 'vaccinated', 'neutered', 'chipped', 'bio_lt'].map(k => [k, count(k)])),
    sample: snap.animals.slice(0, 5).map(a => ({ ...a, bio_lt: a.bio_lt && a.bio_lt.slice(0, 160) })) });
}
fs.writeFileSync(path.join(dst, 'summary.json'), JSON.stringify(out, null, 2));
console.log(out.sources.map(s => `${s.source}: ${s.state} ${s.animals} ${JSON.stringify(s.byStatus)} published=${s.published} ${s.reason || ''}`).join('\n'));
