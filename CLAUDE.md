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

Savininko sprendimas (2026-11-17): viešų prieglaudų svetainių ir viešų Facebook puslapių duomenis rinkti galima. Ribos: be prisijungimo, neapeiti CAPTCHA ar kitų apsaugų, riboti užklausų dažnį, nerinkti privačių asmenų duomenų. Svetainėms gerbti `robots.txt` ir sąlygas. Facebook `robots.txt` draudžia automatinį rinkimą be Meta rašytinio leidimo; savininkas sprendimą priėmė žinodamas šią riziką. Facebook puslapiai skaitomi tik kaip organizacijos profilis (`scripts/scrapers/facebook-pages.cjs`); skelbimų iš ten be prisijungimo nėra.

## Dizainas

Dizainas ir prekės ženklas yra keičiami. Dabartinė kryptis: žalia `#245B46`, šviesus vėsus fonas, navigacija „Globoti / Prieglaudos / Išsaugoti“. Nukrypstant trumpai paaiškink, kodėl naujas sprendimas geresnis vartotojui. Tikrink 375×667 – 430×932 ekranuose.

## Darbo tvarka

„Claude Code“ vadovauja GLOBIS techniniam įgyvendinimui. „Codex“ yra antrasis kūrėjas, kuris tęsia savininko paskirtas užduotis, kai „Claude Code“ pasiekia naudojimo limitą. Grįžęs į darbą, „Claude Code“ patikrina naujus commitus, atvirus PR ir [koordinavimo temą #1](https://github.com/nojusdr-lab/globis/issues/1), kad perimtų naujausią būseną ir nedubliuotų pakeitimų. „Codex“ ten palieka nuorodą į savo PR, pakeitimų santrauką ir testų rezultatus.

- Niekada tiesiai į `main`. Atskira šaka ir PR. Jungti tik kai testai žali ir pakeitimas peržiūrėtas.
- Savininko sprendimo reikia: mokamoms paslaugoms, išorinių paskyrų kūrimui, raktams ir slaptažodžiams, leidimui į gamybą ar parduotuves, destruktyviems repo veiksmams.
- Ataskaitos savininkui trumpos, lietuviškai, be žargono.

## Claude Code darbo režimas

Išsami eiga: [docs/handoff/CLAUDE_CODE_SETUP.md](docs/handoff/CLAUDE_CODE_SETUP.md).

- Ponytail Ultra ir Caveman Ultra: mažiausias pilnas pakeitimas, trumpi pranešimai; kodas, komandos, klaidos ir testų rezultatai tikslūs. Jei įskiepiai neveikia, laikykis to paties be jų.
- Modelis: Sonnet, vidutinė ar mažesnė pastanga. Aukštesnė tik architektūrai, duomenų saugai, migracijoms, sunkiai atkuriamoms klaidoms.
- Viena užduotis vienai gijai. Naujai užduočiai nauja gija ir `/clear`; ta pačia užduotimi `/compact` su tikslu, PR, šaka, testai, kitas žingsnis.
- Skaityk tik reikiamą: `grep` (ne `rg`, RTK jį perrašo į neveikiantį `rtk rg`), konkretus failas, PR diff. Didelę išvestį laikyk faile.
- Vienas specializuotas įgūdis užduočiai. Rinkimo skriptai veikia be modelio.
- Testai: Node ≥ 22.13. Su Node 20 lūžta `node:sqlite` testai.
- Prie ~80 % 5 val. ar savaitės kvotos: vienas mažas patikrintas žingsnis; ~90 %: commit, testai, perdavimas Issue #1 (tikslas, šaka, commit, PR, kas patikrinta, blokatoriai, kitas žingsnis).

## Compact instructions

Išsaugok: tikslą, Issue ir PR, šaką ir commit, pakeistus failus, testų rezultatus, blokatorius, kitą žingsnį.
