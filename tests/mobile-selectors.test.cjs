const {test}=require('node:test');const assert=require('node:assert/strict');
const {defaults,selectPets,roster}=require('../src/mobile/selectors.cjs');
test('card and grid share exact species/city/explicit urgency rules',()=>{
 const pets=[{id:'a',species:'dog',city:'Vilnius',shelter:{id:'one'},status:'unknown'},{id:'b',species:'cat',city:'Vilnius',shelter:{id:'two'},status:'reserved'},{id:'c',species:'dog',city:'Kaunas',shelter:{id:'two'},urgent:true,urgentEvidence:'explicit'}];
 assert.deepEqual(selectPets(pets,defaults).map(p=>p.id),['a','c']);
 assert.deepEqual(selectPets(pets,{...defaults,city:'Vilnius'}).map(p=>p.id),['a']);
 assert.deepEqual(selectPets(pets,{...defaults,urgent:true}).map(p=>p.id),['c']);
 assert.deepEqual(roster(pets,'two').map(p=>p.id),['b','c']);
 assert.equal(selectPets([{...pets[0],waitingDays:300}],{...defaults,urgent:true}).length,0);
});
