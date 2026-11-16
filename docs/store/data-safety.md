# Privatumo formos parduotuvėse (juodraštis)

Atsakymai atitinka dabartinį kodą (2026-11-16): nėra paskyrų, analitikos, reklamos, klaidų ataskaitų SDK, push pranešimų ar serverio, kuris gautų vartotojo duomenis. Jei bent vienas iš jų atsiras (pvz. Supabase su vartotojo įrašais, Sentry, analitika), šias formas reikia pildyti iš naujo.

## Apple · App Privacy („Privatumo etiketė“)

| Klausimas | Atsakymas | Kodėl |
|---|---|---|
| Do you or your third-party partners collect data from this app? | **No, we do not collect data from this app** | Išsaugoti skelbimai, atšaukimo istorija ir kalba lieka tik įrenginyje. Apple apibrėžime „collect“ reiškia perdavimą iš įrenginio. |
| Tracking | Ne | Nėra reklamos ar sekimo SDK. `ios.privacyManifests.NSPrivacyTracking = false`. |
| Privacy Policy URL | **Reikia savininko** | Paskelbti [LT](privacy-policy.lt.md) / [EN](privacy-policy.en.md) versiją viešu adresu. |

Pastaba: nuotraukos kraunamos iš trečiųjų šalių serverių (dabar `globok.lt`). Tai ne GLOBIS duomenų rinkimas, bet politikoje tai paaiškinta.

`app.json` jau turi Apple privatumo manifestą (`PrivacyInfo.xcprivacy`) su React Native / Expo naudojamomis „required reason“ API priežastimis: UserDefaults `CA92.1`, failų laikai `C617.1`, sistemos paleidimo laikas `35F9.1`, disko vieta `E174.1`. Patikrinta `expo prebuild`: failas sugeneruojamas.

## Google Play · Data safety

| Klausimas | Atsakymas |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Netaikoma (nerenka). Visi tinklo kreipiniai į HTTPS adresus. |
| Do you provide a way for users to request that their data is deleted? | Netaikoma. Vietinius duomenis vartotojas ištrina programėlės nustatymuose. |
| Privacy policy URL | **Reikia savininko** (tas pats URL kaip Apple). |

Kiti Play Console klausimynai:

- **Ads:** No ads.
- **App access:** All functionality available without special access (prisijungti nereikia).
- **Content rating (IARC):** atsakymai: smurto, seksualinio turinio, keiksmų, azartinių lošimų, vartotojų bendravimo, vietos dalinimosi, pirkimų nėra. Tikėtinas rezultatas „Everyone / PEGI 3“, bet galutinį duoda klausimynas.
- **Target audience:** 18+ (arba 13+). Ne vaikams skirta programėlė, todėl Families politika netaikoma.
- **News app:** No. **Government app:** No. **Financial features:** None. **Health:** No.

## Leidimai

- Android: tik `INTERNET`. Papildomai blokuojami `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`, `VIBRATE`, kuriuos kartais prideda bibliotekos.
- iOS: jokių leidimų prašymų (kamera, vieta, kontaktai ir pan. nenaudojami).
- Šifravimas: `ITSAppUsesNonExemptEncryption = false` (naudojamas tik standartinis HTTPS), todėl eksporto dokumentų nereikia.
