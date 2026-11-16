# Pakartojamas šaltinio prijungimas ir importo peržiūra

Šiame etape realių duomenų ir nuotraukų rinkimui patvirtinto šaltinio nėra. Globok ir Meta transportas lieka išjungti. Toliau pateiktas veikiantis offline demonstracinis kelias naudoja tik sintetinius `.invalid` URL. Jis nekeičia `src/data`, nepaskelbia duomenų vartotojams ir nesukuria automatinio PR.

## Sintetinio CSV / JSON peržiūra

Node >=22.13.0. CSV stulpelius ir JSON schemą aprašo `scripts/discovery-engine/README.md`. Panaudojamas esamas failų adapteris ir bendras worker pool.

```sh
node scripts/discovery-engine/review-cli.cjs import /tmp/globis-review.sqlite scripts/discovery-engine/fixtures/synthetic.csv 4
node scripts/discovery-engine/review-cli.cjs status /tmp/globis-review.sqlite
# Paimti konkrečią versijos SHA iš status išvesties:
node scripts/discovery-engine/review-cli.cjs restore /tmp/globis-review.sqlite VERSION_SHA "Peržiūrėta grąžinimo priežastis"
```

Paskutinis importo argumentas yra peržiūrinčio operatoriaus laukiamas įrašų kiekis, ne iš realaus katalogo HTML išvestas pilnumo įrodymas. Nepilni, nebaigti, dubliuoti ir ankstesnius ID praradę paketai atmetami. Dingęs įrašas nevirsta įvaikinimu. Stebėjimo laikas negali regresuoti. Pakartotinai pateiktas tas pats failas yra no-op. SQLite transakcija atomariškai įrašo nekintamą versiją, dabartinės versijos rodyklę ir sėkmės įvykį. Nutrūkimas iki COMMIT palieka ankstesnę kopiją. Klaidos ir atmetimo priežastys matomos `status`; atkūrimas reikalauja konkrečios tos pačios šaltinio versijos ir priežasties. DB failą laikyti vietoje, nedėti į Git.

Jei tam pačiam skelbimui pateikiama kita būsena su tuo pačiu stebėjimo laiku, visas paketas atmetamas ir dabartinė versija išsaugoma. Būsenai pakeisti reikia naujesnio stebėjimo.

## Kitos prieglaudos prijungimo kontrolė

1. Peržiūrėti registro tapatybę ir priskirti stabilų organizacijos ID. Registro eilutės numeris ir bendras Facebook puslapis nėra organizacijos ID.
2. Dokumentuoti oficialų šaltinį, duomenų bei nuotraukų naudojimo leidimus, leistiną apimtį, sprendimo įrodymą ir galiojimą. Viešas URL nėra leidimas. Meta papildomai reikia patvirtintos API prieigos konkrečiam Page ir tokeno; tokenai nekeliauja į Git.
3. Paruošti sintetinį fixture su aiškiomis nežinomomis reikšmėmis, rezervacija, tuščia nuotrauka ir klaidos atvejais. Patikrinti adapterio schemą, domeno ribojimą, stable ID, idempotency ir pilnumą. Dabartinis failų adapteris sąmoningai priima tik sintetinius URL; jo apribojimų negalima tiesiog pašalinti, kad būtų įjungtas realus šaltinis.
4. Po atskiros adapterio peržiūros atlikti vieną leidžiamą nuskaitymą su nepriklausomu pilnumo įrodymu, per-host limitais ir tikrais stebėjimo laikais. Palyginti su ankstesne kopija ir rankiniu būdu peržiūrėti kiekvieną būsenos / kontakto pokytį.
5. Patvirtintą kopiją siūlyti atskiroje šakoje per PR, išsaugant ankstesnį variantą ir atkūrimo procedūrą. Automatinio merge nėra. Šis demonstracinis store nėra gamybinio publikavimo paslauga ar pasirinktas backend.

Atskiri tolesni darbai: paskyrų ir autentifikacijos modelis; įvaikinimo paraiškų procesas su prieglaudų sutikimu; Globis AI ribos ir duomenų kokybės vertinimas; patvirtintas Meta transportas. Jiems reikia atskiro dizaino ir savininko sprendimo prieš išorinių paslaugų prijungimą.
