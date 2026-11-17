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

## Laukia savininko

- Palaikymo el. paštas, privatumo politikos URL, bundle id, Apple Developer paskyra.
