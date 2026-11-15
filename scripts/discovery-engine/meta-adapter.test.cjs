const test = require('node:test');
const assert = require('node:assert/strict');
const { Queue } = require('./queue.cjs');
const { runPool } = require('./workers.cjs');
const { sourceState,recordDecision,enqueueMeta,executeMetaFixture,classify } = require('./meta-adapter.cjs');
const sample = require('./fixtures/meta.synthetic.json');

function setup(t) {
  let now=Date.now();
  const q=new Queue(':memory:',()=>now);
  t.after(()=>q.db.close());
  for (const source of ['a','b']) q.register({source,org:source,domain:'graph.facebook.com'});
  const decide=(source='a',state='approved')=>recordDecision(q,{
    source,state,pageId:sample.pageId,route:'page_oauth',expires:now+10000,evidence:'Synthetic fixture only',
  });
  const enqueue=(fixture=sample,source='a',org=source)=>enqueueMeta(q,{fixture,source,org});
  return {q,decide,enqueue,tick:ms=>{now+=ms;}};
}

test('default blocked, independently scoped, auditable decisions with expiration',t=>{
  const {q,decide,enqueue,tick}=setup(t);
  assert.deepEqual(sourceState(q,'a'),{state:'unconfigured',connection:'not_connected'});
  assert.throws(()=>enqueue(),/denied/);
  for (const state of ['review_required','unsupported','expired','revoked']) {
    decide('a',state);
    assert.equal(sourceState(q,'a').state,state);
    assert.throws(()=>enqueue(),/denied/);
  }
  decide();
  assert.throws(()=>enqueue(sample,'b'),/denied/);
  assert.throws(()=>enqueue(sample,'a','b'),/denied/);
  assert.throws(()=>enqueue({...sample,pageId:'99'}),/scoped/);
  const run=enqueue(), job=q.claim('w');
  tick(10000);
  assert.equal(sourceState(q,'a').state,'expired');
  assert.equal(sourceState(q,'a').connection,'not_connected');
  assert.equal(q.complete(job,{}),false);
  assert.equal(q.publishPreview(run).reason,'meta_access_denied');
  assert.equal(q.get('SELECT count(*) AS n FROM meta_access').n,5);
});

test('worker normalizes scoped pages, preserves provenance and never follows paging URL',async t=>{
  const {q,decide,enqueue}=setup(t);
  decide();
  const run=enqueue();
  assert.equal(enqueue(),run);
  assert.doesNotMatch(q.get('SELECT payload FROM job').payload,/paging\.invalid/);
  await runPool(q);
  assert.equal(q.publish(run),true);
  const [first,second]=JSON.parse(q.get('SELECT data FROM snapshot').data);
  assert.equal(first.status,'reserved');
  assert.equal(first.statusEvidence,'Būsena: rezervuotas');
  assert.equal(second.status,null);
  assert.equal(first.vaccinated,null);
  assert.equal(first.media[0].rights,'unknown');
  assert.equal(first.postedAt,'2026-11-01T12:00:00.000Z');
  assert.equal(first.sourceId,'a');
  assert.match(second.evidenceRef.sha256,/^[0-9a-f]{64}$/);
});

test('partial, foreign Page and removed post errors leave the previous snapshot',async t=>{
  const {q,decide,enqueue}=setup(t);
  decide();
  const good=enqueue();
  await runPool(q);
  assert.equal(q.publish(good),true);
  const before=q.get('SELECT data FROM snapshot').data;
  const partial=enqueue({...sample,pages:sample.pages.slice(0,1)});
  const wrong=structuredClone(sample);
  wrong.pages[0].responses[0].body.data[0].id='123_1';
  const foreign=enqueue(wrong);
  const removed=structuredClone(sample);
  removed.pages[1].responses=[{status:400,body:{error:{code:100,error_subcode:33}}}];
  const missing=enqueue(removed);
  await runPool(q);
  for(const run of [partial,foreign,missing]) assert.equal(q.publish(run),false);
  assert.equal(q.get('SELECT data FROM snapshot').data,before);
  assert.equal(q.get("SELECT count(*) AS n FROM attempt WHERE outcome='unavailable_unconfirmed'").n,1);
});

test('Meta throttling applies a shared-domain delay and retries with the same job',t=>{
  const {q,decide,enqueue,tick}=setup(t);
  decide();decide('b');
  const throttled=structuredClone(sample);
  throttled.pages[0].responses.unshift({status:429,headers:{'retry-after':'2'},body:{}});
  const run=enqueue(throttled);
  enqueue(sample,'b');
  const job=q.claim('w');
  assert.equal(q.claim('w2'),null);
  assert.throws(()=>executeMetaFixture(job,q.now()),error=>q.fail(job,error));
  tick(1999);
  assert.equal(q.claim('w2'),null);
  tick(1);
  assert.equal(q.claim('w2').org,'b');
  assert.equal(q.get('SELECT state FROM job WHERE run=?',run).state,'ready');
  tick(1000);
  const retry=q.claim('w');
  assert.equal(retry.id,job.id);
  assert.equal(retry.token,2);
  assert.equal(q.complete(retry,executeMetaFixture(retry,q.now())),true);
  assert.equal(q.publish(run),true);
});

test('Graph errors distinguish throttling, permissions, invalid token and missing objects',()=>{
  for (const code of [4,17,32,613,80001]) assert.equal(classify({status:400,body:{error:{code}}},0).kind,'rate_limited');
  for (const [code,kind] of [[190,'token_invalid'],[200,'permission_denied'],[283,'permission_denied']]) {
    assert.deepEqual(classify({status:400,body:{error:{code}}},0),{kind,retry:false});
  }
  assert.equal(classify({status:404},0).kind,'unavailable_unconfirmed');
});

test('unpublished posts are excluded and a revoked approval blocks an already validated batch',async t=>{
  const {q,decide,enqueue}=setup(t);
  decide();
  const reduced=structuredClone(sample);
  reduced.pages[1].responses[0].body.data[0].is_published=false;
  const run=enqueue(reduced);
  await runPool(q);
  assert.equal(JSON.parse(q.get('SELECT result FROM job').result).items.length,1);
  decide('a','revoked');
  assert.equal(q.publishPreview(run).reason,'meta_access_denied');
  assert.equal(q.get('SELECT count(*) AS n FROM snapshot').n,0);
});
