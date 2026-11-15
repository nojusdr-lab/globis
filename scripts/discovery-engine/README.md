# Discovery Engine B1

Vietinis [Issue #6](https://github.com/nojusdr-lab/globis/issues/6) prototipas pagal [fazės A ADR](https://github.com/nojusdr-lab/globis/pull/5). Reikia Node 22.13+ su integruotu `node:sqlite`. Patikrinta su Node 26.13.1. Papildomų paketų nereikia.

```sh
node scripts/discovery-engine/demo.cjs
node --test scripts/discovery-engine/queue.test.cjs
```

Pagal nutylėjimą demo naudoja SQLite atmintyje. Jei reikia išsaugoti eilių bei bandymų istoriją, perduokite vietinį failą, pvz. `node scripts/discovery-engine/demo.cjs /tmp/globis-b1.sqlite`. Kiekvienas paleidimas sukuria naują bandymų rinkinį. Naudokite atskirą failą demonstracijai. `worker-1: A → B` eilutė rodo, kad tas pats vykdytojas perėmė kitos organizacijos užduotį. A ir B dalijasi fiktyviu domenu. C pirmas bandymas suplanuotai nepavyksta ir pakartojamas. A paliktas darbas perimamas su didesniu token.

- `queue.cjs` kuria SQLite schemą. `BEGIN IMMEDIATE` saugo claim, renew, complete, fail ir preview publikavimą tarp atskirų DB jungčių. Viena registracija apibrėžia organizaciją, šaltinį ir prieigos sprendimą.
- `workers.cjs` paleidžia tris asinchroninius vykdytojus pagal nutylėjimą. Jie dalijasi organizacijų eile, atnaujina lease ir naudoja tik fiktyvių užduočių adapterį.
- `demo.cjs` pateikia trijų fiktyvių organizacijų demonstraciją su 7, 2 ir 3 įrašais.
- `queue.test.cjs` tikrina dvi SQLite jungtis, perėmimą, pasenusio token atmetimą, teisingą planavimą, bendrą domeno kvotą, retry, validaciją ir prieigos ribas.

Eilė gali pakartoti vykdymą po avarijos. Tik dar galiojantis token gali patvirtinti rezultatą. Run apimtis uždaroma vienoje transakcijoje pridedant visus darbus. Užduoties raktas unikalus Run ribose. Preview keičiamas tik jei visos užduotys baigtos, observacijos validžios, ID nesikartoja ir versija naujesnė. Nežinomas požymis saugomas kaip null. Visi tinklo darbai blokuojami B1, įskaitant patvirtintus. `.invalid` adresai žymi fiktyvią kilmę, jokia užklausa nevykdoma.

B1 yra vienos vietinės SQLite DB prototipas. Domeno „slot“ galioja iki lease pabaigos, jo parametrai turi sutapti tarp vykdytojų. Numatytasis limitas 1. Tarp užduočių galimas papildomas konfigūruojamas tarpas. Retry laikas trumpas demonstracijai, daugiausia keturi bandymai. Stebėsenai šiame etape naudojami CLI ir SQLite bandymų įrašai. Nėra realių adapterių, tinklo kliento, puslapiavimo ar tarpšaltininio identiteto sprendimo. Kitas žingsnis B2 – pradėti nuo vieno organizacijos pateikto failo, pridėti adapterio kontrakto testą ir prieigos įrodymą, tada išplėsti bandymą iki 2–3 patvirtintų kanalų.
