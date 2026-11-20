'use strict';
// Production shelter jobs. Separate from the synthetic Discovery Engine demo.
const { DatabaseSync } = require('node:sqlite');
const domain = host => host.toLowerCase().replace(/^www\./, '');

class ScheduleQueue {
  constructor(file, { now = Date.now, refreshMs = 6 * 3600000, retryBaseMs = 120000 } = {}) {
    this.now = now; this.refreshMs = refreshMs; this.retryBaseMs = retryBaseMs;
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS schedule (
        id TEXT PRIMARY KEY, hosts TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
        next_due INTEGER NOT NULL, token INTEGER NOT NULL DEFAULT 0,
        worker TEXT, lease INTEGER, failures INTEGER NOT NULL DEFAULT 0,
        last_attempt INTEGER, last_success INTEGER, animals INTEGER, last_error TEXT
      )`);
  }
  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  sync(sources) {
    for (const s of sources) if (!/^[a-z0-9-]+$/.test(s.id) || !s.hosts?.length) throw Error('Invalid scheduled source');
    this.tx(() => {
      this.db.exec('UPDATE schedule SET active=0');
      const insert = this.db.prepare(`INSERT INTO schedule(id,hosts,next_due) VALUES(?,?,?)
        ON CONFLICT(id) DO UPDATE SET hosts=excluded.hosts,active=1`);
      for (const s of sources) insert.run(s.id, JSON.stringify([...new Set(s.hosts.map(domain))]), this.now());
    });
  }
  claim(worker, leaseMs = 90000) {
    return this.tx(() => {
      const now = this.now();
      const active = this.db.prepare('SELECT hosts FROM schedule WHERE lease>?').all(now);
      // Multiple daemon instances still share one global four-worker pool.
      if (active.length >= 4) return null;
      const occupied = new Set(active.flatMap(s => JSON.parse(s.hosts)));
      const due = this.db.prepare('SELECT * FROM schedule WHERE active=1 AND next_due<=? AND (lease IS NULL OR lease<=?) ORDER BY next_due,id').all(now, now);
      const job = due.find(s => !JSON.parse(s.hosts).some(h => occupied.has(h)));
      if (!job) return null;
      this.db.prepare('UPDATE schedule SET worker=?,lease=?,token=token+1,last_attempt=? WHERE id=?')
        .run(worker, now + leaseMs, now, job.id);
      return { ...job, token: job.token + 1, worker };
    });
  }
  bootstrap(id, observedAt, animals) {
    if (!Number.isFinite(observedAt) || observedAt > this.now() || !Number.isInteger(animals) || animals <= 0) return false;
    return !!this.db.prepare(`UPDATE schedule SET last_success=?,animals=?,next_due=?
      WHERE id=? AND active=1 AND last_attempt IS NULL AND last_success IS NULL AND lease IS NULL`)
      .run(observedAt, animals, observedAt + this.refreshMs, id).changes;
  }
  request(ids) {
    return this.tx(() => ids.reduce((n, id) => n + this.db.prepare(`UPDATE schedule SET next_due=?
      WHERE id=? AND active=1 AND lease IS NULL AND failures=0`).run(this.now(), id).changes, 0));
  }
  renew(job, leaseMs = 90000) {
    return !!this.db.prepare('UPDATE schedule SET lease=? WHERE id=? AND token=? AND worker=? AND active=1 AND lease>?')
      .run(this.now() + leaseMs, job.id, job.token, job.worker, this.now()).changes;
  }
  finish(job, outcome, commit) {
    return this.tx(() => {
      const now = this.now();
      const current = this.db.prepare('SELECT * FROM schedule WHERE id=? AND token=? AND worker=? AND active=1 AND lease>?')
        .get(job.id, job.token, job.worker, now);
      if (!current) return false;
      // Local publication happens while the lease is fenced by this transaction.
      if (commit) outcome = { ...outcome, ...commit() };
      const failures = outcome.ok ? 0 : current.failures + 1;
      const delay = outcome.ok ? this.refreshMs : Math.max(
        Math.min(6 * 3600000, this.retryBaseMs * 2 ** Math.min(failures - 1, 8)),
        Number.isFinite(outcome.retryAfterMs) ? Math.max(0, outcome.retryAfterMs) : 0);
      this.db.prepare(`UPDATE schedule SET worker=NULL,lease=NULL,next_due=?,failures=?,
        last_success=?,animals=?,last_error=? WHERE id=?`).run(now + delay, failures,
        outcome.ok ? now : current.last_success,
        outcome.ok ? outcome.animals : current.animals,
        outcome.ok ? null : String(outcome.error || 'collection incomplete').slice(0, 500), job.id);
      return true;
    });
  }
  status() { return this.db.prepare('SELECT * FROM schedule ORDER BY id').all().map(s => ({ ...s, hosts: JSON.parse(s.hosts) })); }
  close() { this.db.close(); }
}

module.exports = { ScheduleQueue };
