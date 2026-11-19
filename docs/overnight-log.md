# Naktinio darbo žurnalas

Šaka `feat/supabase-loader-cli`, PR #38. Kiekvienas įrašas: kas, commit, patikra.

## 2026-11-17

- **Supabase rinkimas** (14 žingsnis): `run.cjs` įrašo kiekvieną prieglaudą į DB, kai yra `SUPABASE_DB_URL`. `5047a68`. CI jungiasi; pirmas bandymas atmestas dėl trūkstamo `shelter_hint`, savininkas migraciją paleido 19:3x.
- **Programėlė skaito iš Supabase** (17 žingsnis): `usePets()`, įtaisyta kopija kaip atsarginė. Testas `tests/appPet.test.cjs`. 237/0.
- **CI įspėjimai** (2 žingsnis): 0 gyvūnų, nepublikuota, DB klaida. `9967874`.
- **Saugumo auditas**: `docs/security-audit.md`, 🟡.
- **Dizainas**: brainstormas `docs/design-brainstorm.md`; tik žinomi faktai profilyje, švelnesnė prieinamumo pastaba, „1 314 laukia“ (`bcf75f1`); kortelė per visą plotą su gradientu; Fraunces šriftas (`cb887ba`). Patikrinta web 390×844.
- **Automatika**: kas 10 min sesija pati tęsia darbą pagal roadmap.
- **Paskyra el. paštu** (savininko sprendimas): migracija `20261117000300_accounts_saved.sql` (RLS, ištrynimas), programėlė: kodas iš laiško, sinchronizacija, „Ištrinti paskyrą“. `2f7645d`. Laukia: migracija + Magic Link šablonas su `{{ .Token }}`.
- **Laukų pilnumas** (7 žingsnis): `scripts/scrapers/completeness.cjs`, lentelė CI santraukoje. Silpniausi: penktakoja (240, beveik tik nuotraukos), sos-gyvunai (117), siauliuletenele (186, be lyties). Kandidatai detalių puslapių skaitymui kaip Lesė.
- **Prisijungimas perdarytas** į el. paštą + slaptažodį (savininko pasirinkimas B), atkūrimas kodu iš laiško. `f23bf2c`. Laukia: migracija 0300, „Confirm email“ išjungti, min. slaptažodis 8, Reset Password šablonas su `{{ .Token }}`.
- **keturkojodraugas DB klaida**: visi gyvūnai viename puslapyje, URL dabar su `#vardas`. `069d003`.
- **Penktakoja**: puslapiuose tik vardas ir telefonas, faktų nėra. Tušti laukai teisingi, adapterio nekeičiu.
- **Nebeskelbiami išsaugoti** (5, 27 žingsniai): išsaugant įsimenama kortelė; dingęs iš šaltinio gyvūnas lieka „Išsaugoti“ su žyme „Nebeskelbiamas“ (ne „įvaikintas“). Patikrinta web.
- **Haptics** (29): lengvas atsakas išsaugant. `c0c3134`.
- **Galerija kortelėje** (25): paliesk kairę/dešinę nuotraukos pusę, viršuje juostelės; amžius atskiroje eilutėje, vardas iki 2 eilučių. Patikrinta web.
- **Rinkimas** run 44165033470: žalias, be įspėjimų (keturkojodraugas DB klaida išspręsta).
- **Šilta spalva** (dizainas 4): „Išsaugoti“ mygtukas, širdelė ir antspaudas abrikosiniai `#B85A1E` (baltas tekstas 4.6:1, AA).
- **Kortelių kaladė** (dizainas 5): po kortele matosi kitos kraštas. Patikrinta web.
- **Prieglaudų sąrašas** (26): „X laukia namų“, 3 gyvūnų nuotraukų juosta kiekvienoje kortelėje. Patikrinta web.
- **Išsaugoti galerija** (dizainas 8): jau buvo 2 stulpeliai; viena kortelė nebeišsitempia per visą plotį.
- **Išsaugoti antraštė**: prisijungus „sinchronizuojama su paskyra“.
- **Didelis šriftas** (23): etiketės ir mygtukai auga kartu su tekstu (`minHeight`), nebekerpa. Native neišbandyta.
- **Offline** (24): peržiūrėta. Be interneto rodoma įtaisyta kopija, nuotraukoms „Nuotraukos nėra“, paskyrai klaidos tekstas apie ryšį. Keisti nereikėjo.
- **Dublikatai** (6): jau tvarkoma, `mergeDirect` nerodo globok.lt kopijų prieglaudoms, kurias skaitome tiesiai.
- **LT/EN** (28): lietuviškų užrašų be vertimo nerasta.
- **Parduotuvių dokumentai**: privatumo politika LT/EN, Data Safety / App Privacy ir App Review pastabos atnaujintos dėl neprivalomos paskyros. Reikia savininko peržiūros.
- **Roadmap** atnaujintas: 19 iš 50 padaryta, dabar etapas D.

