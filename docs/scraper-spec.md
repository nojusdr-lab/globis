# Rinkiklio specifikacija (savininko patvirtinta 2026-11-17)

## 1. Šaltinis
- Kiekvienas gyvūnas imamas iš **pačios prieglaudos svetainės**.
- **globok.lt programėlėje nenaudojamas**: jokių duomenų, nuorodų, logotipų.
- globok.lt galima skaityti **tik vidiniam patikrinimui**: ar nepraleidome prieglaudos ar gyvūno, idėjoms. Niekas iš jo nepatenka į programėlę.
- Pereinamasis laikotarpis: prieglaudos globok.lt eilutės išjungiamos tada, kai ji gauna savo rinkiklį, kad gyvūnai nedingtų iš programėlės.
- „Originalus skelbimas“ veda į gyvūno puslapį prieglaudos svetainėje (pvz. `https://naminukai.com/otas/`).

## 2. Aprėptis
- Visos Lietuvos prieglaudos: VMVT globėjų registras (95 aktyvūs) + rastos internete.
- Kiekvienos prieglaudos būsena `scripts/scrapers/sources.json`: renkama / neturi sąrašo / svetainė neveikia arba persikėlė (tikrinti iš naujo) / draudžia rinkti.
- Prieglauda tik su Facebook: imamas tik profilis (pavadinimas, kontaktai, logotipas).
- Prieglauda be sąrašo ar draudžianti rinkti rodoma kaip kortelė su kontaktais.

## 3. Prieglaudos laukai
Pavadinimas, miestas, prieglaudos patalpų adresas (ne privataus asmens), telefonas, el. paštas, svetainė, darbo laikas ir lankymo tvarka, paramos nuoroda.
Logotipas iš prieglaudos svetainės ar Facebook profilio, **saugomas pas mus**. Nėra — rodomos pavadinimo raidės.

## 4. Gyvūno laukai (viskas, ką prieglauda paskelbė)
- Vardas, rūšis, veislė / mišrūnas, lytis, amžius, dydis, svoris, spalva.
- Sveikata: paskiepytas, sterilizuotas/kastruotas, ženklintas, sveikatos pastabos.
- Charakteris: su vaikais, šunimis, katėmis; tinka butui; energingas/ramus.
- Visas aprašymas.
- Visos nuotraukos ir vaizdo įrašai.
- Atnaujinimo data šaltinyje.
- Būsena: ieško namų / rezervuotas / nebeskelbiamas.

## 5. Rinkimo eiga
1. Prieglaudos gyvūnų sąrašas.
2. **Kiekvieno gyvūno puslapis privalomas** (vien sąrašas palieka „Nenurodyta“).
3. Faktai tik iš aiškaus teksto, taip pat iš aprašymo („kastruotas, ženklintas ir paskiepytas“ užpildo tris laukus).
4. Nieko neišgalvoti: nėra šaltinyje — laukas tuščias.

## 6. Atnaujinimas
- Kasdien automatiškai. Prieglaudos renkamos lygiagrečiai; viena svetainė mandagiu tempu, `robots.txt` `Crawl-delay` gerbiamas.
- Gyvūnas dingo iš svetainės, rezervuotas ar įvaikintas → **iš „Globoti“ srauto išimamas iš karto**. Išsaugotuose lieka su žyma „nebeskelbiamas“.
- Nepavykęs ar nepilnas paleidimas neperrašo paskutinės geros kopijos.

## 7. Kokybės ataskaita po paleidimo
Kiekvienai prieglaudai: gyvūnų skaičius, laukų užpildymo procentai, įspėjimas jei skaičius staiga krito ar svetainė pasikeitė. Palyginimas su globok.lt: ko galbūt nepraleidome.

## 8. Ribos
`robots.txt` ir taisyklės, be prisijungimo, neapeiti apsaugų, tik gyvūnų ir prieglaudų duomenys.

## 9. Eilė
1. Nauji rinkikliai prieglaudoms, kurios dabar ateina per globok.lt: Keturkojo viltis (111), Mažeikių gyvūnai (82), Lesė Kaunas/Vilnius (75, rinkiklis yra, trūksta susiejimo), Dryžuota laimė, Dogspotas.
2. Esamų rinkiklių papildymas pilnais gyvūno puslapiais: pirmiausia Penkta koja (240).
3. Logotipai iš prieglaudų, globok.lt nuorodų pašalinimas.
4. Likusios VMVT prieglaudos.
