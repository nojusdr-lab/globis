# Globok atnaujinimo būsena

PR #3 pateikia išvalytą, peržiūrimą duomenų kopiją. Joje yra 937 gyvūnai, 37 organizacijos ir 4 aiškiai rezervuoti skelbimai. Tai repozitorijos momentinės kopijos skaičiai. Nėra patvirtinimo, kad jie apibūdina šiandienos katalogą.

Gyva prieiga ir pakartotinio nuskaitymo pilnumas nepatvirtinti. `scripts/scrape-globok.js` baigiasi klaida prieš tinklo ar įrašymo operacijas. Naujas `update-pets.yml` yra tik skaitymo CI, be grafiko, įrašymo teisių ir PR kūrimo. Istorinė suplanuota darbo eiga tebėra `main` iki šio PR sujungimo arba kol savininkas ją išjungia GitHub Actions.

## Pilnumo patikra

`validateCatalog` priima jau išanalizuotus puslapių paketus. Būsimas adapteris turi pateikti iš šaltinio patikimai gautą vienos nuoseklios katalogo versijos žymą, bendrą įrašų skaičių, puslapio numerį, puslapio dydį ir kitą puslapį arba aiškų pabaigos žymeklį. Šių laukų negalima išvesti iš rastų HTML kortelių kiekio. Kol Globok tokių įrodymų nėra, sintetiniai testai tikrina kontraktą, o ne gyvą HTML.

Atmetami nepilni, pakartoti ar nesuderinti puslapiai, tinklo klaidos, dubliuoti URL net su kitais query parametrais, ID neatitikimai, nežinomos organizacijos ir daugiau nei 5 % ankstesnio rinkinio ID netektis. Prieigos sprendimas turi būti konkrečiam šaltiniui, pagrįstas ir vis dar galiojantis. Validatorius grąžina peržiūros duomenis ir nerašo į programėlės failus. Skelbimo dingimas nesukuria įvaikinimo būsenos.

## Rankinis kelias

Patvirtinus konkretaus šaltinio gavimo ir pakartotinio naudojimo teises, paruošti vietinį paketą iš patvirtinto eksporto arba atskirai patvirtinto adapterio. Patikrinti kilmę, pilnumą, įrašų skaičių ir skirtumus su paskutine kopija. Perkelti tik patikrintus pakeitimus į `src/data/` atskiroje šakoje, paleisti README nurodytas patikras ir rankiniu būdu atidaryti PR į `main`. Reikia žmogaus peržiūros prieš sujungimą.

GitHub Actions teisė automatizuotai kurti PR šiame etape nepatikrinta. Jei vėliau patvirtinamas automatinis kelias, `contents: write` ir `pull-requests: write` suteikti tik apsaugotam pasiūlymo darbui iš patikimos numatytosios šakos. Esamas fork PR CI lieka tik skaitymo. Pasiūlymo darbui naudoti atskirą šaką ir žmogaus peržiūrą. Kol organizacijos politika neleidžia Actions kurti PR, naudoti rankinį kelią.
