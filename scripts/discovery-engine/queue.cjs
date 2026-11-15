const { DatabaseSync } = require('node:sqlite');

class Queue {
  constructor(path, now = Date.now) {
    this.now = now;
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS organization(id TEXT PRIMARY KEY, active INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS source(
        id TEXT PRIMARY KEY, org TEXT NOT NULL REFERENCES organization(id),
        domain TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('fixture','network'))
      );
      CREATE TABLE IF NOT EXISTS access_decision(
        source TEXT PRIMARY KEY REFERENCES source(id), allowed INTEGER NOT NULL, expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS run(
        seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, source TEXT NOT NULL REFERENCES source(id)
      );
      CREATE TABLE IF NOT EXISTS job(
        id INTEGER PRIMARY KEY, run TEXT NOT NULL REFERENCES run(id), key TEXT NOT NULL,
        payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'ready', ready INTEGER NOT NULL,
        token INTEGER NOT NULL DEFAULT 0, lease INTEGER, result TEXT, UNIQUE(run,key)
      );
      CREATE TABLE IF NOT EXISTS attempt(
        job INTEGER REFERENCES job(id), token INTEGER, worker TEXT NOT NULL,
        started INTEGER NOT NULL, ended INTEGER, outcome TEXT, PRIMARY KEY(job,token)
      );
      CREATE TABLE IF NOT EXISTS turn(org TEXT PRIMARY KEY, last INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS gate(domain TEXT PRIMARY KEY, next INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshot(source TEXT PRIMARY KEY, seq INTEGER NOT NULL, data TEXT NOT NULL);
    `);
  }
  sql(query, ...args) { return this.db.prepare(query).run(...args); }
  get(query, ...args) { return this.db.prepare(query).get(...args); }
  all(query, ...args) { return this.db.prepare(query).all(...args); }
  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  register({ org, source, domain, mode = 'fixture', active = true, allowed = false, expires = 0 }) {
    this.tx(() => {
      this.sql('INSERT INTO organization VALUES (?,?) ON CONFLICT(id) DO UPDATE SET active=excluded.active', org, +active);
      this.sql('INSERT OR IGNORE INTO source VALUES (?,?,?,?)', source, org, domain, mode);
      const current = this.get('SELECT * FROM source WHERE id=?', source);
      if (current.org !== org || current.domain !== domain || current.mode !== mode) throw Error('Source identity changed');
      this.sql('INSERT OR REPLACE INTO access_decision VALUES (?,?,?)', source, +allowed, expires);
    });
  }
  enqueue(run, source, tasks) {
    if (!tasks.length || new Set(tasks.map(task => task.key)).size !== tasks.length) throw Error('Expected unique tasks');
    this.tx(() => {
      const created = this.sql('INSERT OR IGNORE INTO run(id,source) VALUES (?,?)', run, source).changes;
      if (!created) {
        const prior = this.get('SELECT source FROM run WHERE id=?', run);
        const jobs = this.all('SELECT key,payload FROM job WHERE run=? ORDER BY id', run);
        const expected = tasks.map(({key, ...payload}) => ({key, payload: JSON.stringify(payload)}));
        if (prior.source !== source || JSON.stringify(jobs) !== JSON.stringify(expected)) throw Error('Run already sealed with different tasks');
        return;
      }
      for (const {key, ...payload} of tasks) {
        this.sql('INSERT INTO job(run,key,payload,ready) VALUES (?,?,?,?)', run,key,JSON.stringify(payload),this.now());
      }
    });
  }
  claim(worker, { leaseMs = 1000, domainLimit = 1, domainGapMs = 0 } = {}) {
    return this.tx(() => {
      const now = this.now();
      this.sql(`UPDATE attempt SET ended=?, outcome='expired' WHERE ended IS NULL
        AND EXISTS (SELECT 1 FROM job j WHERE j.id=attempt.job AND j.token=attempt.token AND j.lease<=?)`,now,now);
      this.sql("UPDATE job SET state='dead' WHERE state='leased' AND lease<=? AND token>=4", now);
      const job = this.get(`
        SELECT j.*,s.org,s.domain,s.id AS source FROM job j
        JOIN run r ON r.id=j.run JOIN source s ON s.id=r.source
        JOIN organization o ON o.id=s.org LEFT JOIN turn t ON t.org=s.org
        LEFT JOIN gate g ON g.domain=s.domain
        WHERE o.active=1 AND s.mode='fixture' AND j.ready<=?
          AND (j.state='ready' OR (j.state='leased' AND j.lease<=?))
          AND coalesce(g.next,0)<=?
          AND (SELECT count(*) FROM job x JOIN run y ON y.id=x.run JOIN source z ON z.id=y.source
            WHERE z.domain=s.domain AND x.state='leased' AND x.lease>?) < ?
        ORDER BY coalesce(t.last,0),j.ready,j.id LIMIT 1`,now,now,now,now,domainLimit);
      // B1 has no network executor. Network tasks remain unclaimable even with approval.
      if (!job) return null;
      const token = job.token + 1;
      this.sql("UPDATE job SET state='leased',token=?,lease=? WHERE id=?",token,now+leaseMs,job.id);
      this.sql('INSERT INTO attempt(job,token,worker,started) VALUES (?,?,?,?)',job.id,token,worker,now);
      this.sql('INSERT OR REPLACE INTO turn VALUES (?, (SELECT coalesce(max(last),0)+1 FROM turn))',job.org);
      this.sql('INSERT OR REPLACE INTO gate VALUES (?,?)',job.domain,now+domainGapMs);
      return { ...job, token, payload: JSON.parse(job.payload) };
    });
  }
  owns(job, now) {
    return this.get("SELECT id FROM job WHERE id=? AND token=? AND state='leased' AND lease>?",job.id,job.token,now);
  }
  renew(job, leaseMs) {
    return this.tx(() => {
      const now = this.now();
      if (!this.owns(job, now)) return false;
      this.sql('UPDATE job SET lease=? WHERE id=?',now+leaseMs,job.id);
      return true;
    });
  }
  complete(job, result) { return this.finish(job, result, null); }
  fail(job, error) { return this.finish(job, null, error); }
  finish(job, result, error) {
    return this.tx(() => {
      const now = this.now();
      if (!this.owns(job,now)) return false;
      const state = error ? (job.token >= 4 ? 'dead' : 'ready') : 'done';
      this.sql('UPDATE job SET state=?,ready=?,lease=NULL,result=? WHERE id=?',
        state,now+(error ? 20*2**(job.token-1) : 0),error ? null : JSON.stringify(result),job.id);
      this.sql('UPDATE attempt SET ended=?,outcome=? WHERE job=? AND token=?',now,error ? 'error' : 'done',job.id,job.token);
      return true;
    });
  }
  publish(runId) {
    return this.tx(() => {
      const run = this.get('SELECT * FROM run WHERE id=?',runId);
      const jobs = this.all('SELECT * FROM job WHERE run=? ORDER BY id',runId);
      if (!run || !jobs.length || jobs.some(job => job.state !== 'done')) return false;
      const items = jobs.map(job => JSON.parse(job.result));
      if (items.some(item => !item || typeof item.id !== 'string' || !item.id ||
          typeof item.sourceUrl !== 'string' || !/^https:\/\/[^/]+\.invalid\//.test(item.sourceUrl) ||
          !Number.isFinite(Date.parse(item.observedAt)) ||
          ![null,true,false].includes(item.vaccinated)) ||
          new Set(items.map(item => item.id)).size !== items.length) return false;
      return Boolean(this.sql(`INSERT INTO snapshot VALUES (?,?,?)
        ON CONFLICT(source) DO UPDATE SET seq=excluded.seq,data=excluded.data WHERE excluded.seq>snapshot.seq`,
        run.source,run.seq,JSON.stringify(items)).changes);
    });
  }
}
module.exports = { Queue };
