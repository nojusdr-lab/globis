'use strict';
// Content-hash cache: if a page's bytes did not change, reuse what we parsed last time.
// Key = sha256(page) + parser version, so a parser change invalidates old entries.
const fs = require('node:fs');
const path = require('node:path');

function createParseCache(dir) {
  const memory = new Map();
  const file = key => path.join(dir, `${key}.json`);
  return {
    async getOrParse(hash, version, parse) {
      const key = `${hash.slice(0, 32)}-${String(version).replace(/[^\w.-]/g, '')}`;
      if (memory.has(key)) return memory.get(key);
      if (dir) {
        try { const hit = JSON.parse(fs.readFileSync(file(key), 'utf8')); memory.set(key, hit); return hit; } catch { /* miss */ }
      }
      const value = await parse();
      memory.set(key, value);
      if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(key), JSON.stringify(value)); }
      return value;
    },
  };
}

module.exports = { createParseCache };
