# Globok atnaujinimo būsena

PR #3 pateikia išvalytą, peržiūrimą duomenų kopiją. Joje yra 937 gyvūnai, 37 organizacijos ir 4 aiškiai rezervuoti skelbimai. Tai repozitorijos momentinės kopijos skaičiai. Nėra patvirtinimo, kad jie apibūdina šiandienos katalogą.

Gyva prieiga ir pakartotinio nuskaitymo pilnumas nepatvirtinti. `scripts/scrape-globok.js` baigiasi klaida prieš tinklo ar įrašymo operacijas. Naujas `update-pets.yml` yra tik skaitymo CI, be grafiko, įrašymo teisių ir PR kūrimo. Suplanuotą importą iš `main` pašalino PR #14.

## Pilnumo patikra

Adapteris pateikia kiekvieno puslapio faktinį stebėjimo laiką `observedAt` milisekundėmis nuo Unix epochos. Validatorius atmeta trūkstamą, netinkamą arba būsimą laiką ir prideda puslapio stebėjimo laiką UTC formatu prie kiekvieno jo skelbimo, išsaugodamas originalų URL. Pakartotinė patikra stebėjimo laiko nekeičia.

`validateCatalog` priima jau išanalizuotus puslapių paketus. Būsimas adapteris turi pateikti iš šaltinio patikimai gautą vienos nuoseklios katalogo versijos žymą, bendrą įrašų skaičių, puslapio numerį, puslapio dydį ir kitą puslapį arba aiškų pabaigos žymeklį. Šių laukų negalima išvesti iš rastų HTML kortelių kiekio. Kol Globok tokių įrodymų nėra, sintetiniai testai tikrina kontraktą, o ne gyvą HTML.

Atmetami nepilni, pakartoti ar nesuderinti puslapiai, tinklo klaidos, dubliuoti URL net su kitais query parametrais, ID neatitikimai, nežinomos organizacijos ir daugiau nei 5 % ankstesnio rinkinio ID netektis. Prieigos sprendimas turi būti konkrečiam šaltiniui, pagrįstas ir vis dar galiojantis. Validatorius grąžina peržiūros duomenis ir nerašo į programėlės failus. Skelbimo dingimas nesukuria įvaikinimo būsenos.

## Rankinis kelias

Patvirtinus konkretaus šaltinio gavimo ir pakartotinio naudojimo teises, paruošti vietinį paketą iš patvirtinto eksporto arba atskirai patvirtinto adapterio. Patikrinti kilmę, pilnumą, įrašų skaičių ir skirtumus su paskutine kopija. Perkelti tik patikrintus pakeitimus į `src/data/` atskiroje šakoje, paleisti README nurodytas patikras ir rankiniu būdu atidaryti PR į `main`. Reikia žmogaus peržiūros prieš sujungimą.

GitHub Actions teisė automatizuotai kurti PR šiame etape nepatikrinta. Jei vėliau patvirtinamas automatinis kelias, `contents: write` ir `pull-requests: write` suteikti tik apsaugotam pasiūlymo darbui iš patikimos numatytosios šakos. Esamas fork PR CI lieka tik skaitymo. Pasiūlymo darbui naudoti atskirą šaką ir žmogaus peržiūrą. Kol organizacijos politika neleidžia Actions kurti PR, naudoti rankinį kelią.

## Patikros ir likę aktyvavimo blokatoriai

Naudoti Node.js >=22.13.0 (`node:sqlite`), `npm test`, `npm run check:data` ir po `npm ci` – `CI=1 npm run build`. CI vykdo testus su Node 22.13.0, 24 ir 26 bei visų Expo platformų eksportą. Migracijos pakartojimas išlaiko išvalytus įrašus ir jų rezervavimo įrodymus; nežinomos būsenos netampa įvaikinimu.

- **Globok prieiga ir pilnumas:** nėra patvirtinto duomenų gavimo / naudojimo leidimo ar gyvo katalogo pilnumo įrodymo. Sintetinio paketo `approved` nėra realaus šaltinio leidimas. Gyvas transportas lieka išjungtas; šio PR saugių duomenų ir UI pataisų peržiūrai jis nereikalingas.
- **Automatinio PR teisės:** 2026-11-16 patikrinimas `GET /repos/nojusdr-lab/globis/actions/permissions/workflow` grąžino `403 Resource not accessible by integration`. Turima GitHub integracija negali perskaityti šios politikos. Tai neįrodo, kad pati Actions politika draudžia PR; sėkmingas interaktyvus šakos publikavimas taip pat neįrodo `GITHUB_TOKEN` galimybių. Automatiniam keliui reikia atskiro patvirtinimo ir realaus patikrinimo po prieigos / pilnumo patvirtinimo. Dabartinis CI nerašo į repo ir PR nekuria, todėl jam `contents: write` / `pull-requests: write` nesuteikiamos.
- **Būsimo pasiūlymo darbo ribos:** tik rankinis paleidimas iš patikimos numatytosios šakos tame pačiame repo; atmesti fork ir kitas šakas; rašymo teises suteikti tik pasiūlymo darbui; naudoti atskirą duomenų šaką, be force-push į numatytąją šaką ir be automatinio merge. Leidimo ar PR kūrimo klaida turi aiškiai sustabdyti darbą, palikti ankstesnę kopiją ir nukreipti į rankinį kelią.
