const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
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
