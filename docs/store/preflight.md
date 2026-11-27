# Patikra prieš pateikimą (2026-11-16)

Patikrinta pagal Apple taisyklių sąrašą („app-store-preflight“) ir Google Play reikalavimus. Kodas, ne veikiantis build’as: įrenginyje dar netestuota.

## ❌ Stabdo pateikimą (5)

1. **[Apple 5.1.1, Play] Nėra viešo privatumo politikos adreso.** Tekstas paruoštas ([LT](privacy-policy.lt.md), [EN](privacy-policy.en.md)), bet trūksta valdytojo duomenų ir viešos vietos. Įrašyti URL į `app.json` → `extra.privacyPolicyUrl`.
2. **[Apple 1.5] Nėra palaikymo kontakto.** `extra.supportEmail` = app.globis@gmail.com (2026-11-24). Dar reikia ir palaikymo puslapio URL (gali būti tas pats puslapis kaip politika).
3. **[Apple 5.2.1, 2.3.9] Duomenų ir nuotraukų teisės.** Visos 937 gyvūnų nuotraukos ir skelbimai dabar paimti iš `globok.lt`, kurio taisyklės draudžia turinį naudoti be sutikimo. Reikia arba Globok raštiško sutikimo, arba duomenų tiesiai iš prieglaudų svetainių (daro kitas darbas).
4. **[Apple 2.1] Įrenginyje neišbandytas build’as.** Reikia Apple ir Google kūrėjų paskyrų, tada `eas build` ir bandymo telefone.
5. **[Apple 2.1] Pasenę duomenys.** Programėlės duomenys įrašyti į programėlę ir nesiatnaujina. Recenzentas gali rasti jau įvaikintų gyvūnų. Sprendimas: Supabase duomenų bazė (daro kitas darbas) arba bent atnaujintas rinkinys prieš pateikimą.

## ⚠️ Įspėjimai (6)

1. **[Apple 4.2] Minimali funkcija.** Rizika maža: yra braukimas, filtrai, išsaugojimas įrenginyje, prieglaudų sąrašas, veikia be interneto (išskyrus nuotraukas). Recenzento pastabose tai aprašyta ([review-notes.md](review-notes.md)).
2. **Identifikatoriai `com.myliutave.app` ir slug `myliu-tave`** liko nuo seno pavadinimo. Jei parduotuvėse dar nėra programėlės šiuo ID, verta pakeisti į pvz. `lt.globis.app` prieš pirmą leidimą. Po leidimo pakeisti nebegalima. Reikia savininko sprendimo.
3. **Apple lietuviškų metaduomenų nėra.** App Store Connect lietuvių kalbos aprašymui nesiūlo, todėl Apple aprašymas angliškas (en-GB), Google Play turi ir LT, ir EN. Prieš pateikiant patikrinti, ar Apple sąrašas nepasikeitė.
4. **„Apie GLOBIS“ langas rodo „beta“ ir „Beta nepaskelbta parduotuvėse“.** Prieš leidimą tekstą reikia pakeisti (daro UI perkėlimo darbas).
5. **Vertimų spragos** (žr. žemiau). Aprašymas sako, kad programėlė veikia ir angliškai, todėl jas reikia sutaisyti.
6. **iPhone Duo ekrano nuotraukos** bus privalomos nuo 2027 m. balandžio.

## ✅ Praėjo

- Paskyrų, pirkimų, reklamos, sekimo, AI nėra. Sign in with Apple nereikia.
- Privatumo manifestas, `ITSAppUsesNonExemptEncryption=false`, tik `INTERNET` leidimas (patikrinta `expo prebuild`).
- Ikonos: iOS 1024 px be skaidrumo, Android adaptuojama ikona su monochromine versija, paleidimo ekranas su GLOBIS ženklu. Visos iš originalaus ženklo.
- Parduotuvių tekstai telpa į ribas, be kitų platformų pavadinimų, be skaičių ir superlatyvų (`tests/store-metadata.test.cjs`).
- Kontrastas: pagrindiniai tekstai 5,7:1 ir daugiau (reikia 4,5:1). Mygtukai ≥ 48 px. Braukimas turi mygtukų alternatyvą „Išsaugoti“ / „Praleisti“. Sumažinto judesio nustatymas gerbiamas.

## Prieinamumo ir vertimų spragos (perduoti UI perkėlimo darbui)

**Sutaisyta 2026-11-16** (vertimų ir prieinamumo PR): visos lentelės eilutės, taip pat 4 ir 5 įspėjimai. „Apie“ lange nebėra žodžio „beta“. Šriftų ribos: mygtukai, žymos ir apatinė navigacija auga iki 1,3–1,4 karto, kad netrūktų 375 × 667 ekrane. Kalba pirmą kartą parenkama pagal telefoną: lietuviška arba nežinoma kalba reiškia LT, kita kalba reiškia EN.

| Vieta | Problema |
|---|---|
| `src/mobile/ui.js` `Sheet` | „Uždaryti“ ir „Uždaryti skydelį“ visada lietuviškai, net EN režime. |
| `src/mobile/ui.js` `SourceLink` | Numatytas tekstas „Originalus skelbimas“ ir klaida „Nepavyko atidaryti nuorodos.“ tik LT. |
| `src/mobile/Profiles.js` | Klaidos „Nepavyko pradėti skambučio.“, „Nepavyko atidaryti pašto.“ tik LT. |
| `src/mobile/AboutSheet.js` | Visas langas tik LT, negauna `lang`. |
| `src/mobile/GlobisApp.js` kalbos mygtukas | Ekrano skaitytuvas girdi tik „LT“. Reikia etiketės „Kalba: lietuvių. Perjungti į anglų“. |
| `src/mobile/GlobisApp.js` logotipas | Etiketė „Apie GLOBIS“ ir EN režime. |
| Visur | Nėra `maxFontSizeMultiplier` ribų. Patikrinti didžiausią šriftą 375 × 667 ekrane, ar apatinė navigacija nelūžta. |
| Sistemos kalba | Programėlė visada startuoja LT. Galima pradėti EN, jei telefono kalba ne lietuvių (`expo-localization`). |
