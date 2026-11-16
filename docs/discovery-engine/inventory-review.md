# VMVT inventoriaus interpretavimas

`vmvt-guardian-inventory.tsv` yra istorinė rankiniu būdu peržiūrėta registro transkripcija, ne dabartinio aktyvių prieglaudų skaičiaus įrodymas. 96 registro eilutės nėra 96 organizacijų tapatybių deduplikavimo rezultatas. Eilutės numeris yra šios transkripcijos pozicija, ne nekintamas organizacijos ID. Registro būsena `unknown` nereiškia aktyvumo ar patvirtinimo.

Paskirties URL skaičiuojami atskirai: 95 eilutės su bent viena nuoroda, 96 nuorodų egzemplioriai (40 svetainių ir 56 Facebook), viena eilutė turi du kanalus. Vienodas URL keliose eilutėse gali reikšti bendrą kanalą; tai nėra leidimas sujungti organizacijas. `vmvt_link_label` yra registro nuorodos tekstas, `channel_types` nustatomas pagal tikrą URL. Nuorodos paskelbimas registre nepatvirtina paskirties svetainės, jos duomenų ar nuotraukų naudojimo teisių.

`access_gate` yra konservatyvi eilutės santrauka, ne visų jos kanalų leidimas. Mišrioje eilutėje Facebook ir svetainės leidimai tikrinami nepriklausomai. `node scripts/discovery-engine/vmvt-inventory.cjs` offline sukuria peržiūros JSON su kiekvienos nuorodos tipu, atskira prieigos būsena ir nepatvirtintomis duomenų bei nuotraukų teisėmis. Patvirtintų automatinių kanalų: 0. Komanda nieko nesiunčia į paskirties svetaines ir nekeičia registro.

Prieš prijungiant šaltinį operatorius turi patvirtinti tikrą organizacijos ID, registro tapatybę ir aktualumą, oficialų kanalą, duomenų bei nuotraukų naudojimo pagrindą, prieigos apimtį ir galiojimo laiką. Inventoriaus peržiūra savaime nesuteikia adapteriui `approved` sprendimo.
