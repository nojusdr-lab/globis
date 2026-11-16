# GLOBIS beta leidimo paruošimas

> Naujausia parduotuvių būsena ir sąrašas, ko reikia iš savininko: [docs/store/README.md](store/README.md).

Paruošta vietinė versija: package `1.1.0-beta.1`, native marketing version `1.1.0`. Native versijoje naudojama tik skaitinė forma, tinkama vėlesniam store pateikimui. Tai nėra parduotuvėje paskelbtas leidimas. EAS projektas, viešas kanalas, paskyros ir produkcinė paslauga nesukurti.

## Tapatybė

Display name ir npm package pavadinimas pakeisti į GLOBIS / globis. UI, laiškų šablonuose ir README pašalinti seni „Myliu tave“ pavadinimai. Palikti `ios.bundleIdentifier = com.myliutave.app`, `android.package = com.myliutave.app` ir Expo slug `myliu-tave`. Jų keitimas gali sukurti atskirą programėlę parduotuvėje, prarasti esamų diegimų atnaujinimo kelią, paveikti push/deep-link/OTA ar pasirašymo konfigūraciją. Esamo store / EAS projekto savininkystė ir išleidimų istorija nėra patikrinta. Identifikatorių migracija nevykdoma be atskiro savininko sprendimo. Android versionCode ir iOS buildNumber nedidinami spėjant istoriją: prieš store build reikia patikrinti jau naudotas reikšmes.

## Originalūs failai

Vizualiai patikrinti repo failai: `Code_Generated_Image.png` — 512×160 wordmark; `(1).png` — 512×512 programėlės ženklas; `(2)`, `(3)`, `(4)` — 400×333 ženklai. Naudojami originalai, ne generuota kopija. iOS naudoja [1024 × 1024 RGB ikoną](../assets/ios-app-icon.png). Ji paruošta iš originalaus `(1).png` ženklo, skaidrius kampus užpildžius originalia #245B46 spalva. iOS pritaiko sistemos kampų formą. Galutinę išvaizdą dar reikia peržiūrėti pasirašytame build’e. Android adaptuojama ikona (su monochromine versija), paleidimo ekranas ir web favicon sugeneruoti iš to paties originalaus ženklo (2026-11-16); saugias zonas dar patikrinti įrenginyje.

## Prieš viešą beta

- Savininkas pasirenka platinimo kanalą ir patvirtina išleidimą. Ši užduotis nieko viešai nediegia.
- Patvirtinti duomenų ir nuotraukų naudojimo teises, aktualumą bei šaltinio aprėptį. Live Globok / Meta lieka išjungti.
- Užpildyti `app.json` → `expo.extra.supportEmail` ir `privacyPolicyUrl` tikrais savininko patvirtintais duomenimis; dabar jie null, o „Apie GLOBIS“ tai aiškiai nurodo. Pasiekiama paspaudus logotipą.
- Peržiūrėti [privatumo projektą](privacy.md), paskelbti patvirtintą URL ir užpildyti store privatumo formas. Neišgalvoti juridinio asmens ar kontaktų.
- Native įrenginiuose patikrinti save/reload, gestus, safe areas, didelį šriftą, screen reader, permission / offline būsenas ir kontaktų perdavimą kitoms programėlėms. [Web beta įrodymai](beta-check.md) nepakeičia native bandymo.
- Patikrinti signing, store/EAS tapatybę, build numerius ir atnaujinimo kelią. Tik tada ruošti pasirašytą build ir originaliais ekranais pagrįstus store screenshotus.

## Atskirai planuojami darbai

Paskyros / autentifikacija: [#19](https://github.com/nojusdr-lab/globis/issues/19), įvaikinimo paraiškos: [#20](https://github.com/nojusdr-lab/globis/issues/20), Globis AI: [#21](https://github.com/nojusdr-lab/globis/issues/21). Šiame beta etape nėra jų imitacijos, sėkmės pranešimų ar nepatvirtintų išorinių paslaugų.
