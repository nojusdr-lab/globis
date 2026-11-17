# GLOBIS: 2026-11-17 pažangos ir rizikų peržiūra

Peržiūros pagrindas: `main` ties [5fbb24c](https://github.com/nojusdr-lab/globis/commit/5fbb24c65c4d2c6348bdcfe23f918bddf5ab1f58), atviras PR #31 ties `e9e03f4` ir PR #35 ties `6de8813`. Tai tikslinis programėlės duomenų, duomenų bazės schemos ir planuojamo rinkimo auditas, be gamybinio diegimo ar duomenų rinkimo.

## Kas jau įjungta į `main`

- [#26](https://github.com/nojusdr-lab/globis/pull/26), [#27](https://github.com/nojusdr-lab/globis/pull/27): Supabase schema su paskelbimo patikromis ir senų failų tvarkymas. Programėlė tebenaudoja vietinį JSON, todėl schema dar nereiškia gyvo duomenų atnaujinimo.
- [#28](https://github.com/nojusdr-lab/globis/pull/28), [#32](https://github.com/nojusdr-lab/globis/pull/32): Expo programėlėje yra kortelės ir tinklelis, paieška, filtrai, profiliai, prieglaudų sąrašas, vietiniai išsaugojimai, veiksmo atšaukimas, LT / EN ir prieinamumo pataisos.
- [#29](https://github.com/nojusdr-lab/globis/pull/29): vieno šaltinio („Lietuva gyvūnams“) adapteris rankinei peržiūrai. Jis nerašo į programėlės duomenis.
- [#30](https://github.com/nojusdr-lab/globis/pull/30): parduotuvių ikonų, konfigūracijos ir aprašymų ruošiniai. Žr. [pateikimo patikrą](../store/preflight.md).
- [#33](https://github.com/nojusdr-lab/globis/pull/33), [#34](https://github.com/nojusdr-lab/globis/pull/34): 17 iš 37 prieglaudų įrašų turi telefono ar el. pašto duomenis su nuoroda į tos prieglaudos puslapį. 778 iš 937 skelbimų susieti su bent vieną tokį kontaktą turinčia prieglauda. Dabartinės skelbimų būsenos: 933 nežinomos, 4 rezervuoti. Tai vietinio rinkinio skaičiai, ne šiandienos skelbimų patikra.

## Kas dar blokuoja leidimą

| Prioritetas | Kur rasta | Ką padaryti |
| --- | --- | --- |
| P0 | [#31](https://github.com/nojusdr-lab/globis/pull/31), `.github/workflows/shelter-scrapers.yml` | PR gali paleisti svetainių patikrą su repozitorijos rašymo teisėmis ir įkelti žalią HTML ar ataskaitas į šaką. Tikrinti PR su vietiniais testų pavyzdžiais ir skaitymo teisėmis. Išimti laikinas išvestis iš pakeitimų; autorizuotą gyvą peržiūrą paleisti rankiniu būdu, su ribota prieiga ir saugojimo trukme. Klaidos kodas turi būti išsaugotas, o ne paslėptas naudojant `|| true`. |
| P0 | [#31](https://github.com/nojusdr-lab/globis/pull/31), `supabase/migrations/20261117000000_publish_guard_small_sources.sql` | Vieno paleidimo užraktas nesuderina dviejų to paties šaltinio paleidimų. Prieš automatizuojant publikavimą, užrakinti šaltinį, atmesti senesnio paleidimo publikavimą ir užtikrinti, kad pakartotas kvietimas nekeistų jau paskelbto vaizdo. Testuoti senesnį, pakartotą ir lygiagrečius paleidimus. |
| P0 | [Pateikimo patikra](../store/preflight.md), `src/data/allPets.json`, `app.json` | Atskirai patikrinti turinio ir nuotraukų naudojimo leidimus kiekvienam šaltiniui. Reikia viešos privatumo politikos, palaikymo kontakto ir patikros įrenginiuose. Svetainės techninis pasiekiamumas ar `robots.txt` leidimas savaime nesuteikia turinio naudojimo teisių. |
| P1 | [#35](https://github.com/nojusdr-lab/globis/pull/35), `scripts/discovery-engine/wp-rest.cjs` | Du nauji WordPress adapteriai skirti peržiūrai. Prieš naudojant gyvai: sustabdyti netikėtus peradresavimus, tinkamai taikyti konkrečiam robotui skirtas `robots.txt` taisykles, užfiksuoti bendrą puslapių skaičių ir tikrinti kiekvieno puslapio dydį. Panašią patikrą taikyti ir #29 adapteriui. |

## Šio PR pataisos

- `src/data/integrity.cjs`: duomenų bazės būsenos `no_longer_listed` ir `confirmed_adopted` neberodomos tarp siūlomų skelbimų ir jų negalima naujai išsaugoti. Dingimas iš šaltinio nelaikomas įvaikinimu.
- `src/data/pets.js` ir `scripts/migrate-legacy-data.cjs`: tiesioginiam kontaktui reikia tinkamos datos ir HTTPS įrodymo iš to paties oficialios svetainės adreso. Skelbimo kopija negali suteikti kontakto, kai trūksta centrinio prieglaudos įrašo. Patikra apsaugo duomenų formatą ir kilmės nuorodą; ji iš naujo netikrina svetainės turinio.
- `supabase/migrations/20261117000100_gate_public_listing_identities.sql`: nepaskelbto skelbimo ID, šaltinio nuoroda ir istorija nepasiekiami viešiems vaidmenims. Lankytojai gali skaityti jau paskelbtų skelbimų leidžiamą istoriją. Tai nauja migracija repozitorijoje, duomenų bazėje ji nepritaikyta.

Vietinė patikra: `npm test` (65 testai) ir `npm run build` (Expo paketai iOS, Android ir žiniatinkliui). Programėlė dar nepatikrinta fiziniuose įrenginiuose.
