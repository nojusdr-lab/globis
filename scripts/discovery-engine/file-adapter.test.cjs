const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Queue } = require('./queue.cjs');
const { enqueueFile } = require('./file-adapter.cjs');
const { runPool } = require('./workers.cjs');

const fixture = join(__dirname,'fixtures','synthetic.csv');
function setup(t) {
  const q = new Queue(':memory:');
  const dir = mkdtempSync(join(tmpdir(),'globis-file-'));
  t.after(()=>{ q.db.close(); rmSync(dir,{recursive:true}); });
  const grant = (source,allowed=true) => q.authorizeSyntheticFile({
    source,allowed,expires:Date.now()+60000,evidence:'Synthetic integration test',
  });
  const add = (source,org=source) => q.register({org,source,domain:source+'.invalid'});
  const file = (name,body) => { const path=join(dir,name); writeFileSync(path,body); return path; };
  const enqueue = (path=fixture, source='a', org=source) => enqueueFile(q,{path,source,org});
  add('a');
  return {q,grant,add,file,enqueue};
}

test('CSV workers share three sources, preserve evidence and publish deterministically',async t=>{
  const {q,grant,add,enqueue}=setup(t);
  add('b'); add('c');
  const runs=['a','b','c'].map(source=>{grant(source); return enqueue(fixture,source);});
  assert.equal(enqueue(),runs[0]);
  assert.equal(q.get('SELECT count(*) AS n FROM job').n,12);
  const workers=new Set();
  await runPool(q,{onEvent:event=>workers.add(event.worker)});
  assert.equal(workers.size,3);
  for (const run of runs) assert.equal(q.publish(run),true);
  const items=JSON.parse(q.get("SELECT data FROM snapshot WHERE source='a'").data);
  assert.deepEqual(items.map(x=>x.status),['active','reserved','unknown',null]);
  assert.deepEqual(items.map(x=>x.vaccinated),[true,false,null,null]);
  assert.deepEqual(items.slice(0,2).map(x=>x.name),['Demo, "A"','Demo\nB']);
  assert.equal(items[0].evidenceRef.record,1);
  assert.match(items[0].evidenceRef.sha256,/^[a-f0-9]{64}$/);
  assert.equal(items[0].sourceUpdatedAt,'2026-11-01T12:00:00Z');
  assert.equal(enqueue(),runs[0]);
  assert.equal(q.publish(runs[0]),false);
});

test('BOM CSV and JSON import, invalid encoding and malformed schemas fail',async t=>{
  const {q,grant,file,enqueue}=setup(t);
  grant('a');
  const csv=enqueue(file('bom.csv','\uFEFFnativeListingId,sourceUrl\r\na,https://x.invalid/a\r\n'));
  const json=enqueue(file('good.json',JSON.stringify([{nativeListingId:'b',sourceUrl:'https://x.invalid/b'}])));
  assert.throws(()=>enqueue(file('bad.csv',Buffer.from([0xff]))));
  assert.throws(()=>enqueue(file('columns.csv','nativeListingId,sourceUrl,secret\na,x,1')));
  assert.throws(()=>enqueue(file('quote.csv','nativeListingId,sourceUrl\n"a,x')));
  await runPool(q);
  assert.equal(q.publish(csv),true);
  assert.equal(q.publish(json),true);
  assert.equal(JSON.parse(q.get('SELECT data FROM snapshot').data)[0].status,null);
});

test('bad rows and duplicate listing IDs cannot replace a good snapshot',async t=>{
  const {q,grant,file,enqueue}=setup(t);
  grant('a');
  const good=enqueue();
  await runPool(q);
  assert.equal(q.publish(good),true);
  const snapshot=q.get('SELECT data FROM snapshot').data;
  const row={nativeListingId:'a',sourceUrl:'https://listings.invalid/a'};
  const bad=[
    [row,row], [row,{...row,nativeListingId:'b',status:'adopted'}],
    [{...row,sourceUpdatedAt:'2026-02-30T12:00:00Z'}],
    [{...row,sourceUrl:'https://example.com/a'}], [{...row,photoUrl:'file:///tmp/a'}],
    [{...row,vaccinated:'maybe'}],
  ].map((rows,i)=>enqueue(file('bad-'+i+'.json',JSON.stringify(rows))));
  await runPool(q);
  for (const run of bad) assert.equal(q.publish(run),false);
  assert.equal(q.get('SELECT data FROM snapshot').data,snapshot);
});

test('authorization binds source, organization, lease and publication',async t=>{
  const {q,grant,add,enqueue}=setup(t);
  assert.throws(()=>enqueue(),/authorization/);
  grant('a'); add('unapproved','a');
  assert.throws(()=>enqueue(fixture,'unapproved','a'),/authorization/);
  assert.throws(()=>enqueue(fixture,'a','other'),/authorization/);
  const pending=enqueue();
  const leased=q.claim('before-revoke');
  grant('a',false);
  assert.equal(q.renew(leased,100),false);
  assert.equal(q.complete(leased,{}),false);
  assert.equal(q.claim('after-revoke'),null);
  await runPool(q);
  assert.equal(q.publishPreview(pending).reason,'file_access_denied');
  grant('a');
  const done=enqueue();
  assert.notEqual(done,pending);
  await runPool(q);
  grant('a',false);
  assert.equal(q.publishPreview(done).reason,'file_access_denied');
});
