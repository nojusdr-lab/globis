# Privatumo formos parduotuvėse (juodraštis)

Atsakymai atitinka dabartinį kodą (2026-11-16): nėra paskyrų, analitikos, reklamos, klaidų ataskaitų SDK, push pranešimų ar serverio, kuris gautų vartotojo duomenis. Jei bent vienas iš jų atsiras (pvz. Supabase su vartotojo įrašais, Sentry, analitika), šias formas reikia pildyti iš naujo.

> **Atnaujinta 2026-11-17:** atsirado neprivaloma paskyra (Supabase, ES). Žemiau atsakymai su paskyra.

## Apple · App Privacy („Privatumo etiketė“)

| Klausimas | Atsakymas | Kodėl |
|---|---|---|
| Do you or your third-party partners collect data from this app? | **Yes** | Neprivaloma paskyra siunčia el. paštą ir išsaugotų skelbimų ID į Supabase. |
| Contact Info → **Email Address** | Collected · **Linked to user** · **App Functionality** · Not used for tracking | Prisijungimui. |
| User Content → **Other User Content** (išsaugotų gyvūnų ID) | Collected · **Linked to user** · **App Functionality** · Not used for tracking | Sąrašo sinchronizacijai. |
| Identifiers → **User ID** | Collected · **Linked to user** · **App Functionality** · Not used for tracking | Supabase paskyros ID. |
| Tracking | Ne | Nėra reklamos ar sekimo SDK. `ios.privacyManifests.NSPrivacyTracking = false`. |
| Privacy Policy URL | **Reikia savininko** | Paskelbti [LT](privacy-policy.lt.md) / [EN](privacy-policy.en.md) versiją viešu adresu. |

Pastaba: nuotraukos kraunamos iš prieglaudų svetainių serverių (ADR 0002). Tai ne GLOBIS duomenų rinkimas, bet politikoje tai paaiškinta.

`app.json` jau turi Apple privatumo manifestą (`PrivacyInfo.xcprivacy`) su React Native / Expo naudojamomis „required reason“ API priežastimis: UserDefaults `CA92.1`, failų laikai `C617.1`, sistemos paleidimo laikas `35F9.1`, disko vieta `E174.1`. Patikrinta `expo prebuild`: failas sugeneruojamas.

## Google Play · Data safety

| Klausimas | Atsakymas |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (tik su neprivaloma paskyra): Personal info → Email address; App activity → Other user-generated content (išsaugotų ID); App info → User IDs. Visi: Collected, not shared, **optional**, purpose: App functionality / Account management. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS). |
| Do you provide a way for users to request that their data is deleted? | **Yes**: Paskyra → „Ištrinti paskyrą“ programėlėje. Google taip pat reikalauja ištrynimo nuorodos internete: **reikia savininko** (pvz. puslapis su instrukcija ir el. paštu). |
| Privacy policy URL | **Reikia savininko** (tas pats URL kaip Apple). |

Kiti Play Console klausimynai:

- **Ads:** No ads.
- **App access:** visos funkcijos be prisijungimo; neprivaloma paskyra tik sinchronizacijai. Peržiūrai pateikti demo paskyrą.
- **Content rating (IARC):** atsakymai: smurto, seksualinio turinio, keiksmų, azartinių lošimų, vartotojų bendravimo, vietos dalinimosi, pirkimų nėra. Tikėtinas rezultatas „Everyone / PEGI 3“, bet galutinį duoda klausimynas.
- **Target audience:** 18+ (arba 13+). Ne vaikams skirta programėlė, todėl Families politika netaikoma.
- **News app:** No. **Government app:** No. **Financial features:** None. **Health:** No.

## Leidimai

- Android: tik `INTERNET`. Papildomai blokuojami `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`, `VIBRATE`, kuriuos kartais prideda bibliotekos.
- iOS: jokių leidimų prašymų (kamera, vieta, kontaktai ir pan. nenaudojami).
- Šifravimas: `ITSAppUsesNonExemptEncryption = false` (naudojamas tik standartinis HTTPS), todėl eksporto dokumentų nereikia.
