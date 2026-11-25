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

test('fromProse: cat nouns "katinas/katinukas" male, "katytė" female; an opposite-sex plural voids it', () => {
  // mgma.lt Mochikanas, mazasdraugas.lt Pepsis (2026-11-19)
  assert.equal(fromProse('Sveikas, drūtas, jaunas (gimęs 2022 metais) katinas Mochikanas ieško namų.').sex, 'male');
  assert.equal(fromProse('Pepsis – meilus ir mielas katinukas.').sex, 'male');
  assert.equal(fromProse('Ši juoda katytė labai meili.').sex, 'female');
  // mgma.lt "3 Kačiukai iš Balsupių k." (2026-11-19)
  assert.equal(fromProse('Į mūsų globą perduoti 3 kačiukai: katinas ir dvi katytės iš Balsupių k.').sex, undefined);
  assert.equal(fromProse('FIV turinčios katytės taip pat gali džiaugtis kasdienybe.').sex, undefined);
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

test('fromProse: "laukia <procedure>" means not done yet', () => {
  // sos-gyvunai.lt Izė/Natas, KissTutis; siauliuletenele PAKRUOJO DVARININKAS (2026-11-19)
  const r = fromProse('Pas mus jie jau gavo vaistų, dar laukia skiepai, ženklinimas, sterilizacija/kastracija.');
  assert.deepEqual([r.vaccinated, r.chipped, r.neutered], [false, false, false]);
  assert.equal(fromProse('Ateityje laukia kastracija ir dantukų tvarkymas.').neutered, false);
  assert.equal(fromProse('Skiepyta, čipuota, sterilizuota. Galbūt jūsų namuose Upės laukia tas žmogus.').neutered, true);
  assert.equal(fromProse('Kastruotas. Laukia kastracija.').neutered, undefined); // contradiction -> unknown
});

test('fromProse: "suženklintas/suženklinta" counts as chipped (sos-gyvunai Seras, Luna)', () => {
  const r = fromProse('Gimimo data: 2017.01.01 Paskiepyta, suženklinta, gavo vaistų nuo vidaus ir išorės parazitų, sterilizuota.');
  assert.equal(r.chipped, true);
  assert.equal(r.vaccinated, true);
  assert.equal(r.neutered, true);
  assert.equal(fromProse('Dar nesuženklintas.').chipped, false);
});

test('fromProse: short "skiepta" counts as vaccinated (sos-gyvunai Ruzlė)', () => {
  assert.equal(fromProse('Apie 14 metų. Sterilizuota, skiepta, ženklinta.').vaccinated, true);
  assert.equal(fromProse('Dar neskieptas.').vaccinated, false);
});

test('fromProse: facts in parentheses are not voided by a plan word outside them (siauliuletenele Zulis)', () => {
  const r = fromProse('Apie Zulį (~2018m. gimimo, kastruotas, čipuotas, vakcinuotas) visa informacija bus suteikta tel.');
  assert.equal(r.neutered, true);
  assert.equal(r.chipped, true);
  assert.equal(r.vaccinated, true);
  // A plan inside the parentheses still counts as a plan.
  assert.equal(fromProse('Atvyko mamytė Čipa (ji bus sterilizuota ir grąžinta atgal).').neutered, undefined);
});

test('isDonationTitle: donation shop items, not animal names', () => {
  const { isDonationTitle } = require('../lib/labels.cjs');
  assert.equal(isDonationTitle('Dovana – parama'), true);
  assert.equal(isDonationTitle('MAISTO PARAMA'), true);
  assert.equal(isDonationTitle('Paramarija'), false);
  assert.equal(isDonationTitle('Reksas'), false);
  assert.equal(isDonationTitle(null), false);
});

test('fromProse: "pažymėtas/ženklina mikroschema" counts as chipped (beglobis Gerbas, Ninja, Kingas, Lilya)', () => {
  assert.equal(fromProse('Gerbas kastruotas, paskiepytas, pažymėtas mikroschema, tvarkingai naudojasi kraiko dėžute.').chipped, true);
  assert.equal(fromProse('Činas skiepytas, žymėtas mikroschema.').chipped, true);
  assert.equal(fromProse('Ninja sterilizuota, paskiepyta ir ženklina mikroschema.').chipped, true);
  assert.equal(fromProse('Jis skiepytas ir pažymėtas mikrochema.').chipped, true);
  assert.equal(fromProse('Kalytė sterilizuota, skiepyta, zenklinta mikroschema.').chipped, true);
  assert.equal(fromProse('Dar nepažymėtas mikroschema.').chipped, false);
  // "Pažymėtas" without the chip word says nothing about a chip.
  assert.equal(fromProse('Kalendoriuje pažymėtas susitikimas.').chipped, undefined);
  // A plan stays a plan.
  assert.equal(fromProse('Prieš išvykstant bus pažymėtas mikroschema.').chipped, undefined);
});

test('fromProse: "sučipuotas/sučipuota" counts as chipped (mgma Tuma, 20254)', () => {
  assert.equal(fromProse('Visiškai paruošta kelionei namo: Tuma jau yra paskiepyta, sterilizuota, nukirminta ir sučipuota.').chipped, true);
  assert.equal(fromProse('Kastruotas, nukirmintas, paskiepytas kompleksine vakcina ir sučipuotas.').chipped, true);
  assert.equal(fromProse('Dar nesučipuotas.').chipped, false);
});

test('fromProse: "tarsi/lyg būtų" is a comparison, not a plan (naminukai Žaneta)', () => {
  const f = fromProse('Ji sterilizuota, čipuota, paskiepyta, vyresnio amžiaus, bet atrodo, tarsi būtų gimusi iš naujo.');
  assert.equal(f.chipped, true);
  assert.equal(f.vaccinated, true);
  assert.equal(f.neutered, true);
  assert.equal(fromProse('Jis skiepytas, lyg būtų visada čia gyvenęs.').vaccinated, true);
  // Plain "būtų" still marks a wish or plan.
  assert.equal(fromProse('Būtų gerai, kad būtų skiepytas.').vaccinated, undefined);
});
