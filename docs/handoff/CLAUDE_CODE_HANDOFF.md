# GLOBIS · perdavimas į Claude Code

Būklė patikrinta 2026-11-16. Naujausią būseną rodo [GitHub](https://github.com/nojusdr-lab/globis).

## 1. Paleidimas

Reikia Git, Node.js 22.13 arba naujesnio ir [Claude Code](https://code.claude.com/docs/en/quickstart). Prisijunk prie savo Claude paskyros. GitHub rašymui naudok savo jau autorizuotą GitHub tapatybę. Jei turi `gh`, prieigą tikrink `gh auth status`.

Naujam vietiniam aplankui terminale paleisk:

```sh
git clone --branch chore/claude-code-handoff https://github.com/nojusdr-lab/globis.git globis-claude
cd globis-claude
claude
```

„Claude Code“ sesijoje paleisk `/globis-next`. Komanda perskaitys šio repo instrukcijas ir patikrins pirmą aktualų darbą. Jei peržiūros šaka vėliau sujungiama ir pašalinama, naudok `main`, kai joje yra `CLAUDE.md`.

Jei repo jau turi, su neišsaugotais pakeitimais dirbk atskirai. Saugi alternatyva esamame repo:

```sh
git fetch origin
git worktree add --detach ../globis-claude origin/chore/claude-code-handoff
cd ../globis-claude
claude
```

Ši šaka skirta darbo perdavimui. Funkcijų pakeitimams kurk kitą šaką nuo aktualaus `origin/main` arba deklaruotos priklausomo PR bazės.

## 2. Dabartinės šakos ir CI

`main` patikrintas ties `f638d3c0122ed623b216af7ad22badd3011bc123`. Discovery Engine SQLite B1, failų B2 ir sintetinis Meta C1 jau yra `main`. Visi toliau pateikti PR tikrinimo metu atviri. CI nuorodos rodo nurodytą commitą.

| PR | Paskirtis | Šaka | SHA | CI |
|---|---|---|---|---|
| [#3](https://github.com/nojusdr-lab/globis/pull/3) | P0 duomenų patikimumas ir pilnumo apsauga | `fix/p0-data-integrity` | `f7f53ad` | [Praėjo](https://github.com/nojusdr-lab/globis/actions/runs/43838803666) |
| [#5](https://github.com/nojusdr-lab/globis/pull/5) | VMVT inventorius ir prieigos būsenos | `docs/discovery-engine-phase-a` | `5db2f6d` | [Praėjo](https://github.com/nojusdr-lab/globis/actions/runs/43772351245) |
| [#16](https://github.com/nojusdr-lab/globis/pull/16) | Braukimas, atšaukimas, išsaugojimas | `feat/persistent-discovery` | `aa9e7f3` | [Praėjo](https://github.com/nojusdr-lab/globis/actions/runs/43838800367) |
| [#17](https://github.com/nojusdr-lab/globis/pull/17) | Sintetinio importo peržiūra, istorija ir atkūrimas | `feat/reviewed-import-history` | `da960a0` | [Praėjo](https://github.com/nojusdr-lab/globis/actions/runs/43839520386) |
| [#18](https://github.com/nojusdr-lab/globis/pull/18) | Navigacija, bendri filtrai, profiliai | `feat/globis-mobile-experience` | `50ca328` | [Praėjo](https://github.com/nojusdr-lab/globis/actions/runs/43838805083) |
| [#22](https://github.com/nojusdr-lab/globis/pull/22) | Beta, iOS ikona ir pateikimo paruošimas | `chore/globis-beta-readiness` | `057c02a` | [Praėjo](https://github.com/nojusdr-lab/globis/actions/runs/43844528137) |

UX grandinė #3 → #16 → #18 → #22. Prieš keisdamas bazes patikrink faktinę šakų hierarchiją. #5 ir #17 nagrinėk atskirai. Trumpi SHA yra orientyrai. Prieš veiksmus naudok pilnus gyvus SHA.

## 3. Darbų eilė

1. [#24](https://github.com/nojusdr-lab/globis/issues/24). Paruošti „Lietuva gyvūnams“ katalogo adapterį su vietiniais sintetiniais HTML pavyzdžiais. Pasimatuoti pilną katalogą, dublius, lūžusį profilį, dingusį skelbimą ir grįžimą prie geros kopijos. Pradėti nuo vieno vykdytojo šiam domenui. Kandidato svetainė VMVT 55-oje eilutėje siejama su VšĮ „LT-GYVŪNAMS savanoriai“. Svetainėje nurodytas susijęs fondas. Kas suteikia skelbimų ir nuotraukų teises, turi patvirtinti organizacija.
2. [#23](https://github.com/nojusdr-lab/globis/issues/23). Patikrinti „Globok.lt“ eksporto schemą, apimtį ir teisių spragas. Viešas CC BY 4.0 eksportas skirtas statistikos lentelėms. Atskirų skelbimų ir nuotraukų teises reikia patikrinti atskirai. Esamą CSV/JSON kelią vertinti pagal #17.
3. [#4](https://github.com/nojusdr-lab/globis/issues/4) ir [#12](https://github.com/nojusdr-lab/globis/issues/12). Patikrintas vieno autorizuoto šaltinio pilotas, duomenų kilmė, pilnumas, saugus atnaujinimas ir atkūrimas. VMVT inventoriuje yra 96 eilutės ir 0 patvirtintų rinkimo kanalų. 96 eilutės nėra lygiagretumo nustatymas. Darbuotojų telkinio dydį rinkti pagal matavimus ir domenų ribas. Esamas Meta C1 vykdomas su sintetiniais pavyzdžiais.
4. Kai aukštesnio prioriteto darbai užbaigti arba blokuojami, tęsti beta grandinę. Pasirašytam iOS kandidatui reikia patikrinti komandos tapatybę, pasirašymą, build numerius, fizinį įrenginį, parduotuvės ekranus, skelbimų teises, privatumo bei palaikymo URL. #22 turi `docs/app-store-submission.md`, `docs/release-readiness.md`, `docs/privacy.md` ir `docs/beta-check.md`. Galutinis leidimas priklauso savininkui.
5. Po beta darbai yra [#19 paskyros](https://github.com/nojusdr-lab/globis/issues/19), [#20 paraiškos](https://github.com/nojusdr-lab/globis/issues/20) ir [#21 „Globis AI“](https://github.com/nojusdr-lab/globis/issues/21).

## 4. Patikros

Discovery Engine patikros nuo main arba atitinkamo PR:

```sh
node --test scripts/discovery-engine/*.test.cjs
node scripts/discovery-engine/demo.cjs
node scripts/discovery-engine/file-demo.cjs
git diff --check
```

Nuo beta šakos:

```sh
npm ci
npm test
npm run check:data
npm run build
```

Prieš naudodamas naršyklės ar įrenginio rezultatą, patikrink tą konkretų build ir aplinką. #22 galerijos komponento patikra pavyko, o paskutinis pilnas naršyklės scenarijus šio darbo aplinkoje nepasileido. Native įrenginio ir pasirašyto leidimo patikros laukia.

## 5. Dizainas ir kontekstas

- Atskirame savininko pakete yra pilnas šio projekto Master Context, penki maketai, prototipo TSX ir šiltos paletės variantas. Privačią medžiagą laikyk vietoje ir neskelbk į repo be savininko sprendimo.
- Patvirtinta tapatybė yra originalus GLOBIS ženklas, `#245B46` ir baltas arba vėsus šviesus `#F5F8F7` fonas. Šilta paletė skirta eksperimentui. Maketai padeda pasirinkti kompoziciją. TSX prototipe yra demonstracinių duomenų ir neprodukcinės sąsajos logikos.
- Dabartinės programėlės naudojamų logotipo failų ieškok #18 ir #22. `Code_Generated_Image.png` yra žodinis ženklas, `Code_Generated_Image (1).png` yra ženklo failas, o #22 `assets/ios-app-icon.png` yra iOS variantas.
- Produktų sprendimams skaityk `GLOBIS_DECISIONS.md`. Datuotos senesnių dokumentų nuorodos į įrankius ir būsenas yra istorinės. Pasitikrink su gyvu repo ir savininko sprendimais.

## 6. Darbas debesyje ir perjungimas

- [Claude Code debesies aplinka](https://code.claude.com/docs/en/claude-code-on-the-web) naudoja Claude paskyrą ir autorizuotą GitHub repozitoriją. Šiai migracijai pasirink tik `nojusdr-lab/globis`. Darbo instrukcijoms sesijos bazė turi pasiekti šią GitHub šaką arba `main`, kai instrukcijos į jį įtrauktos. Vietinės nepridėtos bylos į debesies sesiją nepatenka.
- [Anthropic planuojami debesies darbai](https://support.claude.com/en/articles/14554000-claude-code-power-user-tips) konfigūruojami atskirai nuo vietinės sesijos. Prieš nustatant pasikartojimą, vienu ribotos apimties debesies bandymu patikrink prisijungimą, šaką, testus, commitą, draft PR ir CI. Jei paskyra siūlo `/schedule`, periodiniam darbui nurodyk šiame dokumente numatytą eilę ir ne daugiau kaip vieną ištestuotą pakeitimą per paleidimą.
- Prieš įjungdamas naują rašančią automatiką, sustabdyk seną „GLOBIS vystymas“ rašymo eigą, kad dvi sesijos nepradėtų tos pačios užduoties. Šio paketo paruošimo metu Claude paskyra, jos debesies sesija ir planuoklis nekonfigūruoti.
- GitHub jungtis, paskyrų sesijos, aplinkos paslaptys, Meta autorizacija, Apple pasirašymas ir pokalbių istorija šiame kode nesaugomi. Prieigas tvarkyk per atitinkamą paslaugą.
