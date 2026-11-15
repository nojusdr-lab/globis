const { DatabaseSync } = require('node:sqlite');
const { sourceState } = require('./meta-adapter.cjs');

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
      CREATE TABLE IF NOT EXISTS file_grant(
        source TEXT PRIMARY KEY REFERENCES source(id), revision INTEGER NOT NULL,
        allowed INTEGER NOT NULL, expires INTEGER NOT NULL, evidence TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS file_run(
        run TEXT PRIMARY KEY REFERENCES run(id), revision INTEGER NOT NULL, observed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta_access(
        source TEXT REFERENCES source(id), revision INTEGER, state TEXT NOT NULL,
        page_id TEXT NOT NULL, route TEXT NOT NULL, expires INTEGER, evidence TEXT NOT NULL,
        decided_at INTEGER NOT NULL, PRIMARY KEY(source,revision)
      );
      CREATE TABLE IF NOT EXISTS meta_run(
        run TEXT PRIMARY KEY REFERENCES run(id), revision INTEGER NOT NULL, observed_at TEXT NOT NULL
      );
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
  authorizeSyntheticFile({source, allowed, expires = 0, evidence}) {
    if (typeof allowed !== 'boolean' || typeof evidence !== 'string' || !evidence.trim() ||
        (allowed && (!Number.isSafeInteger(expires) || expires <= this.now()))) throw Error('Invalid file decision');
    return this.tx(() => {
      if (!this.get("SELECT id FROM source WHERE id=? AND mode='fixture'",source)) throw Error('Expected a fixture source');
      this.sql(`INSERT INTO file_grant VALUES (?,1,?,?,?) ON CONFLICT(source) DO UPDATE
        SET revision=revision+1, allowed=excluded.allowed, expires=excluded.expires, evidence=excluded.evidence`,
        source,+allowed,expires,evidence);
    });
  }
  fileGrant(source, org) {
    return this.get(`SELECT g.revision FROM file_grant g JOIN source s ON s.id=g.source
      JOIN organization o ON o.id=s.org WHERE s.id=? AND o.id=? AND o.active=1 AND g.allowed=1 AND g.expires>?`,
      source,org,this.now());
  }
  enqueueFileRun(run, source, org, revision, tasks) {
    return this.tx(() => {
      if (this.fileGrant(source,org)?.revision !== revision) throw Error('File authorization changed');
      if (this.get('SELECT run FROM file_run WHERE run=?',run)) return;
      this.insertRun(run,source,tasks);
      this.sql('INSERT INTO file_run VALUES (?,?,?)',run,revision,new Date(this.now()).toISOString());
    });
  }
  enqueue(run, source, tasks) {
    return this.tx(() => this.insertRun(run,source,tasks));
  }
  insertRun(run, source, tasks) {
    if (!tasks.length || new Set(tasks.map(task => task.key)).size !== tasks.length) throw Error('Expected unique tasks');
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
  }
  // SQL predicate for jobs aliased as j and their source aliased as s.
  fileAccess() {
    return `NOT EXISTS (SELECT 1 FROM file_run f WHERE f.run=j.run AND NOT EXISTS
      (SELECT 1 FROM file_grant g WHERE g.source=s.id AND g.revision=f.revision AND g.allowed=1 AND g.expires>?))`;
  }
  metaAccess() {
    return `NOT EXISTS (SELECT 1 FROM meta_run m WHERE m.run=j.run AND NOT EXISTS
      (SELECT 1 FROM meta_access a WHERE a.source=s.id AND a.revision=m.revision
       AND a.revision=(SELECT max(revision) FROM meta_access WHERE source=s.id)
       AND a.state='approved' AND a.expires>?))`;
  }
  hasPending() {
    return this.get(`SELECT 1 FROM job j JOIN run r ON r.id=j.run JOIN source s ON s.id=r.source
      JOIN organization o ON o.id=s.org WHERE s.mode='fixture' AND o.active=1
      AND j.state IN ('ready','leased') AND ${this.fileAccess()} AND ${this.metaAccess()} LIMIT 1`,this.now(),this.now());
  }
  claim(worker, { leaseMs = 1000, domainLimit = 1, domainGapMs = 0 } = {}) {
    return this.tx(() => {
      const now = this.now();
      this.sql(`UPDATE attempt SET ended=?, outcome='expired' WHERE ended IS NULL
        AND EXISTS (SELECT 1 FROM job j WHERE j.id=attempt.job AND j.token=attempt.token AND j.lease<=?)`,now,now);
      this.sql("UPDATE job SET state='dead' WHERE state='leased' AND lease<=? AND token>=4", now);
      const job = this.get(`
        SELECT j.*,s.org,s.domain,s.id AS source,f.observed_at,m.observed_at AS meta_observed_at FROM job j
        JOIN run r ON r.id=j.run JOIN source s ON s.id=r.source
        LEFT JOIN file_run f ON f.run=j.run
        LEFT JOIN meta_run m ON m.run=j.run
        JOIN organization o ON o.id=s.org LEFT JOIN turn t ON t.org=s.org
        LEFT JOIN gate g ON g.domain=s.domain
        WHERE o.active=1 AND s.mode='fixture' AND ${this.fileAccess()} AND ${this.metaAccess()} AND j.ready<=?
          AND (j.state='ready' OR (j.state='leased' AND j.lease<=?))
          AND coalesce(g.next,0)<=?
          AND (SELECT count(*) FROM job x JOIN run y ON y.id=x.run JOIN source z ON z.id=y.source
            WHERE z.domain=s.domain AND x.state='leased' AND x.lease>?) < ?
        ORDER BY coalesce(t.last,0),j.ready,j.id LIMIT 1`,now,now,now,now,now,now,domainLimit);
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
    return this.get(`SELECT j.id FROM job j JOIN run r ON r.id=j.run JOIN source s ON s.id=r.source
      JOIN organization o ON o.id=s.org WHERE j.id=? AND j.token=? AND j.state='leased' AND j.lease>?
      AND o.active=1 AND ${this.fileAccess()} AND ${this.metaAccess()}`,job.id,job.token,now,now,now);
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
      const failure = job.meta_observed_at ? error?.metaFailure : null;
      const state = error ? (job.token >= 4 || failure?.retry === false ? 'dead' : 'ready') : 'done';
      const delay = error ? Math.max(20*2**(job.token-1),failure?.delayMs ?? 0) : 0;
      if (failure?.cooldown) this.sql(`INSERT INTO gate VALUES (?,?) ON CONFLICT(domain)
        DO UPDATE SET next=max(gate.next,excluded.next)`,job.domain,now+delay);
      this.sql('UPDATE job SET state=?,ready=?,lease=NULL,result=? WHERE id=?',
        state,now+delay,error ? null : JSON.stringify(result),job.id);
      this.sql('UPDATE attempt SET ended=?,outcome=? WHERE job=? AND token=?',now,failure?.kind ?? (error ? 'error' : 'done'),job.id,job.token);
      return true;
    });
  }
  publish(runId) {
    return this.publishPreview(runId).published;
  }
  publishPreview(runId) {
    return this.tx(() => {
      const run = this.get('SELECT * FROM run WHERE id=?',runId);
      const jobs = this.all('SELECT * FROM job WHERE run=? ORDER BY id',runId);
      if (!run || !jobs.length) return { published:false, reason:'empty_run' };
      const meta = this.get('SELECT revision FROM meta_run WHERE run=?',runId);
      if (meta) {
        const decision = sourceState(this,run.source);
        const active = this.get('SELECT o.active FROM organization o JOIN source s ON s.org=o.id WHERE s.id=?',run.source);
        if (!active?.active || decision.state !== 'approved' || decision.revision !== meta.revision) {
          return { published:false, reason:'meta_access_denied' };
        }
      }
      const file = this.get('SELECT revision FROM file_run WHERE run=?',runId);
      if (file) {
        const {org} = this.get('SELECT org FROM source WHERE id=?',run.source);
        if (this.fileGrant(run.source,org)?.revision !== file.revision) return { published:false, reason:'file_access_denied' };
      }
      const dead = jobs.filter(job => job.state === 'dead').map(job => job.key);
      if (dead.length) return { published:false, reason:'dead_jobs', jobs:dead };
      if (jobs.some(job => job.state !== 'done')) return { published:false, reason:'pending_jobs' };
      const items = meta ? JSON.parse(jobs[0].result).items : jobs.map(job => JSON.parse(job.result));
      if (!Array.isArray(items) || !items.length || items.some(item => !item || typeof item.id !== 'string' || !item.id ||
          typeof item.sourceUrl !== 'string' || !/^https:\/\/[^/]+\.invalid\//.test(item.sourceUrl) ||
          !Number.isFinite(Date.parse(item.observedAt)) ||
          ![null,true,false].includes(item.vaccinated)) ||
          new Set(items.map(item => item.id)).size !== items.length) return { published:false, reason:'invalid_observations' };
      const published = Boolean(this.sql(`INSERT INTO snapshot VALUES (?,?,?)
        ON CONFLICT(source) DO UPDATE SET seq=excluded.seq,data=excluded.data WHERE excluded.seq>snapshot.seq`,
        run.source,run.seq,JSON.stringify(items)).changes);
      return { published, reason:published ? null : 'snapshot_not_newer' };
    });
  }
}
module.exports = { Queue };
