const {test}=require('node:test');
const assert=require('node:assert/strict');
const {emptyState,langFromLocale,reducer,decode}=require('../src/state/discovery.cjs');
test('save/pass/undo restores the exact prior sets and ordering',()=>{
 let s=emptyState();
 s=reducer(s,{type:'save',id:'a'});s=reducer(s,{type:'pass',id:'b'});
 const before=structuredClone(s);
 s=reducer(s,{type:'pass',id:'a'});
 assert.deepEqual(reducer(s,{type:'undo'}),before);
 s=reducer(before,{type:'undo'});assert.deepEqual(s.passed,[]);assert.deepEqual(s.saved,['a']);
 assert.deepEqual(reducer(reducer(s,{type:'undo'}),{type:'undo'}),emptyState());
});
test('duplicate save is idempotent, choices and language survive reload',()=>{
 let s=reducer(emptyState(),{type:'save',id:'globok:a'});
 assert.deepEqual(reducer(s,{type:'save',id:'globok:a'}),s);
 s=reducer(s,{type:'language',lang:'en'});
 assert.deepEqual(decode(JSON.stringify(s)),s);
 assert.deepEqual(reducer(decode(JSON.stringify(s)),{type:'undo'}).saved,[]);
 for(const raw of ['broken','{}',JSON.stringify({...s,passed:s.saved}),JSON.stringify({...s,saved:['a','a']})]) assert.throws(()=>decode(raw));
});


test('storage read recovery hydrates validated prior choices without replacing them with defaults',()=>{
 const previous=reducer(emptyState(),{type:'save',id:'globok:kept'});
 assert.deepEqual(reducer(emptyState(),{type:'hydrate',state:decode(JSON.stringify(previous))}),previous);
 assert.throws(()=>reducer(previous,{type:'hydrate',state:{broken:true}}));
 assert.deepEqual(previous.saved,['globok:kept']);
});

test('first launch language follows the phone, unknown stays Lithuanian',()=>{
 assert.equal(langFromLocale('lt-LT'),'lt');
 assert.equal(langFromLocale('LT'),'lt');
 assert.equal(langFromLocale(''),'lt');
 assert.equal(langFromLocale(undefined),'lt');
 assert.equal(langFromLocale('en-US'),'en');
 assert.equal(langFromLocale('de-DE'),'en');
 assert.equal(emptyState('en').lang,'en');
 assert.equal(emptyState().lang,'lt');
 assert.equal(emptyState('fr').lang,'lt');
});

test('onboarding and filters persist, bad filter values fall back to defaults',()=>{
 let s=reducer(emptyState(),{type:'onboarded',filters:{species:'dog',city:'Kaunas',urgent:false,query:''}});
 assert.equal(s.onboarded,true);
 assert.equal(reducer(s,{type:'replayOnboarding'}).onboarded,undefined);
 assert.deepEqual(decode(JSON.stringify(s)),s);
 s=reducer(s,{type:'filters',filters:{species:'fish',city:5,urgent:'yes',extra:1}});
 assert.deepEqual(s.filters,{species:'all',city:'all',urgent:false,query:''});
 assert.equal(decode(JSON.stringify(emptyState())).onboarded,undefined);
});

test('account sync: server saves merge into the device list; plan mirrors device changes', () => {
  const { reducer: r, emptyState: e, syncPlan } = require('../src/state/discovery.cjs');
  let s = r(r(e(), { type: 'save', id: 'a' }), { type: 'save', id: 'b' });
  s = r(s, { type: 'mergeSaved', ids: ['b', 'c', 7] });
  assert.deepEqual(s.saved, ['b', 'a', 'c']);
  assert.deepEqual(syncPlan(['a', 'c'], new Set(['c', 'x'])), { add: ['a'], drop: ['x'] });
});

test('saved snapshot: kept for saved animals, cleaned, and survives encode/decode', () => {
  const { reducer: r, emptyState: e, decode: d } = require('../src/state/discovery.cjs');
  let s = r(e(), { type: 'save', id: 'a', snap: { name: 'Rex', photo: 'https://x/1.jpg', evil: '<x>', city: 7 } });
  s = r(s, { type: 'save', id: 'b', snap: { photo: 'https://x/2.jpg' } }); // no name: no snapshot
  assert.deepEqual(s.snaps, { a: { name: 'Rex', photo: 'https://x/1.jpg' } });
  s = r(s, { type: 'remove', id: 'a' });
  assert.equal(d(JSON.stringify(s)).snaps, undefined); // snapshot of a removed animal is dropped on reload
});
