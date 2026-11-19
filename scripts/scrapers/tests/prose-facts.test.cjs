'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fromProse } = require('../lib/labels.cjs');
const { makeAnimal } = require('../lib/record.cjs');

test('fromProse: stated health facts from free text', () => {
  assert.deepEqual(fromProse('Karadajus kastruotas, čipuotas, paskiepytas pagal amžių.'), { neutered: true, vaccinated: true, chipped: true });
  assert.deepEqual(fromProse('Kalytė dar nesterilizuota, bet ženklinta.'), { neutered: false, chipped: true, sex: 'female' });
});

test('fromProse: plans, conflicts and unrelated words stay unknown', () => {
  assert.deepEqual(fromProse('Prieš išvykdama bus sterilizuota ir paskiepyta.'), {});
  assert.deepEqual(fromProse('Mama sterilizuota, kačiukai dar nesterilizuoti.'), {});
  assert.deepEqual(fromProse('Sterilizacijos kaina 50 eur. Skiepai kainuoja.'), {});
  assert.deepEqual(fromProse(null), {});
});

test('makeAnimal: labelled value wins over description text', () => {
  const a = makeAnimal('s', { nativeId: '1', sourceUrl: 'https://a.lt/1', name: 'Rex', neutered: false, bio_lt: 'Rex kastruotas ir čipuotas.' });
  assert.equal(a.neutered, false);
  assert.equal(a.chipped, true);
  assert.equal(a.vaccinated, null);
});

test('fromProse: birth date written in the story, kept as written', () => {
  // Real phrasings from keturkojo-viltis.lt (2026-11-18).
  assert.equal(fromProse('🤍 📅 Gimimo data: 2019-03-01 🏡 Į prieglaudą atvyko: 2020-05-02').age_text, 'Gimimo data: 2019-03-01');
  assert.equal(fromProse('🎂 Gimimo data (spėjama): 2025-08-01 🏡').age_text, 'Gimimo data (spėjama): 2025-08-01');
  assert.equal(fromProse('Spėjama gimimo data – 2016-03-24, ūgis ties ketera 45 cm').age_text, 'Spėjama gimimo data: 2016-03-24');
  assert.equal(fromProse('Į prieglaudą atvyko 2026 metų liepos mėnesį.').age_text, undefined, 'arrival year is not a birth date');
  assert.equal(fromProse('Mama gimusi 2019, mažylis gimęs 2026-05.').age_text, undefined, 'two animals, two dates');
});

test('fromProse: birth date without a colon keeps the date whole', () => {
  assert.equal(fromProse('✅ Spėjama gimimo data 2017-04-30, sveria 10.6 kg').age_text, 'Spėjama gimimo data: 2017-04-30');
});

test('fromProse: age phrases in the story (gyvunugloba, siauliuletenele wording)', () => {
  assert.equal(fromProse('Agrastas kastruotas, 4 m. amžiaus vokiečių aviganis.').age_text, '4 m. amžiaus');
  assert.equal(fromProse('Apie dešimties metų amžiaus, vidutinio dydžio.').age_text, 'Apie dešimties metų amžiaus');
  assert.equal(fromProse('Jei šis nuostabus berniukas palietė jūsų širdį, ~2018 m. gimimo, susisiekite.').age_text, '~2018 m. gimimo');
  assert.equal(fromProse('Boksas pas mus jau metai laiko.').age_text, undefined);
  assert.equal(fromProse('Kalytė (apie 4 m. amžiaus) ir dukrytė (apie 2 m. amžiaus).').age_text, undefined, 'two ages');
});

test('fromProse: an age phrase next to another age figure stays unknown', () => {
  // Real siauliuletenele post 92739: the age belongs to the daughters, not to the post's animal.
  assert.equal(fromProse('Kalytė Dina (apie 4 m.) ir dvi jos dukrytės (apie 2 mėn. amžiaus) atvežtos.').age_text, undefined);
});

test('fromProse: size stated as "<word> ūgio/dydžio" (bukmanodraugas, sos-gyvunai, mazasdraugas wording)', () => {
  assert.equal(fromProse('Pepsis – vidutinio ūgio šunelis, draugiškas.').size, 'medium');
  assert.equal(fromProse('Apie dešimties metų amžiaus, vidutinio dydžio.').size, 'medium');
  assert.equal(fromProse('Nedidelio ūgio, linksma kalytė.').size, 'small');
  assert.equal(fromProse('Mažo ūgio berniukas.').size, 'small');
  assert.equal(fromProse('Stambaus sudėjimo, didelio ūgio šuo.').size, 'large');
  assert.equal(fromProse('Bijo didelio šuns kaimynystėje.').size, undefined, 'no ūgio/dydžio = not about this animal');
  assert.equal(fromProse('Mama didelio ūgio, šuniukai bus mažo ūgio.').size, undefined, 'two sizes');
});

