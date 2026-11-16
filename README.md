# GLOBIS

Expo / React Native gyvūnų ir prieglaudų atradimo programėlė. Naudojama peržiūrima istorinė duomenų kopija, ne pažadas apie šiandienos gyvūnų prieinamumą. Gyvas Globok ir Meta importas išjungtas, kol nėra patvirtintų teisių ir pilnumo įrodymų.

## Vietinis paleidimas

Node.js >=22.13.0 (`node:sqlite`).

```sh
npm ci --no-audit --no-fund
npm test
npm run check:data
npm run web
# Visų platformų eksportas:
CI=1 npm run build
```

`npm run android` / `npm run ios` paleidžia Expo; native patikrai reikia Expo Go arba suderinto native build / įrenginio. Šio projekto CI atlieka eksportą, ne fizinio įrenginio testą.

## Funkcijos ir duomenys

- Globoti / Prieglaudos / Išsaugoti. Kortelių ir tinklelio rodiniai naudoja tuos pačius rūšies, miesto ir tik šaltinio įrodymais pagrįstos skubos filtrus.
- Braukimas dešinėn išsaugo, kairėn praleidžia; Atšaukti tiksliai grąžina paskutinę būseną. Pasirinkimai ir kalba saugomi vietoje. Perkrovimas jų neištrina; tarp įrenginių sinchronizavimo nėra.
- Profiliai ir prieglaudų sąrašai siejami pagal tikslų ID. Aktyvūs skelbimai nėra prieglaudos talpa. Rezervuoti gyvūnai rodomi prieglaudos sąraše, bet ne atradime.
- Nežinomi faktai, kontaktai ir stebėjimo laikai neišgalvojami. Dabartinė kopija neturi patikimų kontaktų ar stebėjimo laikų. Originalus šaltinis lieka pasiekiamas. Skelbimo dingimas nereiškia įvaikinimo.
- GLOBIS #245B46, #F5F8F7 ir originalūs repo logotipo failai. Naujas Router / navigacijos karkasas neįdiegtas.

Vienintelė programėlės kopija: `src/data/allPets.json` ir `src/data/shelters.json`. [Atnaujinimo politika](docs/globok-refresh.md), [ID migracija](docs/pr1-listing-id-map.json), [beta patikros ir ribos](docs/beta-check.md), [leidimo paruošimas](docs/release-readiness.md), [privatumo informacija](docs/privacy.md).

Discovery Engine yra atskiras vietinis prototipas: [adapteriai ir testai](scripts/discovery-engine/README.md). Viešo backend ar produkcinio duomenų atnaujinimo jis neįjungia.