## 2026-11-18

- **ADR** (11) ir **DB limitų stebėjimas** (20): `81b809c`, roadmap pažymėtas.
- **Žodynai** (10): jau veikia. `normalize.cjs` verčia rūšį, lytį, dydį; `record.cjs` atmeta bet ką už žodyno ribų, visi adapteriai eina per jį. Veislės lauko schemoje nėra, amžius lieka tekstu (`age_text`), kaip parašyta puslapyje.
- **Kontaktų įrodymai** (8, dalis): Katino svajonė, Telšių Šuniukų namai, Rasų globa: telefonas ir el. paštas iš jų pačių svetainės, `contactEvidence` 2026-11-18. Rožinė pėdutė praleista: jos robots.txt blokuoja ClaudeBot. Liko: padekman, naminukai, mazeikiugyvunai, akesoprieglauda (kontaktų puslapyje nerasta).
- **Kontaktai** (8): baigta. Visos prieglaudos, kurių svetainėje yra kontaktai, turi `contactEvidence`; kitoms telefonas ir el. paštas lieka tušti.
- **Lesė nuorodos** (9): jau veikia. `mergeDirect` globok.lt įrašus keičia lese.lt adapterio įrašais, visos 75 nuorodos veda į lese.lt.
- **robots.txt auditas** (3, dalis): patikrinti psa, vizgis, vysniusodas. 8 svetainės nepasiekiamos (binada, grinda, vggd, makatukai, donpita, pukuotasvajone, dryzuotalaime, vggn). Rasta: Alytaus „Keturkojo viltis“ veikia adresu `keturkojo-viltis.lt` (su brūkšneliu), WP REST `gyvunas`, 185 įrašai. Kandidatas naujam adapteriui (4 žingsnis). Sąlygų puslapiai dar neperskaityti, todėl 3 žingsnis nepažymėtas.
- **Naujas adapteris** (4, dalis): Alytaus „Keturkojo viltis“ (`keturkojo-viltis.cjs`, WP REST). Gyvai: 185 gyvūnai per 6 užklausas, rūšis visiems, amžius 91, nuotraukos 181. Svetainėje statuso nėra, todėl „nežinoma“. Etiketė „Spėjama gimimo data“ dabar skaitoma kaip amžius. Testai 242/0. Programėlėje atsiras po kito CI rinkimo.
- **Naudojimo sąlygos** (35): juodraštis `docs/store/terms.lt.md` ir `terms.en.md`. GLOBIS ne prieglauda, duomenys iš prieglaudų gali būti pasenę, paskyra neprivaloma ir ištrinama programėlėje, Lietuvos teisė. Reikia savininko duomenų `[…]` ir `termsUrl` `app.json` (nuoroda Paskyroje atsiras pati).
- **Nuotraukų politika** (16): ADR `docs/adr/0002-photo-hotlink.md`, krauname tiesiai iš prieglaudų, kopijų nelaikome. Rasta klaida: 11 mažasdraugas nuotraukų buvo `http`, iOS jų nerodytų. `record.cjs` dabar to paties host `http` keičia į `https` (patikrinta: atsako 200). Programėlėje susitvarkys po kito CI rinkimo. Testai 243/0.
- **BDAR** (36): ištrynimas jau buvo; pridėta Paskyra → „Eksportuoti mano duomenis“: el. paštas, paskyros data ir išsaugoti gyvūnai JSON per telefono „Bendrinti“. Privatumo politika LT/EN atnaujinta. Testai 243/0, web build praeina. Prisijungus neišbandyta (reikia paskyros).
- **Sąlygų auditas** (3): perskaitytos visų adapterių šaltinių sąlygos. sos-gyvunai: puslapis „Informacija ruošiama“; bukmanodraugas, mgma, keturkojo-viltis, siauliuletenele: sąlygų nėra. **Maži jausmai** sąlygos draudžia komercinį naudojimą ir laikyti turinį serveriuose, todėl adapteris pristabdytas (`index.cjs`), failas ir testas palikti. Testai 243/0.
- **Naujas adapteris** (4, dalis): Mažeikių gyvūnų globos draugija (`mazeikiugyvunai.cjs`). Svetainė skaito savo viešą API, imame tik „adoptable“. Gyvai: 97 gyvūnai per 6 užklausas, rūšis, lytis, gimimo data ir nuotrauka visiems. Kur gyvūnas rastas, neskaitome. Testai 244/0. Programėlėje po kito CI rinkimo.
- **Nauji adapteriai** (4): baigta. Iš 46 šaltinių 19 turi adapterį; kiti be gyvūnų sąrašo (13), nepasiekiami (9), kitoje gijoje (lietuvagyvunams), užblokuoti robots ar laukia sutikimo (linksmauodegele, rasugloba), pristabdyti (mazijausmai dėl sąlygų, akeso: svetainė „atnaujinama“, REST atsako, bet neskaitome, kol paslėpta).
- **Sveikatos faktai iš aprašymo** (prioritetas 1): `fromProse` skaito aiškiai parašytus žodžius („kastruotas, skiepytas, ženklintas“); planai („bus sterilizuota“) ir prieštaravimai lieka nežinomi, lentelės reikšmė svarbesnė. sos-gyvunai čipas/skiepai/kastracija 0→74 %, siauliuletenele 0→12–15 %, naminukai čipas 0→23 %. penktakoja: svetainėje faktų nėra (tik vardas ir telefonas). Testai 247/0. Programėlėje po kito CI rinkimo.
- **Linksmosios pėdutės**: dabar skaitomas kiekvieno gyvūno puslapis (53 užklausos, kešas). Gyvai: amžius (gimimo data) 0→100 %, skiepai 0→98 %, čipas 0→98 %, kastracija 0→81 %. Lyties ir dydžio svetainėje nėra. Aprašymo tekstas nekopijuojamas (svetainė leidžia tik nuorodą). Testai 247/0.
- **Utenos gyvūnų globa (gyvunugloba)**: skaitomas kiekvieno gyvūno puslapis (42 užklausos). Gyvai: aprašymas 0→84 %, kastracija 0→16 % (iš teksto). Paramos blokas (sąskaita, PayPal) ir anketos tekstas nukerpami. Lyties, amžiaus, skiepų puslapiuose atskirai nėra. Testai 247/0.
- **Tautmilės globa**: skaitomas kiekvieno gyvūno puslapis (lentelė ir aprašymas, 21 užklausa). Gyvai: rūšis, lytis, amžius, dydis, kastracija 0→100 %, aprašymas 0→79 %. Telefonai ir darbuotojų vardai iš aprašymo nukerpami. Bendrai: „Ūgio kategorija“ ir „Mažas (iki 30cm)“ dabar atpažįstami kaip dydis visiems adapteriams. Testai 249/0.
- **SOS gyvūnai**: svetainė perkėlė „Katės“/„Šunys“ po nauja kategorija „Visi gyvūnai“, todėl rūšis buvo dingusi. Dabar kategorijų gylis nesvarbus. Gyvai: rūšis 0→99 %, amžiaus grupė 22→98 % (čipas/skiepai/kastracija 74 % iš aprašymo). Testai 250/0.
- **Katino svajonė**: rūšis 0→100 % („Apie mus“: prieglauda priima tik kates, 175 sąrašo puslapiuose šunų nėra; puslapio „Rūšis“ etiketė vis tiek svarbesnė). Aprašymo, skiepų, čipo svetainėje nėra. Gyvai perpaleista nebuvo (crawl-delay 10 s), skaičiuota iš paskutinio gyvo paleidimo. Testai 250/0.
- **Rožinė pėdutė**: skaitomas kiekvieno gyvūno puslapis (lentelė ir aprašymas, 19 užklausų; robots.txt GlobisBot leidžia). Gyvai: gimimo data, skiepai, čipas, kastracija 0→100 %, aprašymas 0→41 %. Rūšies svetainėje nėra. Bendrai: etiketės „Ženklinta mikrochema“, „Skiepų informacija“ ir reikšmė „Vakcinuota“ atpažįstamos visiems. kggn ir bukmanodraugas patikrinti: daugiau faktų puslapiuose nėra. Testai 252/0.
- **Lytis „Moteriška/Vyriška“** (bendra): `N.sex` dabar supranta ir padekman rašybos klaidą „Motiriška“. Padėk man gyvai: lytis 76→89 %. Skiepai 23 % lieka: kitų puslapiuose tokios eilutės nėra. Mažeikių API, keturkojo-viltis, mgma, mazasdraugas, siauliuletenele: lyties ir medicinos laukų šaltiniuose nėra (tik pasakojimas). Testai 253/0.
- **Programėlė**: profilis jau rodo aprašymą, lytį, amžių, dydį, čipą, skiepus, kastraciją. Nauji skreiperių laukai į programėlę pateks tik po rinkimo su šios šakos kodu: kasdienis 04:07 rinkimas naudoja `main` kodą.
- **Pilnas gyvas patikrinimas** (2026-11-18 vakare): visi 19 šaltinių `complete`, 1402 gyvūnai, procentai žemiau. Kur liko 0 %, to svetainė nenurodo (patikrinta po vieną puslapį).

