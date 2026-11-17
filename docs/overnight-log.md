# Naktinio darbo žurnalas

Šaka `feat/supabase-loader-cli`, PR #38. Kiekvienas įrašas: kas, commit, patikra.

## 2026-11-17

- **Supabase rinkimas** (14 žingsnis): `run.cjs` įrašo kiekvieną prieglaudą į DB, kai yra `SUPABASE_DB_URL`. `5047a68`. CI jungiasi; pirmas bandymas atmestas dėl trūkstamo `shelter_hint`, savininkas migraciją paleido 19:3x.
- **Programėlė skaito iš Supabase** (17 žingsnis): `usePets()`, įtaisyta kopija kaip atsarginė. Testas `tests/appPet.test.cjs`. 237/0.
- **CI įspėjimai** (2 žingsnis): 0 gyvūnų, nepublikuota, DB klaida. `9967874`.
- **Saugumo auditas**: `docs/security-audit.md`, 🟡.
- **Dizainas**: brainstormas `docs/design-brainstorm.md`; tik žinomi faktai profilyje, švelnesnė prieinamumo pastaba, „1 314 laukia“ (`bcf75f1`); kortelė per visą plotą su gradientu; Fraunces šriftas (`cb887ba`). Patikrinta web 390×844.
- **Automatika**: kas 10 min sesija pati tęsia darbą pagal roadmap.

## Laukia savininko

- Palaikymo el. paštas, privatumo politikos URL, bundle id, Apple Developer paskyra.
