---
name: globis-next
description: Pasirenka ir atlieka vieną aktualų GLOBIS darbą iš GitHub kelrodžio, patikrina pakeitimą ir pateikia jį peržiūrai.
disable-model-invocation: true
---

1. Perskaityk `CLAUDE.md`, `AGENTS.md` ir `docs/handoff/CLAUDE_CODE_HANDOFF.md`. Patikrink `git status`, aktualų `origin/main`, susijusias užduotis, PR ir jų CI. Jei projektas atidarytas darbo perdavimo šakoje, funkcijų darbą daryk atskirame worktree arba šakoje nuo patikrintos techninės bazės.
2. Pasirink aukščiausio aktualaus prioriteto darbą. Pradėk nuo #24. Jei #24 užbaigtas, jau vykdomas arba blokuojamas, imkis #23. Vertink #4, #5, #12 ir #17 būseną. Patvirtink, kuri bazė reikalinga. Jei reikia nesujungto PR pakeitimų, nurodyk priklausomybę ir atidaryk susietą juodraštį.
3. Atlik vieną pakeitimą su išmatuojamais priėmimo kriterijais. Dirbk su vietiniais sintetiniais pavyzdžiais, kol šaltiniui dokumentuotos reikalingos teisės. Naudok turimus adapterius, eilę ir validavimą. Paleisk susijusius testus bei `git diff --check`. Skaityk tik darbui reikalingus esamus dizaino ar techninius dokumentus.
4. Savo darbo šakoje paskelbk peržiūrai parengtą pakeitimą, jei GitHub prieiga leidžia. Pridėk susijusį issue, tikslų commit SHA ir atliktus testus. Patikrink faktinę CI būseną. Jei publikavimą blokuoja autentifikacija, pranešk apie kliūtį ir nurodyk vietinę šaką.
5. Savininkui trumpai lietuviškai pateik rezultatą, likusį sprendimą, jei jo reikia, ir siūlomą kitą užduotį. Gamybinis rinkimas, duomenų ar programėlės publikavimas ir PR sujungimas vykdomi pagal projekto patvirtinimus.
