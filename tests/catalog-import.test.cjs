const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { validateCatalog } = require('../scripts/catalog-import.cjs');

function fixture() {
  const catalogId='synthetic-1';
  const listing = (name,statusText)=>({
    url:'https://globok.lt/gyvunai/fixture-'+name,name,species:'dog',shelterId:'fixture',statusText,
  });
  return {
    decision:{source:'globok',state:'approved',evidence:'Synthetic fixture only',expiresAt:200},
    now:100,catalogId,total:3,pageSize:2,shelters:[{id:'fixture'}],
    pages:[
      {catalogId,total:3,number:1,next:2,httpStatus:200,listings:[listing('a','Rezervuota.'),listing('b','Rezervuotas anksčiau')]},
      {catalogId,total:3,number:2,next:null,httpStatus:200,listings:[listing('c','Nerezervuotas.')]},
    ],
  };
}

test('complete catalog is deterministic and never infers adoption or a medical fact',()=>{
  const packet=fixture();
  const baseline={pets:[],shelters:[]};
  const first=validateCatalog(packet,baseline);
  assert.deepEqual(validateCatalog(packet,first),first);
  assert.deepEqual(first.pets.map(x=>x.status),['reserved','unknown','unknown']);
  assert.equal(first.pets[0].id,'globok:fixture-a');
  assert.equal(first.pets[0].medical,undefined);
});

test('invalid packets and disabled live CLI preserve the actual committed snapshot bytes',()=>{
  const root=join(__dirname,'..');
  const paths=['allPets.json','shelters.json'].map(name=>join(root,'src','data',name));
  const before=paths.map(path=>readFileSync(path));
  const good=validateCatalog(fixture(),{pets:[],shelters:[]});
  const cases=[
    p=>p.pages.pop(),
    p=>{p.pages[1]=p.pages[0];},
    p=>{p.pages[0].listings.pop();},
    p=>{p.pages[0].next=null;},
    p=>{p.pages[1].next=3;},
    p=>{p.pages[1].catalogId='changed-while-paging';},
    p=>{p.pages[1].total=4;},
    p=>{p.pages[1].listings[0].url=p.pages[0].listings[0].url+'?ref=duplicate';},
    p=>{p.pages[1].listings[0].id='globok:fixture-a';},
    p=>{p.pages[1].httpStatus=503;},
    p=>{p.pages[1].error='timeout';},
    p=>{p.decision.state='review_required';},
    p=>{p.decision.expiresAt=p.now;},
    p=>{p.decision.evidence='';},
    p=>{p.total=2; p.pages.pop(); p.pages[0].total=2; p.pages[0].next=null;},
    p=>{p.pages[1].listings[0].url='https://globok.lt/gyvunai/fixture-replacement';},
  ];
  for (const change of cases) {
    const packet=fixture();
    change(packet);
    assert.throws(()=>validateCatalog(packet,good),undefined,change.toString());
  }
  const cli=spawnSync(process.execPath,['scripts/scrape-globok.js','--check'],{cwd:root,encoding:'utf8'});
  assert.equal(cli.status,1);
  assert.match(cli.stderr,/disabled/);
  assert.deepEqual(paths.map(path=>readFileSync(path)),before);
});
