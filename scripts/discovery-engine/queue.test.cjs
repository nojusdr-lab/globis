const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const { Queue } = require('./queue.cjs');
const { runPool } = require('./workers.cjs');

function setup(t) {
  let now = 100;
  const dir = mkdtempSync(join(tmpdir(),'globis-b1-'));
  const path = join(dir,'queue.sqlite');
  const q = new Queue(path,()=>now);
  const other = new Queue(path,()=>now);
  t.after(()=>{q.db.close();other.db.close();rmSync(dir,{recursive:true});});
  const add = (org,domain=org+'.invalid',options={}) => q.register({org,source:org,domain,...options});
  return {q,other,add,tick:n=>{now+=n;}};
}
const item = id => ({id,sourceUrl:'https://example.invalid/'+id,observedAt:'2026-11-15T00:00:00Z',vaccinated:null});

test('separate connections cannot own the same live job, heartbeat extends its lease',t=>{
  const {q,other,add,tick}=setup(t);
  add('a');q.enqueue('r','a',[{key:'1'}]);
  const old=q.claim('first',{leaseMs:10});
  assert.equal(other.claim('second'),null);
  tick(8);assert.equal(q.renew(old,10),true);
  tick(3);assert.equal(other.claim('second'),null);
  tick(7);
  const next=other.claim('second');
  assert.equal(next.id,old.id);
  assert.equal(next.token,old.token+1);
  assert.equal(q.renew(old,10),false);
  assert.equal(q.complete(old,item('old')),false);
  assert.equal(other.complete(next,item('new')),true);
  assert.equal(q.complete(next,item('duplicate')),false);
  assert.deepEqual(q.all('SELECT outcome FROM attempt ORDER BY token').map(row=>row.outcome),['expired','done']);
});

test('fair selection moves a freed worker to a smaller organization',t=>{
  const {q,add}=setup(t);
  add('a');add('b');add('c');
  q.enqueue('a','a',Array.from({length:10},(_,i)=>({key:String(i)})));
  q.enqueue('b','b',[{key:'b'}]);q.enqueue('c','c',[{key:'c'}]);
  const first=q.claim('same');
  assert.equal(first.org,'a');
  q.complete(first,item('a'));
  assert.equal(q.claim('same').org,'b');
  assert.equal(q.claim('other').org,'c');
});

test('domain slots and cooldown are shared across organizations',t=>{
  const {q,other,add,tick}=setup(t);
  add('a','shared.invalid');add('b','shared.invalid');add('c');
  for(const org of ['a','b','c']) q.enqueue(org,org,[{key:org}]);
  const a=q.claim('one',{domainGapMs:50});
  const c=other.claim('two');
  assert.equal(c.org,'c');
  assert.equal(other.claim('three'),null);
  q.complete(a,item('a'));
  assert.equal(other.claim('three'),null);
  tick(50);
  assert.equal(other.claim('three').org,'b');
});

test('duplicate enqueue and retry are idempotent, failed or invalid runs preserve preview',t=>{
  const {q,add,tick}=setup(t);
  add('a');
  q.enqueue('good','a',[{key:'1'}]);
  q.complete(q.claim('w'),item('a'));
  assert.equal(q.publish('good'),true);
  const previous=q.get('SELECT data FROM snapshot').data;
  const jobs=[{key:'1'},{key:'2'}];
  q.enqueue('bad','a',jobs);q.enqueue('bad','a',jobs);
  assert.throws(()=>q.enqueue('bad','a',[{key:'3'}]));
  q.fail(q.claim('w'),Error('temporary'));
  q.complete(q.claim('w'),item('same'));
  assert.equal(q.publish('bad'),false);
  tick(20);
  q.complete(q.claim('w'),item('same'));
  assert.equal(q.publish('bad'),false);
  assert.equal(q.get('SELECT data FROM snapshot').data,previous);
});

test('inactive fixtures and network sources remain blocked in B1',t=>{
  const {q,add}=setup(t);
  add('disabled',undefined,{active:false});
  add('unapproved',undefined,{mode:'network'});
  add('approved',undefined,{mode:'network',allowed:true,expires:500});
  for(const org of ['disabled','unapproved','approved']) q.enqueue(org,org,[{key:org}]);
  assert.equal(q.claim('w'),null);
});

test('shared pool retries a fixture and publishes evidence with null intact',async ()=>{
  const q=new Queue(':memory:');
  try {
    q.register({org:'a',source:'a',domain:'a.invalid'});
    q.enqueue('a','a',[{key:'x',failFirst:true},{key:'y',vaccinated:false},{key:'z',vaccinated:true}]);
    await runPool(q);
    assert.equal(q.publish('a'),true);
    const values=JSON.parse(q.get('SELECT data FROM snapshot').data);
    assert.deepEqual(values.map(v=>v.vaccinated),[null,false,true]);
    assert.equal(q.get("SELECT count(*) AS count FROM attempt WHERE outcome='error'").count,1);
  } finally { q.db.close(); }
});

test('worker discards its result after another connection takes the lease', async t => {
  const {q, other, add, tick} = setup(t);
  add('a');
  q.enqueue('a','a',[{key:'x',delay:100}]);
  const renew = q.renew.bind(q);
  let takeover;
  q.renew = (job, ms) => {
    tick(ms);
    takeover = other.claim('replacement');
    assert.equal(other.complete(takeover,item('replacement')),true);
    return renew(job,ms);
  };
  await runPool(q,{size:1,leaseMs:30});
  assert.equal(takeover.token,2);
  assert.equal(JSON.parse(q.get('SELECT result FROM job').result).id,'replacement');
});

test('heartbeat database failure rejects the pool through its promise', async () => {
  const q = new Queue(':memory:');
  q.register({org:'a',source:'a',domain:'a.invalid'});
  q.enqueue('a','a',[{key:'x',delay:100}]);
  await assert.rejects(runPool(q,{size:1,leaseMs:30,onEvent:()=>q.db.close()}),/Worker heartbeat failed/);
});

test('four failed attempts stop the pool and explain why publication is blocked',async t => {
  const {q,add}=setup(t);
  q.now=Date.now;
  add('a');
  q.enqueue('first','a',[{key:'good'}]);
  await runPool(q);
  assert.equal(q.publish('first'),true);
  const before=q.get('SELECT data FROM snapshot').data;
  q.enqueue('second','a',[{key:'valid'},{key:'broken',fail:true}]);
  await runPool(q);
  assert.deepEqual(q.publishPreview('second'),{published:false,reason:'dead_jobs',jobs:['broken']});
  assert.equal(q.get("SELECT count(*) AS n FROM attempt WHERE outcome='error'").n,4);
  assert.equal(q.get('SELECT data FROM snapshot').data,before);
});

test('a newly opened SQLite connection recovers work after the original closes',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'globis-reopen-'));
  const path=join(dir,'queue.sqlite');
  t.after(()=>rmSync(dir,{recursive:true}));
  let initial=new Queue(path);
  let old;
  try {
    initial.register({org:'a',source:'a',domain:'a.invalid'});
    initial.enqueue('a','a',[{key:'x'}]);
    old=initial.claim('old',{leaseMs:30});
  } finally { initial.db.close(); }
  await sleep(40);
  const reopened=new Queue(path);
  try {
    const next=reopened.claim('after-restart');
    assert.equal(next.id,old.id);
    assert.equal(next.token,old.token+1);
    assert.equal(reopened.complete(old,item('stale')),false);
    assert.equal(reopened.complete(next,item('recovered')),true);
  } finally { reopened.db.close(); }
});