test('fromProse: plural feminine participles count ("Skiepytos, ženklintos")', () => {
  // sos-gyvunai.lt/kami/ (2026-11-19)
  const r = fromProse('Apie 3mėn. Skiepytos, ženklintos. Spėjame, kad bus vidutinio/didesnio dydžio.');
  assert.equal(r.vaccinated, true);
  assert.equal(r.chipped, true);
  assert.equal(r.neutered, undefined);
  assert.equal(fromProse('Neskiepytos ir nesterilizuotos.').vaccinated, false);
  assert.equal(fromProse('Neskiepytos ir nesterilizuotos.').neutered, false);
});

test('fromProse: sex from a singular animal noun only; plurals, both sexes and child words stay unknown', () => {
  // siauliuletenele.lt LIALIA (2026-11-19)
  assert.equal(fromProse('Neseniai nečipuota kalytė rasta Pakapėje.').sex, 'female');
  assert.equal(fromProse('Rastas jaunas patinas, labai draugiškas.').sex, 'male');
  assert.equal(fromProse('Rasti du šuneliai – didesnis patinas, mažesnė kalytė!').sex, undefined);
  assert.equal(fromProse('Dvi kalytės iškart apsivaikavo.').sex, undefined);
  assert.equal(fromProse('Šeimoje auga mergaitė, šuo labai draugiškas.').sex, undefined);
});

test('record: a post named after several animals gets no sex from its story', () => {
  const { makeAnimal } = require('../lib/record.cjs');
  const base = { nativeId: '1', sourceUrl: 'https://example.lt/a', species: 'dog', bio_lt: 'Nečipuota kalytė rasta.', photos: [] };
  assert.equal(makeAnimal('x', { ...base, name: 'LIALIA' }).sex, 'female');
  assert.equal(makeAnimal('x', { ...base, name: 'MARTA IR BAIKA' }).sex, null);
});

test('fromProse: time in shelter as written after "Prieglaudoje nuo"', () => {
  // keturkojo-viltis.lt/gyvunai/zvirbliukas/ (2026-11-19)
  assert.equal(fromProse('Kitų gyvūnų draugijos nemėgsta. Prieglaudoje nuo: 2026 m. birželio mėn. Skambinkite.').in_shelter, 'nuo 2026 m. birželio mėn.');
  assert.equal(fromProse('Prieglaudoje nuo 2025-03.').in_shelter, 'nuo 2025-03');
  assert.equal(fromProse('Mama prieglaudoje nuo 2024 m., vaikai prieglaudoje nuo 2025 m.').in_shelter, undefined);
});

test('fromProse: arrival date "Į prieglaudą atvyko" counts as time in shelter; bare "atvyko" does not', () => {
  // keturkojo-viltis.lt (2026-11-19)
  assert.equal(fromProse('Į prieglaudą atvyko – 2025-07-29 iš Viečiūnų.').in_shelter, 'nuo 2025-07-29');
  assert.equal(fromProse('Vaikinas atvyko į prieglaudą 2025 metų balandžio mėnesį mirus šeimininkui.').in_shelter, 'nuo 2025 metų balandžio mėnesį');
  assert.equal(fromProse('Taip jis į mūsų globą atvyko 2026-04-01.').in_shelter, 'nuo 2026-04-01');
  assert.equal(fromProse('📅 Gimimo data: 2019-03-01 🏡 Į prieglaudą atvyko: 2021-03-24 ✔️ Ženklinta').in_shelter, 'nuo 2021-03-24');
  assert.equal(fromProse('Projekto dieną atvyko labai garbaus amžiaus pora.').in_shelter, undefined);
});

test('fromProse: "apie N metų/mėn." ages and facts after an emoji', () => {
  // gyvunugloba.com (2026-11-19)
  assert.equal(fromProse('Apie 6-7 metų, apie 30 kg svorio, sterilizuota Meksika.').age_text, 'Apie 6-7 metų');
  assert.equal(fromProse('Apie 4mėn. švelnutė princesė🤗').age_text, 'Apie 4mėn.');
  assert.equal(fromProse('Alytė jaunutė, apie 3 metukų amžiaus, apvalutė.').age_text, 'Apie 3 metukų amžiaus');
  assert.equal(fromProse('Pirmam triušiukui 3 mėn, kitiems po 6 mėn.').age_text, undefined);
  assert.equal(fromProse('Kai susidraugausim, namuose bus meilūnas🤍 Kastruotas ir visa padaryta.').neutered, true);
  assert.equal(fromProse('Kai susidraugausim, bus kastruotas.').neutered, undefined);
});
