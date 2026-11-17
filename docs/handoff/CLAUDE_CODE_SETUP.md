# Claude Code nustatymai ir perdavimas (2026-11-17)

Trumpos taisyklės: [CLAUDE.md](../../CLAUDE.md). Čia matavimai, būsena ir atšaukimas.

## Pradinis matavimas (Claude Pro)

- 5 val. kvota 26 %, savaitės 71 % (atsinaujina 2026-11-21).
- Šios gijos kontekstas po ~20 kvietimų: 148 tūkst. tokenų (15 %): žinutės 65 tūkst., MCP įrankiai 43 tūkst., sistemos įrankiai 15 tūkst., įgūdžiai 10 tūkst. MCP įrankių aprašai yra didžiausias pastovus kaštas.
- RTK 1.2.0: 267 komandos, sutaupyta 13,2 tūkst. tokenų (33,9 %) komandų išvesties. Tai išvesties įvertis, ne kvotos sutaupymas.

## Kas veikia / ką pakeitėme

| Dalykas | Būsena |
|---|---|
| RTK `PreToolUse` kablys | Veikia vietoje. Klaida: `rg` perrašomas į `rtk rg`, kuris nepavyksta. Naudok `grep`. Debesies sesijose nepatikrinta. |
| Ponytail / Caveman | Įjungti per kablius. Numatytieji nustatyti `~/.claude/settings.json` `env`: `CAVEMAN_DEFAULT_MODE=ultracave`, `PONYTAIL_DEFAULT_MODE=ultra`. Debesyje neįrodyta: ten galioja tik `CLAUDE.md` tekstas. |
| `claude-mem` | Buvo sugedęs: nebuvo `claude-mem` paleidiklio ir plugino priklausomybių (`CAPTURE_BROKEN`). Pataisyta: paleidiklis `~/.local/bin/claude-mem`, `bun install --frozen-lockfile` plugino kataloge, darbininkas :37701 `ok`. Debesies sinchronizavimas išjungtas (tuščias token). Rizika: `CLAUDE_MEM_OBSERVER_ENABLED=true`, modelis haiku, `subscription` auth: fono santraukos naudoja Claude kvotą. Sprendimas savininkui: palikti ar išjungti. |
| Graphify 0.9.108 | Veikia. Bandymas `src/mobile`+`src/state`: 80 mazgų. Klausimas „kur sprendžiama, ar gyvūną galima siūlyti“ grąžino ~7,6 tūkst. tokenų (rado `eligible()`), tikslus `grep` ~2 tūkst. ir rado daugiau (`contactEvidence`). Išvada: mažam repo nenaudoti; grįžti, jei kodo bus daug kartų daugiau. Į repo nieko neįdiegta. |
| Obsidian | Neįdiegtas. Neatsisiųsta be savininko leidimo. `docs/` yra Markdown ir atveriamas kaip vault. |
| OmniRoute, agent-skills | Nebandyta. Nėra kvotos problemos, kurią jie spręstų; tikrinti tik su savininko leidimu (tiekėjas, išlaidos). |
| Testai | `npm test` Node 20.18: 43/47. 4 nepavyksta dėl `node:sqlite` (reikia Node ≥ 22.13). PR #36 nurodo 65/65 su Node 22. |

## Atšaukimas

- Režimai: pašalinti `env` raktus iš `~/.claude/settings.json` (kopija `/private/tmp/claude-501/settings.json.bak`, gali būti išvalyta).
- `claude-mem`: `rm ~/.local/bin/claude-mem`; išjungti `claude-mem@thedotmack` `enabledPlugins`.
- Ši šaka: uždaryti PR.

## Trys taisyklės kitai gijai

1. Prieš skaitydamas kodą naudok `grep` ir konkretų failą; grafo ar atminties paieška tik kai žinai, kad sutaupys.
2. Prieš testus patikrink `node -v` (≥ 22.13), kitaip gausi netikras klaidas.
3. Nauja užduotis = nauja gija; perdavimą rašyk į Issue #1 prieš pasiekiant ~90 % kvotos.

## Kitas žingsnis

Peržiūrėti PR #31 (17 adapterių) su Node 22: patikrinti, kad rutininis rinkimas veikia be modelio ir suvestinė trumpa. Žr. [PR #31](https://github.com/nojusdr-lab/globis/pull/31).
