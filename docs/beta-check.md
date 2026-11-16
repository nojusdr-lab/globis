# UX beta patikra

Susieti draft: PR #3 → pasirinkimų PR → mobiliųjų ekranų PR. Duomenų ir įgūdžių bazė: main `f638d3c`, PR #3 `f48af5e`. Naujausias savininko planas leidžia šiuos UX juodraščius iki PR #3 sujungimo. Produkcinio publikavimo nėra.

## Faktiškai patikrinta

- `npm test`: 35/35 su Node 24.22.1. Duomenų pilnumas, rezervacija, stable ID, idempotency, tikslus save/pass/undo, serializavimas ir bendri filtrai.
- `CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npm run build`: web, iOS ir Android eksportai sėkmingi.
- Chromium per Playwright, 390×844 su reduced-motion, taip pat 320×568 ir 1280×900: horizontalus braukimas dešinėn / kairėn, atšaukimas, profilio atidarymas paspaudimu, išsaugojimas po tikro puslapio perkrovimo, išsaugotų skiltis, kontakto skydelis ir originalaus šaltinio nuoroda, bendri rūšies / miesto filtrai kortelėms ir tinkleliui, nulinis skubios paieškos rezultatas, tuščia prieglaudų paieška, rezervuoto gyvūno profilis jo tikros prieglaudos sąraše, išsaugojimo blokavimas rezervacijai, trūkstama nuotrauka. Neaptikta JS pageerror ar horizontalaus puslapio išsikišimo.
- Valdikliai turi bent 48 px/pt taikinius, svarbūs veiksmai turi paspaudimo alternatyvą gestui, skirtukai turi aiškius prieinamumo pavadinimus, aktyvi būsena neperduodama vien spalva. Tamsiai žalia #245B46 ant balto fono ir atvirkščiai atitinka įprasto teksto AA kontrastą. SafeAreaProvider naudojamas native ir web.

Testo metu **visos išorinės užklausos blokuotos**. `docs/screenshots/` rodo programėlės įgyvendinimą, įskaitant tikrą nuotraukos klaidos fallback. Ekranuose nėra sintetinio gyvūno, reklaminio teksto ar patvirtinimo teiginių. Vardai ir prieglaudos paimti iš peržiūrimos projekto kopijos.

## Kaip pakartoti

Reikia Python Playwright ir Chromium (testo aplinkoje `/usr/bin/chromium`). Jų nėra programėlės runtime priklausomybėse. Po Expo eksporto kitame terminale paleisti `python -m http.server 8765 --directory dist`, tada `python tests/browser/beta.py`. Išvestis ir PNG sukuriami vietoje. Testas vykdo šviežią naršyklės kontekstą ir nepaliečia tikrų asmeninių pasirinkimų.

## Neišbandyta / ribos

- Nėra prijungto fizinio iOS / Android įrenginio ar native simuliatoriaus. Eksportas nėra įrodymas, kad native gestai, saugios zonos, klaviatūra, ekrano skaitytuvas ir SQLite išlikimas išbandyti įrenginyje.
- Visi dabartinės kopijos gyvūnai turi po vieną nuotrauką. Kelių nuotraukų naršymui paruoštas atskiras „Chromium“ bandymas su sintetiniais vaizdais.
- Kontaktai kopijoje sąmoningai tušti. Nebuvo siunčiami laiškai ar daromi skambučiai. Tikrų kontaktų mygtukai reikalauja kilmės įrodymo ir formato validacijos; šiuo metu kontaktuojama per šaltinį. Nuorodos / Share negalėjimas atidaryti rodo klaidą.
- Dabartinė kopija neturi aiškiai patvirtintų skubos įrodymų. Skubos filtras todėl duoda 0; laukimo trukmė nepaverčiama išgalvota skuba.
- Prieš viešą beta reikia savininko kanalo, privatumo ir palaikymo kontakto bei duomenų / nuotraukų naudojimo sprendimų. Live Globok ir Meta importai neįjungti.

## Leidimo paruošimo papildoma patikra

Vėlesnis susietas beta paruošimo PR: 36/36 Node testų; švarus `npm ci`; pakartoti visų platformų eksportai ir web beta. Papildomai patikrinta „Apie GLOBIS“ su aiškia nepaskelbto kontakto būsena bei sugadintos localStorage kopijos išlaikymas po Retry. Kai skaitymas vėl veikia, atkuriami tikri ankstesni pasirinkimai, o ne įrašoma tuščia būsena. Siaurame ekrane Resize patikra laukia React Native useWindowDimensions perskaičiavimo. Telefonų skambučių / laiškų ir native įrenginių testų tai nepakeičia.

## Galerijos bandymas su sintetinėmis nuotraukomis

Atskiroje vienkartinėje darbinėje kopijoje pirmojo `src/data/allPets.json` įrašo `photos` reikšmę pakeisk šiuo masyvu. Testinių nuorodų nekopijuok į paskelbiamų duomenų rinkinį.

```json
[
  "https://globis-gallery.invalid/first.png",
  "https://globis-gallery.invalid/missing.png",
  "https://globis-gallery.invalid/third.png"
]
```

Paleisk `npx expo export --platform web`, vietinį serverį kaip aprašyta aukščiau ir `python tests/browser/gallery.py`. Naršyklė perima visas tris užklausas vietoje. Patikrinama, kad po 404 galima atidaryti kitą nuotrauką, galerija veikia abiem kryptimis, iš naujo atidarytas profilis pradeda nuo pirmos nuotraukos ir angliški valdikliai atitinka pasirinktą kalbą.
