const {test}=require('node:test');const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');const {tmpdir}=require('node:os');const {join}=require('node:path');
const {ReviewStore}=require('./review-store.cjs');
const row=(id,time=100)=>({id,sourceUrl:`https://shelter.invalid/${id}`,observedAt:new Date(time).toISOString(),status:'unknown',vaccinated:null});
test('partial, repeated, regressing or interrupted batches preserve a durable current version',()=>{
 const dir=mkdtempSync(join(tmpdir(),'globis-review-'));let store=new ReviewStore(join(dir,'review.db'),()=>1000);
 try {
 const opts={expectedCount:2,completed:true,runId:'one'},rows=[row('a'),row('b')];
 const first=store.publish('s',rows,opts);assert.equal(first.published,true);
 assert.equal(store.publish('s',rows,opts).published,false);
 const baseline=store.current('s');
 for(const [items,options] of [[rows.slice(0,1),opts],[[row('a'),row('a')],opts],[[row('a',99),row('b')],opts],[rows,{...opts,completed:false}],[[row('a'),row('c')],opts],[[row('a'),{...row('b'),sourceUrl:'https://shelter.invalid/a?duplicate'}],opts]]) {
  assert.throws(()=>store.publish('s',items,options));assert.deepEqual(store.current('s'),baseline);
 }
 // Model process interruption before COMMIT: closing the connection rolls back both pointer and event.
 store.db.exec("BEGIN IMMEDIATE; DELETE FROM head;");store.close();store=new ReviewStore(join(dir,'review.db'),()=>1000);
 assert.deepEqual(store.current('s'),baseline);
 const second=store.publish('s',[row('a',200),row('b',200)],{...opts,runId:'two'});
 assert.notEqual(first.version,second.version);assert.equal(store.versions('s').length,2);
 store.restore('s',first.version,'Reviewed rollback test');assert.deepEqual(store.current('s'),baseline);
 assert.throws(()=>store.restore('other',first.version,'cross-source'));assert.throws(()=>store.restore('s',second.version,''));
 assert.ok(store.events('s').some(e=>e.kind==='rejected'));assert.ok(store.events('s').some(e=>e.kind==='restore'));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
