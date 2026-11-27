# GLOBIS parduotuvėms: kas paruošta ir ko trūksta

Būsena 2026-11-16. Niekas nepateikta ir nesukurta jokia paskyra.

## Paruošta

| Kas | Kur |
|---|---|
| Programėlės nustatymai: ikonos, paleidimo ekranas, privatumo manifestas, leidimai, kalbos | `app.json`, `locales/` |
| Build’ų profiliai (bandomasis APK ir parduotuvės build’as) | `eas.json` |
| Ikonos ir paleidimo ekranas iš originalaus GLOBIS ženklo | `assets/` |
| Google Play didelė ikona ir funkcijų grafika | `store/assets/` |
| Parduotuvių tekstai LT/EN (Apple ir Google) | `store/metadata.json` |
| Privatumo politika LT/EN (juodraštis) | [privacy-policy.lt.md](privacy-policy.lt.md), [privacy-policy.en.md](privacy-policy.en.md) |
| Atsakymai į privatumo formas (Apple, Google) | [data-safety.md](data-safety.md) |
| Ekrano nuotraukų planas | [screenshots.md](screenshots.md) |
| Pastabos Apple recenzentui | [review-notes.md](review-notes.md) |
| Patikra prieš pateikimą, prieinamumas, vertimai | [preflight.md](preflight.md) |
| Automatinis tekstų ir nustatymų tikrinimas | `tests/store-metadata.test.cjs` |

## Ko reikia iš Nojaus

Šių dalykų negalima padaryti be tavęs, nes jie kainuoja, reikalauja tavo tapatybės arba yra neatšaukiami.

1. **Apple Developer paskyra** (99 USD per metus): developer.apple.com/programs. Reikia Apple ID ir mokėjimo kortelės.
2. **Google Play Console paskyra** (25 USD vieną kartą): play.google.com/console. Reikia asmens dokumento patvirtinimo. Svarbu: naujai asmeninei paskyrai Google reikalauja, kad prieš paleidžiant viešai bent 12 žmonių 14 dienų bandytų programėlę uždarame teste. Pradėk rinkti bandytojus anksti.
3. **Expo paskyra** (nemokama): expo.dev/signup. Ja bus kuriami build’ai.
4. **Kas teikia programėlę:** tavo vardas ar įmonė, ir el. paštas palaikymui. Be to negalima paskelbti privatumo politikos.
5. **Kur paskelbti privatumo politiką:** paprasčiausia nemokama vieta yra GitHub Pages. Jei sutiksi, paruošiu.
6. **Programėlės ID:** ~~`com.myliutave.app`~~ → `lt.globis.app` (savininko sprendimas 2026-11-20). Siūlau `lt.globis.app`, jei programėlės šiuo senu ID parduotuvėse dar nėra. Po pirmo leidimo pakeisti nebegalima.
7. **Duomenų teisės:** nuotraukos ir skelbimai dabar iš Globok, kuris draudžia naudoti be sutikimo. Arba parašyk Globok ir paprašyk leidimo, arba palauk, kol duomenys bus renkami tiesiai iš prieglaudų svetainių.
8. **Galutinis leidimas pateikti** abiem parduotuvėms.

## Kai paskyros bus sukurtos

Terminale, programėlės aplanke (kiekvieną eilutę atskirai):

```
npm install -g eas-cli
eas login
eas init
eas build --profile preview --platform android
```

Paskutinė komanda sukuria bandomąjį Android failą, kurį gali įsidiegti savo telefone. Parduotuvės build’ams (`--profile production`) ir pateikimui pirma reikia 1–7 punktų.
