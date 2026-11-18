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

## Laukia savininko

- Palaikymo el. paštas, privatumo politikos URL, bundle id, Apple Developer paskyra.
- Demo paskyra App Review'ui; ištrynimo nuoroda internete (Google Play reikalauja).
- Privatumo politikos ir naudojimo sąlygų peržiūra ir paskelbimas (`privacyPolicyUrl`, `termsUrl`).
- Maži jausmai: paprašyti raštiško leidimo arba palikti išjungtą. Iš programėlės įtaisytos kopijos jų įrašai pašalinti. Supabase jų paskutinė publikuota kopija lieka matoma (`published_animals` yra view); ją reikia nuimti duomenų bazėje.
