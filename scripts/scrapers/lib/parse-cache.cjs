'use strict';
// Content-hash cache: if a page's bytes did not change, reuse what we parsed last time.
// Key = sha256(page) + parser version, so a parser change invalidates old entries.
const fs = require('node:fs');
const path = require('node:path');
const { stripPrivate } = require('./normalize.cjs');

function scrubCache(value) {
  if (Array.isArray(value)) return value.map(scrubCache);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) =>
    [key, ['bio_lt', 'bio', 'bioLt'].includes(key) && typeof v === 'string' ? stripPrivate(v) : scrubCache(v)]));
  return value;
}

function createParseCache(dir) {
  const memory = new Map();
  const file = key => path.join(dir, `${key}.json`);
  return {
    async getOrParse(hash, version, parse) {
      const key = `${hash.slice(0, 32)}-${String(version).replace(/[^\w.-]/g, '')}`;
      if (memory.has(key)) return memory.get(key);
      if (dir) {
        try {
          const raw = fs.readFileSync(file(key), 'utf8');
          const hit = scrubCache(JSON.parse(raw));
          if (JSON.stringify(hit) !== raw) {
            const temporary = file(key) + '.' + process.pid + '.tmp';
            fs.writeFileSync(temporary, JSON.stringify(hit)); fs.renameSync(temporary, file(key));
          }
          memory.set(key, hit); return hit;
        } catch { /* miss: parse fresh and overwrite a corrupt entry */ }
      }
      const value = scrubCache(await parse());
      memory.set(key, value);
      if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(key), JSON.stringify(value)); }
      return value;
    },
  };
}

module.exports = { createParseCache, scrubCache };
