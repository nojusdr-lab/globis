# Discovery Engine B1

## Lietuva gyvūnams adapteris

`lietuva-gyvunams.cjs` skaito viešą „Lietuva gyvūnams“ katalogą (WordPress REST, kategorija „Ieško namų“). Prieš tai patikrina `robots.txt`, tarp užklausų laukia 2 s, kreipiasi tik į tą pačią svetainę. Svetainėje nėra lyties, dydžio ar rūšies laukų, todėl jie lieka `null`. Bet kokia klaida ar įrašų skaičiaus neatitikimas atmeta visą paleidimą. Adapteris tik atspausdina JSON ir nieko nerašo į programėlės duomenis.

```sh
node --test scripts/discovery-engine/lietuva-gyvunams.test.cjs   # be tinklo
node scripts/discovery-engine/lietuva-gyvunams.cjs               # tikras skaitymas
```

GitHub: Actions → „Collect Lietuva gyvunams (preview only)“ → Run workflow. Rezultatas pridedamas kaip failas peržiūrai.

## C1. Meta Page adapterio karkasas

Žr. [rankinį patvirtinimo planą](meta-setup.md). Vietiniam bandymui:

```sh
node --test scripts/discovery-engine/meta-adapter.test.cjs
node --test scripts/discovery-engine/*.test.cjs
```

Naudojamas tik `fixtures/meta.synthetic.json` ir jo testinės variacijos. Joks Meta App, prieigos raktas ar tinklo jungtis šiai komandai nereikalingi.

## B2. Vietinio sintetinio failo importas

```sh
node scripts/discovery-engine/file-demo.cjs
node --test scripts/discovery-engine/*.test.cjs
```

Demo vienu metu apdoroja trijų fiktyvių organizacijų įrašus per bendrą worker pool. Failo adapteris vykdo tik vietines operacijas. Tikram organizacijos failui reikės atskiro patvirtinto duomenų ir nuotraukų naudojimo sprendimo.

`enqueueFile(queue, {path, source, org})` skaito įprastą vietinį failą (iki 1 MiB ir 5000 įrašų). Prieš tai registruokite fiktyvų šaltinį per `queue.register` ir konkrečiam Source nustatykite `queue.authorizeSyntheticFile({source, allowed:true, expires, evidence})`. `expires` yra Unix milisekundės, o `evidence` – sintetinio failo kilmės nuoroda ar aprašas. Leidimo versija susiejama su importo paketu. Atšaukus, pakeitus ar pasibaigus sprendimui, senas paketas nebegali gauti darbų, rašyti rezultatų ar būti paskelbtas. Ankstesnė patvirtinta kopija išlieka. Šis leidimas skirtas sintetiniams pavyzdžiams.

CSV schema pateikta `fixtures/synthetic.csv`. JSON priima to paties modelio objektų masyvą. Privalomi `nativeListingId` ir `sourceUrl`. Pasirinktiniai `name`, `status` (active, reserved, unknown), `vaccinated` (true, false), `photoUrl` ir `sourceUpdatedAt` (UTC YYYY-MM-DDTHH:mm:ssZ). Trūkstami laukai lieka null. URL turi būti HTTPS su fiktyviu `.invalid` domenu. Observacijos kilmę nurodo failo vardas, SHA-256 ir loginis įrašo numeris, įskaitant kelių eilučių CSV laukus. `observedAt` fiksuojamas priimant paketą ir nekinta kartojant darbus.

Vienodi failo baitai toje pačioje šaltinio leidimo versijoje sudaro tą patį Run. Workeriai validuoja įrašus, o `publishPreview` patikrina visą paketą ir atmeta dubliuotus ID. Nauja kopija pakeičia ankstesnę tik po pilnos validacijos. Dingę skelbimai nepažymimi kaip įvaikinti.

Vietinis [Issue #6](https://github.com/nojusdr-lab/globis/issues/6) prototipas pagal [fazės A ADR](https://github.com/nojusdr-lab/globis/pull/5). Reikia Node 22.13+ su integruotu `node:sqlite`. CI tikrina Node 22.13.0 ir 26. Papildomų paketų nereikia.

```sh
node scripts/discovery-engine/demo.cjs
node --test scripts/discovery-engine/queue.test.cjs
```

Pagal nutylėjimą demo naudoja SQLite atmintyje. Jei reikia išsaugoti eilių bei bandymų istoriją, perduokite vietinį failą, pvz. `node scripts/discovery-engine/demo.cjs /tmp/globis-b1.sqlite`. Kiekvienas paleidimas sukuria naują bandymų rinkinį. Naudokite atskirą failą demonstracijai. `worker-1: A → B` eilutė rodo, kad tas pats vykdytojas perėmė kitos organizacijos užduotį. A ir B dalijasi fiktyviu domenu. C pirmas bandymas suplanuotai nepavyksta ir pakartojamas. A paliktas darbas perimamas su didesniu token.

- `queue.cjs` kuria SQLite schemą. `BEGIN IMMEDIATE` saugo claim, renew, complete, fail ir preview publikavimą tarp atskirų DB jungčių. Viena registracija apibrėžia organizaciją, šaltinį ir prieigos sprendimą.
- `workers.cjs` paleidžia tris asinchroninius vykdytojus pagal nutylėjimą. Jie yra asinchroninės Node funkcijos, o ne DI modeliai. Vykdytojas nutraukia fiktyvų darbą praradęs lease. DB klaida heartbeat metu grąžinama per pool pažadą, paliekant darbą perėmimui.
- `demo.cjs` pateikia trijų fiktyvių organizacijų demonstraciją su 7, 2 ir 3 įrašais.
- `queue.test.cjs` tikrina dvi SQLite jungtis, perėmimą, pasenusio token atmetimą, teisingą planavimą, bendrą domeno kvotą, retry, validaciją ir prieigos ribas.

Eilė gali pakartoti vykdymą po avarijos. Tik dar galiojantis token gali patvirtinti rezultatą. Run apimtis uždaroma vienoje transakcijoje pridedant visus darbus. Užduoties raktas unikalus Run ribose. Po keturių nesėkmių darbas pažymimas dead. publishPreview grąžina dead_jobs su nepavykusių darbų raktais. Preview keičiamas tik jei visos užduotys baigtos, observacijos validžios, ID nesikartoja ir versija naujesnė. Nežinomas požymis saugomas kaip null. Visi tinklo darbai blokuojami B1, įskaitant patvirtintus. `.invalid` adresai žymi fiktyvią kilmę, jokia užklausa nevykdoma.

B1 yra vienos vietinės SQLite DB prototipas. Domeno „slot“ galioja iki lease pabaigos, jo parametrai turi sutapti tarp vykdytojų. Numatytasis limitas 1. Tarp užduočių galimas papildomas konfigūruojamas tarpas. Retry laikas trumpas demonstracijai, daugiausia keturi bandymai. Stebėsenai šiame etape naudojami CLI ir SQLite bandymų įrašai. Nėra realių adapterių, tinklo kliento, puslapiavimo ar tarpšaltininio identiteto sprendimo. Kitas žingsnis B2 – pradėti nuo vieno organizacijos pateikto failo, pridėti adapterio kontrakto testą ir prieigos įrodymą, tada išplėsti bandymą iki 2–3 patvirtintų kanalų.
