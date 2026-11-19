# Rinkiklių vykdymas ir kokybė

## 2026-11-19 patikra

Oficialus [VMVT puslapis](https://vmvt.lrv.lt/lt/veiklos-sritys/gyvunu-gerove/gyvunu-augintiniu-gerove/reikalavimai-gyvunu-globejams-ir-globos-namams/gyvunu-globeju-sarasas/) patikrintas iš naujo. Inventorius turi 96 eilutes, 95 su nuoroda; 27 eilutė – neveikiantis LGGD Vilniaus skyrius. Tai registro eilučių skaičius, ne patvirtintas 95 veikiančių įvaikinimo svetainių skaičius.

Izoliuotoje vietinėje kopijoje gyvai užbaigti 19 įjungtų adapterių. Pradinė kopija: 1404 įrašai. Kiekvienas įrašas turi ID, originalų šaltinio URL, stebėjimo laiką ir struktūros patikros rezultatą. Mažeikių API 98 įrašams pridėtas tikras prieinamumo įrodymas `adoptable: true`. „Penkta koja“ atvejui `featured_media=0` pridedamas galerijos skaitymas iš to paties gyvūno puslapio; bendras svetainės logotipas netinka.

Pakartotas „Penktos kojos“ gyvas rinkimas iš galerijų atkūrė 18 trūkusių pagrindinių nuotraukų (iš 19 liko 1 be nuotraukos). Atskirai patikrintos 22 neįjungtų svetainių viešos pradinės nuorodos: 13 pasiekiamų, 9 neprieinamos šiuo leidžiamu būdu (įskaitant ankstesnę `no_listing` 404 nuorodą). Užklausų laikai / HTTP / hash ir konservatyvi šios patikros apimtis pateikti [šaltinių patikros įraše](source-review-2026-11-19.json). Pasiekiamas pagrindinis puslapis neįrodo gyvūnų sąrašo ar naudojimo leidimo.

Galutinė [gyvos patikros suvestinė](verification-2026-11-19.json): 1404 įrašai, 0 struktūros klaidų; patikrintos visų įrašų pagrindinės nuotraukos, 1399 pasiekiamos, 5 nepateiktos šaltiniuose. Iš viso atkurta 24 galerijų nuotraukos: 18 „Penkta koja“, 4 „Keturkojo viltis“, 1 „SOS gyvūnai“, 1 Utenos draugija. Ištaisytas parseris po pakartotų gyvų rinkimų atgavo 32 aiškiai tekste buvusius sveikatos faktus. 27 „Beglobio“ įrašai vis dar turi HTTP nuotraukų nuorodas; HTTPS robots / puslapio gavimas nepavyko, todėl saugus transportas neišgalvojamas. Penkiems likusiems įrašams svetimų gyvūnų ar logotipų nepriskiriame. 604 įrašai turi bent vieną įspėjimą apie trūkstamą ar neaiškią informaciją; tai nėra 604 netaisyklingi įrašai.

Likusių eilučių priežastys iš pradinės patikros:

| Būsena | Eilutės |
|---|---:|
| Įjungti svetainių adapteriai | 19 |
| Tik socialinis kanalas, neprijungtas autorizuotas gyvūnų srautas | 49 |
| Gyvūnų įvaikinimo sąrašo nerasta / svetainė skirta kitai paslaugai | 13 |
| Svetainė nepasiekiama | 8 |
| Sustabdyta dėl sąlygų ar priežiūros darbų | 2 |
| Robots / naudojimo sąlygų ribojimas | 2 |
| Atskiras ankstesnis LT-GYVŪNAMS rinkiklis | 1 |
| Tas pats URL kitoje registro eilutėje; tapatybė nepatvirtinta | 1 |
| Veiklos nevykdo | 1 |

39 ir 62 eilutės nurodo `padekman.lt`; vienodas adresas neleidžia abiem organizacijoms priskirti tų pačių gyvūnų. `sources.json` išsaugo prieigos sprendimus; inventoriaus įrašas nesuteikia turinio ar nuotraukų licencijos. Šiame pakeitime naujų Facebook gyvūnų užklausų nėra. Prisijungimo siena neapeinama. Pataisytas profilio parseris nebelaiko lietuviško prisijungimo teksto organizacijos vardu, mišri VMVT eilutė nesujungia dviejų URL į vieną užklausą.

## Kas automatizuota

`npm run scrape:service -- /absoliutus/kelias` paleidžia vietinį Node procesą. Jis kas **120 sekundžių** perskaito šaltinių sprendimus, patikrina eilę, pradeda laisvus darbus ir atnaujina kiekvieno įrašo bei viso registro ataskaitą. Tai įprastas kodas: vykdymas nekviečia Claude, Codex ar kitų modelių, todėl nepriklauso nuo jų tokenų kvotų.

Vienas bendras iki 4 worker'ų pool perima kitą organizaciją, kai baigia ankstesnę. SQLite transakcijos ir darbo tokenai neleidžia dviem procesams paimti tos pačios organizacijos ar pasenusiam darbui publikuoti rezultato. Vienu metu nedirba adapteriai su bendru deklaruotu domenu, įskaitant `www` aliasą. Darbo lease atnaujinamas kas 10 s; nutraukto proceso darbą galima perimti lease pasibaigus. Domeno HTTP klientas siunčia tik GET/HEAD, tik deklaruotiems hostams, tikrina robots, laukia mažiausiai 5 s arba ilgesnio Crawl-delay, turi laiko ir baitų ribas.

120 sekundžių yra **eilės ir kokybės tikrinimo intervalas**. Pilnas sėkmingos svetainės rinkimas kartojamas kas 6 valandas; jos pačios Crawl-delay ir daugybė detalių puslapių neleidžia žadėti visos svetainės perrinkimo kas 2 minutes. Nepavykę darbai laukia 2, 4, 8 min. ir toliau iki 6 val.; HTTP `Retry-After` gali pratęsti laukimą. Robots draudimo atveju bent para. Iš naujo paleidus procesą išlieka klaidos ir terminai. Jau patikrinta gera kopija inicializuoja eilę savo tikru stebėjimo laiku, ne paleidimo laiku.

`--once` palaukia visų šiuo metu priklausančių darbų ir baigia procesą. Vietinis vykdytojas nerašo į Supabase, `src/data`, GitHub ar `main`. Kasdienis GitHub workflow lieka atskiras: jo artefakte taip pat saugoma visų eilučių ir gyvūnų patikra. Vietiniam veikimui kompiuteris turi būti įjungtas ir nemiegoti; 24/7 serverio šis pakeitimas nediegia.

Po sėkmingo rinkimo service automatiškai patikrina pagrindines nuotraukas, naudodamas iki 6 val. galiojančius ankstesnius HTTP rezultatus. Jei pirmoji nebeveikia, jau šaltinyje esanti ir HTTP patikrinta alternatyva perkeliama į pirmą vietą; nuorodos neištrinamos. Neprieinamumas, trūkstama nuotrauka ir sveikas atsakymas ataskaitoje atskiriami. `--refresh=id1,id2 --once` gali paankstinti jau sėkmingo šaltinio rinkimą po parserio pataisos; negali dubliuoti vykdomo darbo, įjungti sustabdyto šaltinio ar apeiti klaidų backoff / Retry-After. Vienkartinio proceso būsena rašoma į `last-one-off-status.json`, kad nesugadintų veikiančio launch agent būsenos.

macOS paleidimui `node scripts/scrapers/launchd.cjs <absoliutus.plist> <absoliutus-vykdymo-katalogas>` tik paruošia `lt.globis.scrapers` konfigūraciją su konkrečiu Node ir repo keliu. Tik įdiegta į vartotojo `Library/LaunchAgents` ir sėkmingai paleista per `launchctl bootstrap` konfigūracija yra veikianti automatizacija. `launchctl print gui/$(id -u)/lt.globis.scrapers` parodo procesą; tikras `service-status.json.lastTick` pasikeitimas po 120 s patvirtina ciklą. Išjungimas: `launchctl bootout gui/$(id -u)/lt.globis.scrapers`. Failas ir procesas neturi raktų ar DB prisijungimo eilučių.

## Ataskaitos

Visi failai rašomi į pasirinktą vykdymo katalogą, ne į pokalbį:

| Failas | Reikšmė |
|---|---|
| `service-status.json` | Paskutinis / kitas ciklas, vykdomi darbai, klaidos, paskutinė sėkmė, kito rinkimo terminas |
| `coverage.md`, `coverage.json` | Kiekviena iš 96 VMVT eilučių su konkrečia būsena, kiekiu arba neprieinamumo priežastimi |
| `animals-audit.jsonl` | Kiekvienas publikuotas gyvūnas, šaltinis, patikros rezultatas ir įspėjimai |
| `<source>/validation.json` | Kiekvienas paskutinio bandymo kandidatas, įskaitant netaisyklingus / atmestus |
| `<source>/evidence.json` | Tikrų užklausų URL, HTTP būsena, stebėjimo laikas, teksto SHA-256; puslapių tekstų čia nėra |
| `<source>/published.json` | Paskutinė gera vietinė kopija |
| `<source>/last-run.json` | Paskutinis bandymas, jo pilnumas ir ar kopija publikuota |
| `<source>/image-health.json` | Kiekvieno gyvūno pagrindinės nuotraukos HTTP patikra; sveikas alternatyvus URL, jei rastas |
| `queue.sqlite` | Nuolatinė užduočių būsena; neįkelti į Git |

`npm run scrape:coverage -- /kelias` pakartoja struktūros patikrą be interneto. `npm run scrape:images -- /kelias` atskirai tikrina kiekvieno gyvūno pagrindinės nuotraukos HEAD atsakymą (nesiunčia vaizdų modeliui ir jų neatsisiunčia). Vienodi URL tikrinami vieną kartą; 404/410 atskiriami nuo neprieinamo ar HEAD nepalaikančio serverio. Tikrinami tik adapterio hostai ir aiškiai deklaruoti `photoHosts`. Jei pagrindinė nuotrauka nebeveikia, ieškoma jau šaltinyje buvusios alternatyvos; auditas originalo neištrina. Rinkimas, vietinis service ir nuotraukų auditas tame pačiame kataloge dalijasi `.http-gate.sqlite`: vienu metu viena HTTP užklausa domenui, bendras intervalas, ilgiausias matytas Crawl-delay ir Retry-After. Atskirų vykdymo katalogų užklausų ši vietinė DB nesujungia. Kokybės ciklas nuotraukų HTTP patikros kas dvi minutes nekartoja.

Nutrauktas nuotraukų auditas tęsiamas iš `image-health.json` ir jo `.checkpoint`; jau patikrintų nepakeistų URL užklausos nekartojamos, o pakeista pagrindinė nuotrauka tikrinama iš naujo. Užklausa atnaujina tikrą patikros laiką; cache pernaudojimas jo neapsimeta atnaujinęs.

Parserio cache biografijose taip pat pašalinami kontaktai, ne tik galutinėje gyvūno eilutėje. Senos cache kopijos išvalomos jas skaitant. Vietinio audito metu papildomai išvalyti jau buvę nesanitizuoti biografijų įrašai; raktų ar kontaktų tekstas į PR / pokalbį nekeliamas.

## Kada duomenys neskelbiami

Netinkamas ID, svetimas šaltinio hostas, pasikartojantis ID, būsena be įrodymo, nepilnas puslapiavimas, išimtis, nulinis rezultatas arba nepatvirtintas didelis sumažėjimas sustabdo naujos kopijos publikavimą. Senesnis stebėjimas negali perrašyti naujesnio. Pakartotas tas pats stebėjimas nėra naujas sumažėjimo patvirtinimas; nepilnas bandymas nutraukia trijų iš eilės pilnų patvirtinimų seką. Dingimas nėra įvaikinimo įrodymas.

Trūkstamas aprašymas, vardas, nuotrauka ar tekste minima neaiški savybė yra atskiras įspėjimas. Tai nėra dingusio gyvūno ar klaidingo fakto įrodymas. Pavyzdžiui, „Katino svajonė“ detalių puslapiuose yra faktų lentelė ir galerija, be istorijos teksto; „Šiaulių letenėlė“ dalį įrašų pavadina vietovėmis, ne vardais. Nei vardų, nei medicininių faktų iš to nekuriame. Atskiri neiginiai („ne kastruotas“) ir neaiškios frazės („nežinoma, ar paskiepytas“) negali tapti teigiamais sveikatos faktais.

Automatinės patikros įrodo struktūros, kilmės ir programos taisyklių laikymąsi. Jos negali patvirtinti, kad prieglauda pati nepamiršo atnaujinti senos gyvūno būsenos, arba nuspręsti svetainės vardu suteikti prieigos leidimą. Tokie šaltiniai nevadinami „tobulai sutvarkytais“. Savininkui nereikia tikrinti kiekvieno įrašo; techninės spragos atkuriamos iš ataskaitų ir adapterių testų, o prieigos trūkumas nurodomas organizacijos lygiu.

## Patikra ir perėmimas

`npm test` tikrina visus adapterių fixture, eilės konkurenciją ir perėmimą, backoff, per-domain ribas, seno darbo atmetimą, failo kopijos apsaugas, neiginius, nuotraukų fallback ir Facebook login sieną. Testai nekviečia gyvų svetainių. PostgreSQL konkurencijos / atkūrimo testas vykdomas atskirame CI konteineryje (PR #38). Gyvas patikrinimas atliekamas atskirai ir jo tikras laikas pateikiamas ataskaitose.

„Claude Code“ lieka pagrindinis kūrėjas. „Codex“ pagalbinio darbo būsena ir PR nuorodos perduodamos Issue #1. Nauji adapteriai jungiami po prieigos ir fixture patikros; main nekeičiamas tiesiogiai.
