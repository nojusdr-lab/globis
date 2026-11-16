// Local synthetic previews only. This store never writes src/data or enables a network source.
const {DatabaseSync}=require('node:sqlite');
const {createHash}=require('node:crypto');
class ReviewStore {
 constructor(path,now=Date.now) {
  this.now=now;this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS version(id TEXT PRIMARY KEY,source TEXT NOT NULL,run TEXT NOT NULL,items TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS head(source TEXT PRIMARY KEY,version TEXT NOT NULL REFERENCES version(id));
   CREATE TABLE IF NOT EXISTS event(id INTEGER PRIMARY KEY,source TEXT NOT NULL,kind TEXT NOT NULL,detail TEXT NOT NULL,at INTEGER NOT NULL);`);
 }
 current(source) {const row=this.db.prepare('SELECT v.* FROM head h JOIN version v ON v.id=h.version WHERE h.source=?').get(source);return row?{...row,items:JSON.parse(row.items)}:null;}
 events(source) {return this.db.prepare('SELECT * FROM event WHERE source=? ORDER BY id').all(source);}
 versions(source) {return this.db.prepare('SELECT id,source,run,created FROM version WHERE source=? ORDER BY rowid').all(source);}
 record(source,kind,detail) {this.db.prepare('INSERT INTO event(source,kind,detail,at) VALUES(?,?,?,?)').run(source,kind,String(detail),this.now());}
 publish(source,items,{expectedCount,completed,runId}) {
  this.db.exec('BEGIN IMMEDIATE');
  try {
   if(!source || !runId || completed!==true || !Number.isSafeInteger(expectedCount) || expectedCount<1 || !Array.isArray(items) || items.length!==expectedCount) throw Error('Incomplete preview batch');
   const ids=new Set(),urls=new Set();
   for(const row of items) {
    const url=new URL(row.sourceUrl);
    const canonical=url.origin+url.pathname.replace(/\/$/,'');
    if(typeof row.id!=='string'||!row.id||ids.has(row.id)||urls.has(canonical)||url.protocol!=='https:'||!url.hostname.endsWith('.invalid')||url.username||url.password||![null,'active','reserved','unknown'].includes(row.status)||!Number.isFinite(Date.parse(row.observedAt))||Date.parse(row.observedAt)>this.now()) throw Error('Invalid or duplicate synthetic observation');
    ids.add(row.id);urls.add(canonical);
   }
   const prior=this.current(source);
   if(prior) for(const row of prior.items) {
    const next=items.find(item=>item.id===row.id);
    if(!next) throw Error('Missing previous listing; disappearance is not adoption');
    const priorObservedAt = Date.parse(row.observedAt);
    const nextObservedAt = Date.parse(next.observedAt);
    if (nextObservedAt < priorObservedAt) throw Error('Observation time regression');
    if (nextObservedAt === priorObservedAt && next.status !== row.status) {
     throw Error('Conflicting listing status for the same observation');
    }
   }
   const reviewed = this.db.prepare('SELECT id FROM version WHERE source=? AND run=? ORDER BY rowid LIMIT 1').get(source,runId);
   if (reviewed) {
    this.db.exec('COMMIT');
    return {published:false,reason:'file_already_reviewed',version:reviewed.id};
   }
   const data=JSON.stringify(items),id=createHash('sha256').update(JSON.stringify([source,runId,items])).digest('hex');
   this.db.prepare('INSERT OR IGNORE INTO version VALUES(?,?,?,?,?)').run(id,source,runId,data,this.now());
   this.db.prepare('INSERT INTO head VALUES(?,?) ON CONFLICT(source) DO UPDATE SET version=excluded.version').run(source,id);
   this.record(source,'publish',id);this.db.exec('COMMIT');return {published:true,version:id};
  } catch(error) {this.db.exec('ROLLBACK');this.record(source,'rejected',error.message);throw error;}
 }
 restore(source,id,reason) {
  this.db.exec('BEGIN IMMEDIATE');
  try {
   if(typeof reason!=='string'||!reason.trim()) throw Error('Restore requires a review reason');
   if(!this.db.prepare('SELECT id FROM version WHERE source=? AND id=?').get(source,id)) throw Error('Unknown source version');
   this.db.prepare('INSERT INTO head VALUES(?,?) ON CONFLICT(source) DO UPDATE SET version=excluded.version').run(source,id);
   this.record(source,'restore',JSON.stringify({version:id,reason}));this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');this.record(source,'restore_rejected',error.message);throw error;}
 }
 close(){this.db.close();}
}
module.exports={ReviewStore};
