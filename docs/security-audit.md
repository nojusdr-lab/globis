# GLOBIS saugumo auditas (2026-11-17)

Pagal savininko atsiųstą 8 skyrių sąrašą. Architektūra: Expo programėlė be serverio API; Supabase tik viešam skaitymui (anon raktas + RLS); rašo tik CI scraperis per `SUPABASE_DB_URL` (GitHub secret). Paskyrų, mokėjimų, įkėlimų, AI kvietimų nėra.

## Įvertinimas: 🟡 ACCEPTABLE

Asmens duomenų DB nėra, klientai negali rašyti (patikrinta gyvai: `POST /rest/v1/shelters` su anon raktu → `42501 permission denied`). Kritinių ar aukštų radinių nėra. Liko keli vidutiniai/žemi.

## Radiniai

| # | Svarba | Kas | Vieta | Taisymas |
|---|---|---|---|---|
| 1 | MEDIUM | DB slaptažodis buvo parašytas pokalbyje | – | Savininkas pakeitė slaptažodį (Reset database password). Patikrinti, kad senas nebegalioja |
| 2 | LOW | TLS be sertifikato tikrinimo (`rejectUnauthorized: false`) jungiantis prie Supabase iš CI | `scripts/scrapers/run.cjs` | Pridėti Supabase CA sertifikatą (`ssl: { ca }`), ~15 min |
| 3 | LOW | `npm audit`: 26 high, 2 moderate. Visi tranzityviniai build įrankiuose (picomatch/minimatch ReDoS per expo/metro). Į programėlę nepatenka. `npm audit fix --force` siūlo **atgal** į expo 50, to daryti negalima | `package-lock.json` | Atnaujinti su kitu Expo SDK patch'u (`npx expo install --fix`) |
| 4 | LOW | `pg` yra devDependency, naudojamas tik CI | `package.json` | Gerai, nieko |

## Sąrašas

**1. Raktai.** 1.1 ✅ kode raktų nėra (grep: `sk_`, `eyJ`, `ghp_`, `AKIA`, `service_role`). 1.2 ✅ `.env`, `.env*.local` yra `.gitignore`, istorijoje `.env` nebuvo. 1.3 ✅ viešas tik `EXPO_PUBLIC_SUPABASE_ANON_KEY` (skirtas būti viešu), `service_role` nenaudojamas. 1.4 ✅ raktai nespausdinami. 1.5 ✅ Expo export nekuria viešų source map. 1.6 ✅ be env programėlė tyliai naudoja įtaisytą kopiją (sąmoningai, ne nesaugi).

**2. DB.** 2.1 ✅ RLS įjungtas visose 5 lentelėse. 2.2 ✅ kiekviena turi SELECT politiką; INSERT nereikia, rašymas atimtas (`revoke insert, update, delete`). 2.3 ⬚ klientų rašymo politikų nėra. 2.4 ⬚ `auth.uid()` nenaudojamas, paskyrų nėra. 2.5 ✅ `service_role` niekur. 2.6 ⬚ Storage nenaudojamas. 2.7 ✅ visos SQL užklausos parametrizuotos (`$1…`). 2.8 ✅ `SECURITY DEFINER` funkcijų nėra; `publish_source_run` atimtas iš anon/authenticated.

**3. Autentifikacija.** 3.1–3.8 ⬚ paskyrų nėra (žr. žemiau).

**4. Validacija.** 4.1 ⬚ serverio API nėra. 4.2 ⬚. 4.3 ✅ React Native tekstas neinterpretuoja HTML; scraperis valo HTML (`cleanText`). 4.4 ⬚. 4.5 ✅ klaidos vartotojui be techninių detalių. 4.6 ⬚ webhook'ų nėra. Papildomai ✅ atidaromos tik `https?://` nuorodos (`ui.js:129`), telefonas ir el. paštas validuojami (`integrity.cjs`).

**5. Paketai.** 5.1 ⚠️ radinys 3. 5.2 ✅ visi paketai žinomi (expo, react-native, pg, pglite). 5.3 ✅ `package-lock.json` repo. 5.4 ⚠️ radinys 3. 5.5 ✅ nenaudojamų nerasta.

**6. Rate limiting.** 6.1 ⬚ mokamų API nėra. 6.2 ⬚. 6.3 ⬚. Supabase pats riboja anon užklausas.

**7. CORS.** ⬚ savo API nėra.

**8. Įkėlimai.** ⬚ nėra.

## Paskyros (Supabase Auth)

Sąmoningai **neįjungta** šią naktį:
- App Store 5.1.1(v): jei programėlės funkcijos neprimena paskyros, jos reikalauti negalima. Naršymas ir išsaugojimas jau veikia be paskyros (CLAUDE.md taisyklė).
- Jei paskyros bus, reikės Sign in with Apple (4.8), o tam reikia Apple Developer paskyros, paskyros ištrynimo programėlėje (5.1.1(v)) ir GDPR eksporto/ištrynimo.
- Prasminga, kai atsiras funkcija, kuriai paskyra tikrai reikalinga: išsaugotų sinchronizavimas tarp įrenginių, pranešimai, įvaikinimo paraiškos (#20).

Kai savininkas nuspręs, planas: Supabase Auth (Apple + el. pašto nuoroda), lentelė `saved` su RLS `auth.uid() = user_id` ir `with check`, paskyros ištrynimo mygtukas Paskyroje.
