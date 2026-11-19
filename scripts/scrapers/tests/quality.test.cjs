'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runSource } = require('../lib/run-source.cjs');
const { makeAnimal } = require('../lib/record.cjs');
const { fromProse } = require('../lib/labels.cjs');
const { publish } = require('../lib/snapshot.cjs');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const item = (id, extra = {}) => ({ nativeId: id, sourceUrl: `https://shelter.invalid/${id}`, ...extra });
const adapter = animals => ({ id: 'shelter', hosts: ['shelter.invalid'], collect: async () => ({ animals, complete: true }) });

test('every candidate has an audit result; one invalid record prevents publication', async () => {
  const run = await runSource(adapter([item('a'), item('b', { sourceUrl: 'https://unrelated.invalid/b' })]), {});
  assert.equal(run.state, 'partial');
  assert.equal(run.quality.checked, 2);
  assert.equal(run.quality.records.length, 2);
  assert.deepEqual(run.quality.records[1].errors, ['source_host_mismatch']);
  assert.equal(run.quality.records[0].result, 'pass');
  assert.ok(run.quality.records[0].warnings.includes('missing_photo'));
});

test('duplicate identities are invalid even when every individual record parses', async () => {
  const run = await runSource(adapter([item('a'), item('a')]), {});
  assert.equal(run.state, 'partial');
  assert.ok(run.quality.records.every(r => r.errors.includes('duplicate_id')));
});

test('unreadable raw records are counted, not silently omitted from the audit', async () => {
  const run = await runSource(adapter([item('ok'), { nativeId: '', sourceUrl: 'https://shelter.invalid/x' }]), {});
  assert.equal(run.quality.checked, 2);
  assert.equal(run.quality.invalid, 1);
  assert.equal(run.animals.length, 1);
  assert.equal(run.state, 'partial');
});

test('every claimed availability needs evidence, while unknown facts remain unknown', () => {
  assert.throws(() => makeAnimal('s', item('x', { status: 'available' })), /evidence/);
  assert.equal(makeAnimal('s', item('x')).vaccinated, null);
});

test('page and photo URLs cannot contain credentials or executable schemes', () => {
  assert.throws(() => makeAnimal('s', item('x', { sourceUrl: 'https://user:secret@shelter.invalid/x' })), /sourceUrl/);
  assert.throws(() => makeAnimal('s', item('x', { photos: ['javascript:alert(1)'] })), /photo/i);
});

test('separate negation and uncertainty cannot become positive health facts', () => {
  assert.equal(fromProse('Dar ne kastruotas.').neutered, false);
  assert.equal(fromProse('Nėra skiepytas, bet kastruotas.').vaccinated, false);
  assert.equal(fromProse('Nėra skiepytas, bet kastruotas.').neutered, true);
  assert.equal(fromProse('Nežinoma, ar paskiepytas.').vaccinated, undefined);
  assert.equal(fromProse('Ar kastruotas?').neutered, undefined);
  assert.equal(fromProse('Ne tik paskiepytas, bet ir čipuotas.').vaccinated, true);
  assert.equal(fromProse('Ženklinta, skiepyta, kastruota 💔 Ar galite įsivaizduoti?').neutered, true);
  assert.equal(fromProse('Skiepyta Čipuota Sterilizuota FIV/FeLV testai neigiami Galbūt jūsų namuose?').vaccinated, true);
});

test('the Mazeikiai API adapter preserves the exact adoptable field as availability evidence', async () => {
  const real = require('../adapters/mazeikiugyvunai.cjs');
  const result = await real.collect({ fetcher: { getJson: async () => ({ json: {
    data: [{ id: 42, adoptable: true, outcome: null, animal: { name: 'Testas' } }], totalItems: 1, itemsPerPage: 20,
  } }) } });
  const animal = makeAnimal(real.id, result.animals[0]);
  assert.equal(animal.statusEvidence, 'adoptable: true');
});

test('an unrelated future/adoption clause cannot hide a clearly completed health fact', () => {
  assert.equal(fromProse('Namuose bus meilūnas 🤍 Kastruotas ir visa padaryta').neutered, true);
  assert.equal(fromProse('Jei priimam ir duodam 🩷 Tibras kastruotas, čipuotas').chipped, true);
  const facts = fromProse('Ženklinta ✔️ Skiepyta ✔️ Sterilizuota 💛 Galbūt jūsų namuose?');
  assert.equal(facts.vaccinated, true);
  assert.equal(facts.neutered, true);
  assert.equal(facts.chipped, true);
  assert.equal(fromProse('Skiepinta, pažymėta mikroschema.').vaccinated, true);
  assert.equal(fromProse('Skiepinta, pažymėta mikroschema.').chipped, true);
  assert.equal(fromProse('Pažymėta kaip draugiška.').chipped, undefined);
});

test('local publication rejects delayed observations and a replay cannot confirm a large drop', t => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globis-local-order-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const run = (second, count, state = 'complete') => ({ source: 'shelter', state,
    startedAt: new Date(1700000000000 + second * 1000).toISOString(),
    finishedAt: new Date(1700000000100 + second * 1000).toISOString(), skipped: [], errors: [], requests: 1,
    animals: Array.from({ length: count }, (_, i) => makeAnimal('shelter', item(String(i)))) });
  assert.equal(publish(run(10, 20), { outDir }).published, true);
  assert.equal(publish(run(5, 20), { outDir }).published, false);
  const shrinking = run(11, 5);
  for (let i = 0; i < 3; i++) assert.equal(publish(shrinking, { outDir }).published, false);
  assert.equal(publish(run(12, 5, 'failed'), { outDir }).published, false);
  assert.equal(publish(run(13, 5), { outDir }).published, false);
  assert.equal(publish(run(14, 5), { outDir }).published, false);
  assert.equal(publish(run(15, 5), { outDir }).published, true);
});