| šaltinis | gyvūnų | rūšis | lytis | amžius | dydis | čipas | skiepai | kastr. | aprašymas |
|---|---|---|---|---|---|---|---|---|---|
| sos-gyvunai | 117 | 99 | 0 | 98 | 0 | 74 | 74 | 74 | 100 |
| mgma | 19 | 100 | 0 | 84 | 0 | 79 | 84 | 79 | 100 |
| keturkojodraugas | 28 | 100 | 100 | 100 | 0 | 75 | 75 | 100 | 100 |
| kggn | 41 | 100 | 98 | 98 | 0 | 0 | 0 | 0 | 71 |
| bukmanodraugas | 41 | 100 | 0 | 0 | 0 | 2 | 0 | 2 | 100 |
| penktakoja | 253 | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| siauliuletenele | 208 | 100 | 0 | 95 | 0 | 14 | 13 | 13 | 100 |
| mazasdraugas | 36 | 100 | 0 | 100 | 0 | 97 | 97 | 92 | 100 |
| tautmilesgloba | 19 | 100 | 100 | 100 | 100 | 0 | 0 | 100 | 79 |
| rozinepedute | 17 | 0 | 100 | 100 | 0 | 100 | 100 | 100 | 41 |
| linksmosiospedutes | 53 | 100 | 0 | 100 | 11 | 98 | 98 | 81 | 0 |
| katinosvajone | 40 | 100 | 100 | 100 | 0 | 0 | 0 | 100 | 0 |
| lese | 75 | 100 | 100 | 100 | 83 | 0 | 100 | 100 | 100 |
| naminukai | 22 | 100 | 100 | 100 | 100 | 23 | 23 | 100 | 100 |
| gyvunugloba | 37 | 100 | 0 | 0 | 0 | 0 | 0 | 16 | 81 |
| keturkojo-viltis | 184 | 100 | 0 | 49 | 0 | 43 | 41 | 42 | 100 |
| mazeikiugyvunai | 97 | 100 | 100 | 100 | 0 | 0 | 0 | 0 | 1 |
| beglobis | 27 | 100 | 100 | 100 | 0 | 30 | 74 | 41 | 100 |
| padekman | 88 | 99 | 89 | 95 | 0 | 61 | 23 | 94 | 94 |
- **Gimimo data iš aprašymo** (bendra): `fromProse` randa „Gimimo data (spėjama): 2012-01-01“, „Spėjama gimimo data – …“, „Gimęs 2021“ teksto viduryje; kelios skirtingos datos → nežinoma, atvykimo data neimama. Keturkojo viltis gyvai: amžius 49→98 %. Testai 255/0.
- **Amžius iš aprašymo** (bendra): „4 m. amžiaus“, „Apie dešimties metų amžiaus“, „~2018 m. gimimo“. Jei tekste minimi keli amžiai (mama ir jaunikliai), laukas lieka tuščias. Gyvai: gyvunugloba amžius 0→8 %, mgma 84→89 %. Lytis iš pasakojimų neimama: per dažnai keli gyvūnai viename tekste. Testai 257/0.
- **Profilis** (programėlė): lytis ir dydis rodomi žodžiais („Patelė“, „Mažas“), ne kodais („female“, „small“). Data be žodžių („2018 10 14“, „Spėjama gimimo data: …“) rodoma kaip „Gimimo data“, ne „Amžius“. Anglų kalba vietoj „Nenurodyta“ rodomas prieglaudos lietuviškas aprašymas ir amžius. Patikrinta naršyklėje, testai 259/0, web build praeina.

