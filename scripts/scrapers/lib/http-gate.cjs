'use strict';
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
// A conservative domain group: subdomains share the parent suffix. Multi-part
// public suffixes may over-throttle, never grant additional access.
const domain = host => host.toLowerCase().split('.').slice(-2).join('.');

class HttpGate {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS http_gate(domain TEXT PRIMARY KEY,last_started INTEGER NOT NULL,
        token TEXT,lease INTEGER NOT NULL,not_before INTEGER NOT NULL,delay_ms INTEGER NOT NULL DEFAULT 0)`);
    if (!this.db.prepare('PRAGMA table_info(http_gate)').all().some(c => c.name === 'delay_ms')) {
      this.db.exec('ALTER TABLE http_gate ADD COLUMN delay_ms INTEGER NOT NULL DEFAULT 0');
    }
  }
  async enter(host, delay, timeout, signal) {
    const key = domain(host);
    while (true) {
      signal?.throwIfAborted();
      const now = Date.now(), token = randomUUID();
      let wait;
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const old = this.db.prepare('SELECT * FROM http_gate WHERE domain=?').get(key);
        const floor = Math.max(delay, old?.delay_ms || 0);
        wait = old ? Math.max(old.lease, old.not_before, old.last_started + floor) - now : 0;
        if (wait <= 0) this.db.prepare(`INSERT INTO http_gate(domain,last_started,token,lease,not_before,delay_ms) VALUES(?,?,?,?,0,?)
          ON CONFLICT(domain) DO UPDATE SET last_started=excluded.last_started,token=excluded.token,lease=excluded.lease,delay_ms=excluded.delay_ms`)
          .run(key, now, token, now + timeout + 5000, floor);
        this.db.exec('COMMIT');
      } catch (error) { this.db.exec('ROLLBACK'); throw error; }
      if (wait <= 0) return () => {
        this.db.prepare('UPDATE http_gate SET lease=0,token=NULL WHERE domain=? AND token=?').run(key, token);
      };
      await sleep(Math.min(wait, 1000), undefined, { signal });
    }
  }
  defer(host, delay) {
    if (Number.isFinite(delay) && delay > 0) this.db.prepare('UPDATE http_gate SET not_before=max(not_before,?) WHERE domain=?')
      .run(Date.now() + delay, domain(host));
  }
  close() { this.db.close(); }
}

module.exports = { HttpGate };
