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

„Claude Code“ vadovauja GLOBIS techniniam įgyvendinimui. „Codex“ yra antrasis kūrėjas, kuris tęsia savininko paskirtas užduotis, kai „Claude Code“ pasiekia naudojimo limitą. Grįžęs į darbą, „Claude Code“ patikrina naujus commitus, atvirus PR ir [koordinavimo temą #1](https://github.com/nojusdr-lab/globis/issues/1), kad perimtų naujausią būseną ir nedubliuotų pakeitimų. „Codex“ ten palieka nuorodą į savo PR, pakeitimų santrauką ir testų rezultatus.

- Niekada tiesiai į `main`. Atskira šaka ir PR. Jungti tik kai testai žali ir pakeitimas peržiūrėtas.
- Savininko sprendimo reikia: mokamoms paslaugoms, išorinių paskyrų kūrimui, raktams ir slaptažodžiams, leidimui į gamybą ar parduotuves, destruktyviems repo veiksmams.
- Ataskaitos savininkui trumpos, lietuviškai, be žargono.