## 2026-11-19

- **Linksmosios pėdutės, dydis** (bendras `N.size`): „Nedidukas“, „Mažutė“, „Mažulytė“ → mažas; „Vidutinio ūgio“ → vidutinis; „Didelis vyrukas“, „Labai didelis“, „Gana didelė“, „Dičkis“ → didelis. „Nemažas“ ir vien svoris lieka nežinomi. Gyvai: dydis 11→32 % (kiti puslapiai DYDIS neturi). Aprašymų ten nėra: tik faktų eilutės ir paramos tekstas. Testai 264/0.
- **Lesės logotipas** (Kaunas, Vilnius): imamas iš lese.lt (robots leidžia). Logotipas baltas, todėl rodomas ant Lesės oranžinės `#e87e04` (laukas `logoBg`). Dabar logotipą turi visos 24 programėlėje rodomos prieglaudos. Patikrinta naršyklėje. Kiti 23 logotipai vis dar imami iš globok.lt. Testai 264/0.
- **Prieglaudų logotipai iš jų pačių svetainių**: 15 prieglaudų logotipas dabar imamas iš jų svetainės, ne iš globok.lt. Kur apvali svetainės ikona aiškesnė, imta ji. Visi patikrinti akimi ir programėlėje, neveikiančių 0. Globok.lt liko 8: 5 be svetainės adreso, o Maži jausmai, Rasų globa ir Linksma uodegėlė laukia sutikimo.
- **Dar 3 logotipai iš pačių prieglaudų**: Padėk man, Naminukai (svetainės ikona), Rožinė pėdutė (logotipas). Mažeikiai turi tik `favicon.ico`, o iOS jo nerodo, todėl paliktas globok.lt. Globok.lt liko 5 logotipai. Testai 264/0.
- **Kryžminė patikra su globok.lt** (`scripts/crosscheck/globok.cjs`, savininko idėja): po 5 gyvūnus iš 17 prieglaudų (81 globok puslapis, 5 s tarpai, į programėlę nieko nepatenka). Rūšis ir lytis visur sutampa. 8 neatitikimai, visi dėl kastracijos ar skiepų: Naminukai 3, Lesė Vilnius 5. Patikrinti du prieglaudų puslapiai (Torūnė „KASTRACIJA: Neatlikta“, Arija „Sterilizacija: ne“): teisūs mes, klysta globok. „Tik globok“ (vardas nerastas pas mus, pvz. Lesė Vilnius 11, Linksmosios pėdutės 10) dar neperžiūrėta: gali būti pervadinti, įvaikinti arba praleisti. Testai 266/0.
- **„Tik globok“ peržiūra**: Linksmosios pėdutės 10 iš 10 gyvūnų jų svetainėje yra „Rado namus“ sąraše. Lesė Vilnius: Gamla lese.lt pažymėta „Rado namus“, 9 kiti mūsų paskutinėje kopijoje nerasti. Iš visų 11 tik Cilka yra mūsų surinktuose duomenyse, bet programėlės kopijoje ji nepriskirta Vilniui. Patikrinta: `src/data/allPets.json` yra senas globok.lt importas be `shelterHint` lauko; Lesė skreiperis Cilkos puslapį lese.lt skaito teisingai (`shelterHint: vilnius`), o hint keliauja iki `shelter_hint` Supabase ir `appPet.cjs`. Išvada: globok.lt rodo įvaikintus gyvūnus kaip laukiančius, o mūsų skreiperiai jų nerodo.
- **Likę tarpai patikrinti** (prioritetas 1): Lesė čipas (Cilkos puslapyje eilutės nėra), Tautmilės čipas/skiepai (puslapyje nėra), Mažeikių API (tik rūšis, lytis, gimimo data, veislė, spalva; aprašymas 1 iš 20, sveikatos laukų nėra). Kartu su ankstesniais patikrinimais: visų adapterių puslapiuose nurodyti faktai jau skaitomi, 0 % lieka ten, kur svetainė jų neturi. `completeness.cjs` be argumento skaito seną `directPets.json`; tikri skaičiai yra 2026-11-18 lentelėje.
- **Rožinė pėdutė perpaleista** (pilno paleidimo `published:false` patikra): dabar sąrašo užklausa sako 17 gyvūnų, puslapyje 17 kortelių, paleidimas `complete`, `published:true`, 19 užklausų. Ankstesnis neatitikimas buvo laikinas (gyvūnas pridėtas ar išimtas paleidimo metu), kodo keisti nereikia. Pilnumas nepasikeitė: lytis, amžius, čipas, skiepai, kastracija 100 %, aprašymas 41 %, rūšis ir dydis 0 % (svetainė nenurodo).
- **Nuotraukų dublikatai** (A6): 1061 įraše 0 to paties vaizdo dydžio variantų (`-768x1024`, `-scaled`); 19 nuotraukų kartojasi tarp gyvūnų, visos Šiaulių letenėlės įrašuose, kur kartu nufotografuoti broliai ar poros (tikros, ne pakaitinės). Turinio hash reikalautų atsisiųsti kiekvieną nuotrauką iš prieglaudų svetainių; nedaroma, kol nėra rasto dublikato. Kelio žemėlapyje 6 pažymėtas.
- **Rožinė pėdutė kontaktai** (A8): anksčiau praleista dėl ClaudeBot draudimo, bet robots.txt GlobisBot leidžia. Iš `rozinepedute.lt/kontaktai/`: el. paštas `info@rozinepedute.lt`, svetainė, `contactEvidence` 2026-11-19. Telefonas paliktas tuščias: puslapis rašo, kad jis „naudojamas TIK siuntoms“. Įrodymai 20→21 iš 37. Testai 266/0.
- **Loaderio lygiagretumas ir nesėkmės** (B14): kasdienis rinkimas ir vienos prieglaudos rinkimas yra skirtingose CI `concurrency` grupėse, todėl gali tą pačią prieglaudą publikuoti vienu metu ir abu palyginti su ta pačia ankstesne kopija. `supabase-load.cjs` dabar prieš skaitydamas ankstesnę kopiją užrakina prieglaudą (`pg_advisory_xact_lock`, be migracijos). Nauji testai: DB klaida įkėlimo viduryje nepalieka dalinio paleidimo, paskutinė gera kopija lieka; užraktas imamas prieš skaitymą. Testai 268/0. Gyvoje DB nepatikrinta.
- **Viešas view ir programėlė** (B15): naujas testas įkelia kggn rinkimą į DB, skaito `published_animals` kaip `anon` ir per `fromRemote` gauna tuos pačius 3 gyvūnus su tais pačiais laukais (aprašymas, lytis, amžius, sveikata, nuotraukos, būsena), kaip įpakuotas kelias. Vienintelis skirtumas: `sourceUpdatedAt` DB nesaugomas. Testai 269/0. Gyvame Supabase nepatikrinta.
- **Serverio skaitymas** (B17): `fetchPublished` baigdavo, kai puslapis trumpesnis nei 1000; jei Supabase `max-rows` mažesnis, programėlė gautų tik dalį gyvūnų ir jais pakeistų įpakuotą kopiją. Dabar skaitoma su `limit/offset`, kol puslapis tuščias; bet kokia klaida palieka įpakuotą kopiją. Logika perkelta į `appPet.cjs` ir patikrinta testu. Testai 270/0. Programėlėje (Expo) nepaleista.
- **Serverio skaitymas gyvai** (B17 patikra): programėlė naršyklėje (Expo web) skaito gyvą Supabase: 3 užklausos (`offset` 0, 1000, 1156), gauta 1156 eilučių, paskutinis tuščias puslapis baigia ciklą, konsolėje klaidų nėra. Pastaba savininkui: įpakuotoje globok.lt kopijoje vis dar rodomos „Maži jausmai“ nuotraukos, nors jų sąlygos draudžia naudoti turinį.
- **Gyva DB ir Maži jausmai**: gyvame Supabase visos kopijos dar 2026-11-18 11:xx (senas kodas), todėl nauji laukai (pvz. linksmosiospedutes, tautmilesgloba, rozinepedute, sos-gyvunai 0 %) programėlėje atsiras tik po savininko CI rinkimo. Ten pat dar publikuota 36 „Maži jausmai“ gyvūnų, nors jų sąlygos draudžia naudoti turinį, o `allPets.json` turi 36 jų globok.lt kopijas. Programėlė dabar jų nerodo (`withoutBlocked` bendrame `build` kelyje): 1327→1291. DB kopiją nuimti vis tiek turi savininkas. Testai 271/0.

