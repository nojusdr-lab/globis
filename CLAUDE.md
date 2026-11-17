# GLOBIS

GLOBIS yra Lietuvos gyvūnų globos ir įvaikinimo programėlė. Pagrindinė kalba lietuvių. Technologijos: Expo, React Native, JavaScript. Duomenų bazė: Supabase (Postgres), schema `supabase/migrations/`. Discovery Engine yra atskiras Node.js modulis `scripts/discovery-engine/`.

## Kur kas yra

- Programėlė: `App.js` → `src/mobile/` (ekranai) ir `src/state/` (išsaugoti pasirinkimai).
- Duomenys programėlėje: `src/data/allPets.json`, `src/data/shelters.json`, taisyklės `src/data/integrity.cjs`.
- Testai: `npm test` (reikia Node 22.13 arba naujesnio). Build: `npm run build`.

## Duomenų taisyklės (nekeičiamos)

- Jokių išgalvotų faktų apie gyvūnus ar prieglaudas. Ko šaltinyje nėra, lieka nežinoma (`null`).
- Statusai: laisvas, rezervuotas (nerodomas bendrame sąraše), nežinoma, nebeskelbiamas, patvirtintai įvaikintas. Dingimas iš šaltinio neįrodo įvaikinimo.
- Nepavykęs ar nepilnas atnaujinimas niekada neperrašo paskutinės geros publikuotos kopijos.
- Naršyti ir išsaugoti galima be prisijungimo.

## Duomenų rinkimas

Savininko sprendimas (2026-11): viešų prieglaudų svetainių duomenis rinkti galima, laikantis ribų: gerbti `robots.txt` ir svetainės sąlygas, riboti užklausų dažnį, neapeiti prisijungimų ar kitų apsaugų, nerinkti iš Facebook, nerinkti privačių asmens duomenų.

## Dizainas

Dizainas ir prekės ženklas yra keičiami. Dabartinė kryptis: žalia `#245B46`, šviesus vėsus fonas, navigacija „Globoti / Prieglaudos / Išsaugoti“. Nukrypstant trumpai paaiškink, kodėl naujas sprendimas geresnis vartotojui. Tikrink 375×667 – 430×932 ekranuose.

## Darbo tvarka

- Niekada tiesiai į `main`. Atskira šaka ir PR. Jungti tik kai testai žali ir pakeitimas peržiūrėtas.
- Savininko sprendimo reikia: mokamoms paslaugoms, išorinių paskyrų kūrimui, raktams ir slaptažodžiams, leidimui į gamybą ar parduotuves, destruktyviems repo veiksmams.
- Ataskaitos savininkui trumpos, lietuviškai, be žargono.

## Darbo režimai ir perdavimas

- Režimai: Ponytail ultra (mažiausias pilnas pakeitimas) ir Caveman (trumpi pranešimai; kodas, klaidos, keliai tikslūs). Jei įskiepių nėra, laikykis to paties be jų. Šiuos du režimus tikrina kiekviena nauja gija.
- Modelis: Sonnet, vidutinė ar mažesnė pastanga. Stipresnis modelis tik architektūrai, duomenų saugai, migracijoms, sunkiai atkuriamai klaidai.
- Viena užduotis vienu metu. Prieš pradėdamas: `git status`, `git fetch`, esamą PR tęsk jo šakoje, naujai užduočiai nauja šaka.
- Rinkimo skriptai (`scripts/scrapers/`) veikia be modelio. Į kontekstą duok santrauką ir klaidos fragmentą, pilną žurnalą laikyk faile. Išsaugok komandos baigties kodą.
- Artėjant prie ~80 % 5 val. ar savaitės kvotos: vienas mažas patikrintas žingsnis, tada commit ir perdavimas. ~90 %: tik commit, testų rezultatas, perdavimas.
- Perdavimas (Claude ↔ Codex) per [Issue #1](https://github.com/nojusdr-lab/globis/issues/1) ir PR komentarą: tikslas, šaka, commit, kas pakeista, kas išbandyta, blokatoriai, vienas kitas žingsnis.

## Compact instructions

Suspaudžiant išsaugok: tikslą, Issue ir PR, šaką ir commit, pakeistus failus, testų rezultatus, blokatorius, kitą konkretų žingsnį.
