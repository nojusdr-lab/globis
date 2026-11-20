# GLOBIS dizaino brainstormas (2026-11-17)

Tikslas: kad programėlė atrodytų šilta ir sava, o ne kaip šablonas. Pagrindas: ekranai 390×844 (Globoti, gyvūno profilis, įvadas).

## Kas dabar atrodo „basic“

1. **Šriftai.** Sistemos šriftas ir standartinis serif vardui. Nėra savo balso.
2. **Kortelė.** Nuotrauka gera, bet apačioje plona balta juosta su vardu. Pirmas užrašas ant nuotraukos yra „Availability unconfirmed“: neigiamas tonas pačiame viršuje.
3. **Profilis.** Keturi brūkšniuoti langeliai „Nenurodyta“ užima pusę ekrano. Atrodo tuščia ir nepatikima, nors gyvūnas tikras.
4. **Spalva.** Vien žalia ir balta. Nėra antros, šiltos spalvos emocijai (širdelė, išsaugojimas).
5. **Gylis.** Viena kortelė be kaladės pojūčio: nesimato, kad už jos laukia dar 1 314.
6. **Tuščios būsenos.** Tik tekstas.

## Idėjos pagal naudą ir kainą

| # | Idėja | Nauda | Kaina |
|---|---|---|---|
| 1 | **Rodyti tik žinomus faktus.** Nežinomi sutraukiami į vieną eilutę „Paklausk prieglaudos: amžius, lytis, skiepai“ (`openQuestions` jau yra) | Profilis atrodo pilnas, sąžiningumas lieka | Mažai |
| 2 | **Kortelė per visą plotą.** Nuotrauka užpildo visą kortelę, apačioje tamsus gradientas, ant jo vardas, amžius, miestas. Kelių nuotraukų taškeliai viršuje | Didžiausias „wow“, kaip geriausiose swipe programėlėse | Vidutiniškai |
| 3 | **Savas šriftas.** Vardams charakteringas šriftas (pvz. Bricolage Grotesque arba Fraunces Soft), tekstui Inter. Per `expo-font` | Prekės ženklo balsas | Mažai |
| 4 | **Antra spalva.** Šilta abrikosinė (#F2A65A tipo) išsaugojimui ir širdelei, žalia lieka pagrindinė | Emocija, aiškesnis veiksmas | Mažai |
| 5 | **Kaladė.** Už kortelės matosi kitos kortelės kraštas (mastelis 0.96, poslinkis 8 px) | Gylis, kvietimas braukti | Mažai |
| 6 | **Išsaugojimo momentas.** Širdelės pulsas, haptic `impactLight`, trumpas „Išsaugota“. Su reduced motion: be animacijos | Malonumas, grįžtamasis ryšys | Mažai |
| 7 | **Statuso tonas.** „Neturime patvirtinimo“ perkelti iš nuotraukos viršaus į mažą ženkliuką prie vardo ir pilną paaiškinimą profilyje | Pozityvus pirmas įspūdis, tiesa lieka | Mažai |
| 8 | **Išsaugoti kaip galerija.** 2 stulpelių nuotraukų tinklelis su vardu ir statuso tašku | Atrodo kaip asmeninė kolekcija | Vidutiniškai |
| 9 | **Prieglaudos.** Didesni logotipai, „X laukia“ skaičius, miesto lustai, nuotraukų juosta su 3 gyvūnais | Prieglaudos atrodo gyvos | Vidutiniškai |
| 10 | **Tuščios būsenos su iliustracija** (letenėlė, linijinis piešinys žalia spalva) | Šilumas | Mažai |
| 11 | **Skaičiai.** „1314 left“ → „1 314 laukia namų“ | Misija, ne skaitiklis | Labai mažai |
| 12 | **Tamsus režimas** | Vakarinis naršymas | Vidutiniškai |

## Rekomendacija

Pirmas paketas (viena PR): **1, 7, 11, 4, 5, 6**. Viskas pigu, vizualus skirtumas didelis, rizika maža.

Antras paketas: **2 ir 3**. Tai didžiausias pokytis, verta pažiūrėti telefone prieš jungiant.

Trečias: 8, 9, 10, 12.

## Ko nekeisti

- Sąžiningumas: nežinomi faktai neišgalvojami, tik rodomi kitaip.
- Mygtukai „Praleisti / Išsaugoti“ lieka šalia gesto (prieinamumas).
- Kontrastas AA, taikiniai ≥ 44 pt, reduced motion.
