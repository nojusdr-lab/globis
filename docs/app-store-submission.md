# GLOBIS · App Store Connect

> Naujausia parduotuvių būsena ir sąrašas, ko reikia iš savininko: [docs/store/README.md](store/README.md).

**Būsena** · Metaduomenų ir „App Review“ pastabų projektas. Pateikimui reikia patikrinto pasirašyto iOS build’o ir apačioje nurodytų patvirtinimų.

## Parduotuvės tekstas

Siūloma „English (U.K.)“ metaduomenų lokalizacija. „Apple“ ją nurodo kaip numatytąją Lietuvos parduotuvei, o lietuvių kalbos metaduomenų lokalizacija sąraše nepateikta. Programėlėje galima rinktis lietuvių kalbą. [„Apple“ lokalizacijų sąrašas](https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations/)

| Laukas | Reikšmė |
|---|---|
| Name | GLOBIS |
| Subtitle | Find a pet to adopt |
| Keywords | pet adoption,rescue,shelters,dog,cat,Lithuania,gyvūnai,prieglauda,globa |
| Promotional text | Discover pets and animal shelters in Lithuania, save a shortlist and open the original listings to learn more. |

### Description

GLOBIS helps you discover pets and animal shelters in Lithuania.

Browse pet cards or switch to a grid. Filter by animal type or city and save the pets you want to revisit. Open a pet’s profile to see available details and the original listing. Use the shelter directory to find organisations and see the listings linked to them.

Saved pets stay on your device. You can browse without creating an account. For adoption enquiries and current availability, contact the shelter through the original listing.

## App Review notes

GLOBIS is a pet and shelter discovery app for Lithuania. No account or sign-in is required. In the Lithuanian interface, open **Globoti** to browse, use the filters and open a pet profile. Tap **Išsaugoti** to save a pet and open **Išsaugoti** in the bottom navigation to revisit it. Open **Prieglaudos** to search for a shelter and view its linked listings. Select **English** in the app if preferred.

The app stores saved choices on the device. Original listing links open an external website. Shelters handle enquiries and adoption outside the app.

Before submitting, append the models and iOS versions actually tested, plus the verified sources used by the release build. [„Apple“ informacija peržiūrai](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)

## Iki pateikimo

| Darbas | Dabartinė būsena |
|---|---|
| Programėlės įrašas, iOS identifikatorius ir build’o numeris | Patikrinti esamą App Store Connect įrašą ir „Apple Developer“ komandą prieš tvirtinant identifikatorių, pasirašymą ir build’o numerį. |
| Pasirašytas build’as ir vidinis bandymas | Iš pasirašyto kandidato atlikti vietinę arba TestFlight patikrą. Fiksuoti įrenginius, iOS versijas ir patikrintas sąveikas. |
| Pateikimo ekrano nuotraukos ir ikona | Paruošta [1024 × 1024 RGB iOS ikona](../assets/ios-app-icon.png) iš originalaus GLOBIS ženklo. Patikrinti ikoną pasirašytame build’e ir užfiksuoti ekranus iš leidimo kandidato. |
| Skelbimai ir nuotraukos | Patikrinti, kad leidimo kandidatas naudoja dokumentuotai leidžiamą duomenų rinkinį ir nuotraukas. |
| Palaikymas, privatumas ir kontaktai | Patvirtinti atsakingą subjektą, palaikymo kontaktą bei veikiančius viešus URL. Užpildyti privatumo deklaraciją pagal galutinio build’o duomenų srautus. |
| Pateikimas | Patikrinti vardą, kategoriją, amžiaus klausimyną, teisių deklaracijas, pasirašytą build’ą ir medžiagą prieš perduodant savininkui pateikti. |

Dabartinės beta ribos aprašytos [leidimo paruošimo dokumente](release-readiness.md) ir [privatumo projekte](privacy.md). [„Apple“ versijos laukai](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) · [Pateikimo tvarka](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/)

## Pasirašyto iOS kandidato patikra

Užfiksuok kandidato commit SHA, „App Store Connect“ build numerį, „iPhone“ modelį, iOS versiją ir bandymo datą. Kiekvieną eilutę pažymėk pagal faktinį rezultatą: praėjo, nepraėjo arba neišbandyta.

| Veiksmas | Ko tikėtis |
|---|---|
| Atidaryti švariai įdiegtą programėlę | Įrenginyje rodoma GLOBIS ikona. Lietuvišką „Globoti“ ekraną galima atidaryti be paskyros. Sistemos juostos neuždengia navigacijos. |
| Braukti į abi puses, paspausti „Atšaukti“ ir atidaryti gyvūno profilį | Kortelė pasikeičia pagal gestą. „Atšaukti“ grąžina ankstesnį pasirinkimą. Profilis ir galerijos valdikliai atsidaro be netyčinio braukimo veiksmo. |
| Išsaugoti įrašą, užverti programėlę ir atidaryti iš naujo | Įrašas išlieka skiltyje „Išsaugoti“. Jį galima pašalinti. |
| Pritaikyti filtrus ir atidaryti prieglaudos profilį | Kortelių ir tinklelio filtrai sutampa. Rezervuotas įrašas matomas prieglaudos profilyje su žyma, jei tokių įrašų yra kandidato rinkinyje. |
| Atidaryti patvirtinto skelbimo šaltinį ir grįžti į GLOBIS | Atsiveria tinkamas originalus skelbimas. Grįžus programėlė veikia toliau. Kontaktą patikrink tik jei kandidato rinkinyje yra patvirtintas kontaktas. |
| Įjungti „VoiceOver“, didesnį šriftą ir sumažintą judesį | Svarbiausi veiksmai turi suprantamus pavadinimus ir veikia paspaudimais. Didelis tekstas neuždengia veiksmų, animacija prisitaiko prie nustatymo. |
| Išjungti ryšį ir atidaryti profilį | Išsaugoti pasirinkimai lieka pasiekiami. Negalint įkelti nuotraukos rodoma aiški būsena. |
| Atidaryti „Apie GLOBIS“ ir užfiksuoti pateikimo ekranus | Privatumo ir palaikymo kontaktai pasiekiami. Ekranai užfiksuoti iš patikrinto kandidato su turiniu, kurį leidžiama viešinti. |
