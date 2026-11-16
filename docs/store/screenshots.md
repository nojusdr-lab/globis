# Ekrano nuotraukų planas

Nuotraukos daromos tik iš tikro leidimo kandidato su tikrais duomenimis, kuriuos leidžiama rodyti (žr. „Duomenų teisės“ [README](README.md)). Jokių sugalvotų gyvūnų ar prieglaudų. Antraštės ant nuotraukų trumpos, be skaičių ir superlatyvų.

## Dydžiai

| Parduotuvė | Ko reikia | Dydis |
|---|---|---|
| App Store | iPhone 6,9" (privaloma), 3–10 vnt. | 1320 × 2868 (arba 1290 × 2796) |
| App Store | iPad | nereikia (`supportsTablet: false`) |
| Google Play | Telefono nuotraukos, 2–8 vnt. | 1080 × 1920 arba 1080 × 2400 (9:16 ar ilgesnis) |
| Google Play | Funkcijų grafika | 1024 × 500 · **paruošta:** `store/assets/play-feature-graphic-1024x500.png` |
| Google Play | Didelė ikona | 512 × 512 · **paruošta:** `store/assets/play-icon-512.png` |

## Kadrai (eilės tvarka)

| # | Ekranas | Antraštė LT | Antraštė EN |
|---|---|---|---|
| 1 | „Globoti“, viena gyvūno kortelė su nuotrauka | Rask draugą iš prieglaudos | Find a friend from a shelter |
| 2 | Gyvūno profilis su nuotraukų galerija ir „Originalus skelbimas“ | Tik tai, ką parašė prieglauda | Only what the shelter says |
| 3 | „Išsaugoti“ su keliais gyvūnais | Patikusius išsisaugok telefone | Save favourites on your phone |
| 4 | Filtrai: rūšis ir miestas | Šunys ar katės, tavo mieste | Dogs or cats near you |
| 5 | „Prieglaudos“ sąrašas su paieška | Visos prieglaudos vienoje vietoje* | Shelters in one place |
| 6 | Tinklelio vaizdas | Matyk daug iš karto | See many at once |

\* Žodį „visos“ naudoti tik jei duomenyse tikrai yra visos žinomos prieglaudos. Kitaip: „Prieglaudos vienoje vietoje“.

## Kaip padaryti (kai bus build’as)

1. iOS simuliatoriuje „iPhone 17 Pro Max“ (6,9") ir Android emuliatoriuje „Pixel 9“ paleisti leidimo kandidatą.
2. Nustatyti laiką 9:41, pilną bateriją, be pranešimų.
3. Padaryti 6 kadrus LT kalba, tada perjungti EN ir pakartoti.
4. Antraštes uždėti vienodu šriftu ant žalio `#245B46` fono virš ekrano.
5. Patikrinti, kad kadruose nėra „Android“ / „Google Play“ žodžių App Store versijoje ir atvirkščiai.
