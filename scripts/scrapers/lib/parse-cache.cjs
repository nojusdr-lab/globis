'use strict';
// Content-hash cache: if a page's bytes did not change, reuse what we parsed last time.
// Key = sha256(page) + parser version + shared rules fingerprint, so a change in an adapter or in
// the shared label rules (labels.cjs, normalize.cjs) invalidates old entries.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('./hash.cjs');

const LIB_VERSION = sha256(['labels.cjs', 'normalize.cjs'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n')).slice(0, 8);

function createParseCache(dir, { libVersion = LIB_VERSION } = {}) {
  const memory = new Map();
  const file = key => path.join(dir, `${key}.json`);
  return {
    async getOrParse(hash, version, parse) {
      const key = `${hash.slice(0, 32)}-${String(version).replace(/[^\w.-]/g, '')}-${libVersion}`;
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
