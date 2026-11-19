const {test}=require('node:test');const assert=require('node:assert/strict');
const {defaults,selectPets,roster,activeFilters,pl}=require('../src/mobile/selectors.cjs');
const {facts,openQuestions}=require('../src/mobile/facts.cjs');
test('card and grid share exact species/city/explicit urgency rules',()=>{
 const pets=[{id:'a',species:'dog',city:'Vilnius',shelter:{id:'one'},status:'unknown'},{id:'b',species:'cat',city:'Vilnius',shelter:{id:'two'},status:'reserved'},{id:'c',species:'dog',city:'Kaunas',shelter:{id:'two'},urgent:true,urgentEvidence:'explicit'}];
 assert.deepEqual(selectPets(pets,defaults).map(p=>p.id),['a','c']);
 assert.deepEqual(selectPets(pets,{...defaults,city:'Vilnius'}).map(p=>p.id),['a']);
 assert.deepEqual(selectPets(pets,{...defaults,urgent:true}).map(p=>p.id),['c']);
 assert.deepEqual(roster(pets,'two').map(p=>p.id),['b','c']);
 assert.equal(selectPets([{...pets[0],waitingDays:300}],{...defaults,urgent:true}).length,0);
});

test('search matches name, city and shelter without accents and keeps eligibility rules',()=>{
 const pets=[{id:'a',name:'Rudis',species:'dog',city:'Šiauliai',shelter:{id:'x',name:'VšĮ Šiaulių letenėlė'},status:'unknown'},{id:'b',name:'Mėta',species:'cat',city:'Kaunas',shelter:{id:'y',name:'Penkta koja'},status:'unknown'},{id:'c',name:'Rūta',species:'cat',city:'Siauliai',shelter:{id:'x',name:'VšĮ Šiaulių letenėlė'},status:'reserved'}];
 assert.deepEqual(selectPets(pets,{...defaults,query:'siauliu'}).map(p=>p.id),['a']);
 assert.deepEqual(selectPets(pets,{...defaults,query:'meta'}).map(p=>p.id),['b']);
 assert.deepEqual(selectPets(pets,{...defaults,query:'kate kaunas'}).map(p=>p.id),['b']);
 assert.equal(selectPets(pets,{...defaults,query:'zzz'}).length,0);
 assert.equal(activeFilters(defaults),0);
 assert.equal(activeFilters({...defaults,city:'Kaunas',urgent:true,query:'x',species:'cat'}),3);
});
test('Lithuanian plural forms',()=>{
 const f=n=>pl(n,'skelbimas','skelbimai','skelbimų');
 assert.deepEqual([0,1,2,9,10,11,12,19,20,21,22,111,933].map(f),['skelbimų','skelbimas','skelbimai','skelbimai','skelbimų','skelbimų','skelbimų','skelbimų','skelbimų','skelbimas','skelbimai','skelbimų','skelbimai']);
});
test('profile facts never invent values and ask about every unknown',()=>{
 const empty={id:'a',name:'Soja',status:'unknown',sex:null,ageLt:null,size:null,bioLt:null,medical:{vaccinated:null,neutered:null,chipped:null}};
 assert.ok(facts(empty,'lt').every(f=>f.value===null&&f.note==null));
 const q=openQuestions(empty,'lt');
 assert.ok(q.some(x=>x.includes('metų'))&&q.some(x=>x.includes('lytis'))&&q.some(x=>x.includes('vis dar ieško namų')));
 const known={...empty,sex:'Patelė',ageLt:'2 m.',medical:{vaccinated:true,neutered:false,chipped:true},bioLt:'Rami.',status:'available'};
 const byKey=Object.fromEntries(facts(known,'lt').map(f=>[f.key,f]));
 assert.equal(byKey.sex.value,'Patelė');assert.equal(byKey.vaccinated.value,'Taip');assert.equal(byKey.neutered.value,'Ne');assert.equal(byKey.vaccinated.note,'Pagal skelbimą');assert.equal(byKey.size.value,null);
 const kq=openQuestions(known,'lt');
 assert.ok(!kq.some(x=>x.includes('metų'))&&!kq.some(x=>x.includes('vis dar ieško namų'))&&kq.some(x=>x.includes('dydis')));
});
test('profile facts: sex and size codes in words; a birth date is labelled as one',()=>{
 const pet={sex:'male',size:'small',ageLt:'2018 10 14',medical:{}};
 const by=(p,l)=>Object.fromEntries(facts(p,l).map(f=>[f.key,f]));
 assert.equal(by(pet,'lt').sex.value,'Patinas');assert.equal(by(pet,'en').size.value,'Small');
 assert.deepEqual([by(pet,'lt').age.label,by(pet,'lt').age.value],['Gimimo data','2018 10 14']);
 const est=by({...pet,ageLt:'Spėjama gimimo data: 2016-03-24'},'lt').age;
 assert.deepEqual([est.label,est.value],['Gimimo data','2016-03-24 (spėjama)']);
 assert.deepEqual([by({...pet,ageLt:'4-8 metai'},'lt').age.label,by({...pet,ageLt:'4-8 metai'},'lt').age.value],['Amžius','4-8 metai']);
});
test('profile in English shows the shelter\'s Lithuanian text instead of "not stated"',()=>{
 const pet={ageLt:'4-8 metai',ageEn:null,bioLt:'Rami.',bioEn:null,medical:{}};
 assert.equal(Object.fromEntries(facts(pet,'en').map(f=>[f.key,f])).age.value,'4-8 metai');
 assert.ok(!openQuestions(pet,'en').some(q=>/How old|What is the animal like/.test(q)));
});

test('facts: time in shelter shown only when the shelter states it', () => {
  const {facts}=require('../src/mobile/facts.cjs');
  assert.equal(facts({inShelterLt:'nuo 2026-09-13'}).find(f=>f.key==='inShelter').value,'nuo 2026-09-13');
  assert.equal(facts({}).some(f=>f.key==='inShelter'),false);
});