## Laukia savininko

- Palaikymo el. paštas, privatumo politikos URL, bundle id, Apple Developer paskyra.
- Demo paskyra App Review'ui; ištrynimo nuoroda internete (Google Play reikalauja).
- Privatumo politikos ir naudojimo sąlygų peržiūra ir paskelbimas (`privacyPolicyUrl`, `termsUrl`).
- Maži jausmai: paprašyti raštiško leidimo arba palikti išjungtą. Iš programėlės įtaisytos kopijos jų įrašai pašalinti. Supabase jų paskutinė publikuota kopija lieka matoma (`published_animals` yra view); ją reikia nuimti duomenų bazėje.
- Paleisti „Daily shelter collect“ iš šakos `feat/supabase-loader-cli` (Actions → Run workflow) arba sujungti PR #38, kad nauji gyvūnų laukai (aprašymai, skiepai, čipas, lytis) atsirastų programėlėje. Autopilotas to padaryti negalėjo: leidimas atmestas.

- **Atsarginės kopijos** (19 žingsnis): `.github/workflows/db-backup.yml` kasdien 03:37 UTC daro `pg_dump` (`public` schema ir `auth.users` eilutės), užšifruoja AES256, patikrina, kad atsidaro, ir laiko 14 dienų Actions artifacts. Šifruojama, nes repo viešas. Veiks, kai savininkas pridės secret `BACKUP_PASSPHRASE`; kol nėra, praleidžia su įspėjimu. Atkūrimas: [backup-restore.md](backup-restore.md). Klaidų stebėjimas: nepavykęs suplanuotas darbas GitHub siunčia laišką. Gyvai nepaleista: be secret.
- **Dydis iš aprašymo** (bendra): „vidutinio ūgio“, „mažo dydžio“, „nedidelio ūgio“ → dydis; „didelio šuns“ be „ūgio/dydžio“ neimama, du skirtingi dydžiai → nežinoma. Gyvai: bukmanodraugas 0→7 %, mazasdraugas 0→14 %; iš paskutinės kopijos beglobis 0→7 %, sos-gyvunai 0→3 %, siauliuletenele 0→1 %. Testai 260/0.
