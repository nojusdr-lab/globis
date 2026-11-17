const {test}=require('node:test');
const assert=require('node:assert/strict');
const {emptyState,langFromLocale,reducer,decode,shouldClaim}=require('../src/state/discovery.cjs');
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
test('taps and vertical scroll do not claim a swipe',()=>{
 for(const gesture of [{dx:0,dy:0},{dx:7,dy:1},{dx:10,dy:20}]) assert.equal(shouldClaim(gesture),false);
 assert.equal(shouldClaim({dx:10,dy:1}),true);assert.equal(shouldClaim({dx:-10,dy:1}),true);
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
