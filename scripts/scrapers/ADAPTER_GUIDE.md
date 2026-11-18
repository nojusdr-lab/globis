# Kaip rašyti prieglaudos adapterį

Vienas failas vienai svetainei: `adapters/<id>.cjs`. `id` toks pat kaip `sources.json`.

## Prieš rašant
1. Perskaityk tikrą `robots.txt` (`probe-output/<id>/index.json`). Jei draudžia mūsų puslapius: adapterio nerašyk, `sources.json` → `"decision": "blocked"` ir priežastis.
2. Perskaityk taisykles ar privatumo politiką, jei yra. Jei draudžia automatinį rinkimą ar turinio naudojimą: `blocked`.
3. Jei svetainėje nėra gyvūnų sąrašo (tik Facebook, tik ataskaitos): `no_listing`.

## Adapterio forma
```js
module.exports = {
  id, name, website, hosts: ['example.lt', 'www.example.lt'],
  async collect({ fetcher, cache, log }) {
    // fetcher.get(url) / fetcher.getJson(url): robots, lėtas tempas ir apsaugos jau viduje
    return { animals: [...], skipped: [{ nativeId, reason }], complete: true };
  },
};
```
Gyvūno laukai: `nativeId` (stabilus: WP id arba slug), `sourceUrl`, `name`, `species`, `sex`, `age_text`, `size`, `vaccinated`, `neutered`, `chipped`, `photos`, `bio_lt`, `status`, `statusEvidence`, `sourceUpdatedAt`.

## Taisyklės
- Tik tai, kas parašyta puslapyje. Nėra = `null`. Neišvedinėk lyties iš vardo, rūšies iš nuotraukos, amžiaus iš „mažylis“.
- Statusas per `normalize.status(tekstas)`. `reserved`/`confirmed_adopted` būtinai su `statusEvidence`. `excluded` (grįžo namo, mirė, dingo) į `skipped`.
- WordPress su atviru REST tipu: naudok `createWordpressAdapter` (žr. `kggn.cjs`).
- HTML: `lib/html.cjs` (cheerio), etikečių poros per `labels.fromPairs`.
- Puslapiavimas: eik iki galo. Jei nepasiekei galo (limitas), `complete: false`.
- Kiekvienas `fetcher.get` klaidos atveju meta išimtį. Negaudyk jų tyliai: geriau nepavykęs rinkinys nei dalinis.
- Detalių puslapius skaityk tik jei sąraše trūksta faktų. Kiekviena užklausa = ≥5 s.
- Nekopijuok telefonų, el. paštų, savanorių vardų. Aprašymą (`bio_lt`) karkasas išvalo, bet nekelk kontaktų blokų į jį.

## Testai
`tests/<id>.test.cjs` su `fixtures/<id>/` (tikri, apkarpyti puslapiai iš `probe-output`, be kontaktų). Patikrink: laukai, nežinomi = null, statusai su įrodymu, puslapiavimas, klaida → `failed`.

## Trumpa peržiūra

Patikrinęs vieno šaltinio prieigos ir turinio naudojimo sąlygas, paleisk
`npm run scrape:preview -- kggn` (arba kitą įjungto adapterio ID).
Komanda pateikia tik skaičius ir iki trijų trumpų klaidų. Pilnas žurnalas yra
`data/scraped-preview/run.log`, duomenys ir suvestinė yra tame pačiame aplanke.
Peržiūra paveldi vietinio rinkimo patikras ir išsaugo paskutinę gerą kopiją.
Duomenų bazės prisijungimo kintamasis į šį paleidimą neperduodamas.
Nepilnas, atmestas ar nepavykęs paleidimas grąžina nesėkmės kodą.
`npm run scrape` lieka esamai kasdienei eigai ir išsamiam diagnozavimui.

GitHub „Shelter scrapers“ PR patikroje veikia vietiniai testų pavyzdžiai.
Patvirtintai vieno šaltinio peržiūrai naudok „Run workflow“ ir įrašyk jo ID.
Rezultatai laikomi 7 dienų artefakte, o santrauka rodoma paleidimo puslapyje.
`probe-request.txt` ir `live-run-request.txt` pakeitimai rinkimo nebepaleidžia.
