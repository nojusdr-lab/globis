# GLOBIS kelias iki pirmojo leidimo

Būsena patikrinta 2026-11-19. Bazė yra `main` ties `62442db`.
Serverio integracija ir papildomi programėlės pakeitimai yra [PR #38](https://github.com/nojusdr-lab/globis/pull/38).
Rinkimo peržiūros pataisa yra [PR #40](https://github.com/nojusdr-lab/globis/pull/40).
[Vaizdinis kelrodis](../roadmap.html) rodo tą pačią etapų seką.

## Kur esame

**Dabar užbaigiame serverio integracijos patikimumą ir peržiūrą prieš beta bandymus.**
Kodo patikra, migracijos gyvoje DB, bandymas telefone ir viešas leidimas yra atskiri priėmimo žingsniai.

| Etapas | Kas paruošta | Ko dar reikia |
| --- | --- | --- |
| A. Duomenys | Main turi tiesioginių svetainių adapterius, validavimą, paskutinės geros kopijos apsaugą ir kasdienį rinkimą su duomenų PR. PR #38 turi 19 adapterių ir laukų patobulinimus. | PR #40 peržiūra, naujo rinkinio peržiūra, likusių prieglaudų kontaktų ir šaltinių teisių patikra. |
| B. Serveris — vykdoma | PR #38 turi įkėlimą į Supabase, viešo skaitymo kelią ir vietinį atsarginį rinkinį. SQL ir integracija tikrinami vietiniais testais. Naujas PR #38 commit 6a3934a prideda šifruotų atsarginių kopijų eigą, kuri dar laukia konfigūracijos ir atkūrimo patikros. | Užbaigti PR #38, suderinti migracijas su veikiančia DB, patikrinti serverio atsakymą programėlėje, TLS ir atsarginių kopijų konfigūraciją bei priėmimą gyvoje aplinkoje. Publikavimo chronologijos, sertifikatų tikrinimo ir testinės kopijos atkūrimo kodas papildytas šiame PR. |
| C. Programėlės patikra | Naršymas, filtrai, profiliai, kontaktai, išsaugojimas ir LT / EN įgyvendinti. Expo eksportas tikrinamas CI. PR #38 papildomai turi įvadą ir pasirenkamas paskyras. | Patikra iPhone ir Android, interneto praradimas, pakartotinis paleidimas, didelis šriftas, ekrano skaitytuvas ir paskyrų būsenos, jei jos įjungiamos. |
| D. Leidimo duomenys | Yra privatumo, naudojimo sąlygų, ikonų ir parduotuvių aprašymų ruošiniai. | Tikri valdytojo duomenys, palaikymo kontaktas, viešas privatumo URL, turinio bei nuotraukų naudojimo pagrindas ir programėlės identifikatorių sprendimas. |
| E. Uždara beta | Yra EAS build profiliai. | Patvirtintos paskyros ir projekto tapatybė, pasirašyti build’ai, TestFlight / Google Play vidinis bandymas, testuotojų atsiliepimai. |
| F. Viešas leidimas | Pasiruošimas tęsiamas etapais A–E. | Patvirtinti testų rezultatai, galutiniai privatumo formų atsakymai ir savininko leidimas paskelbti. Web kanalas pasirenkamas atskirai. |

## Artimiausi darbai pagal eilę

1. **PR #38 patikimumas.** Kiekvieno lygiagretaus darbo DB rezultatas turi priklausyti savo šaltiniui. Nepilnas ar atmestas rinkimas turi rodyti nesėkmę. DB sutrikimo atveju turi išlikti vietinis rinkimas ir patikrinama ataskaita. Tikrinti vietiniais adapteriais ir integraciniais testais.
2. **PR #38 ir #40 peržiūra.** Patikrinti jų bendrą kopiją, migracijų seką ir CI. Prieš jungiant patikrinti naujausią main bei Claude commitus. Esamus duomenų PR #37 ir #39 peržiūrėti pagal jų rinkimo ataskaitas.
3. **Serverio ir atsarginės kopijos patikra.** Paruošta nauja migracija `20261119000000_source_publication_order.sql`, tikrinami senesni ir pakartoti paleidimai. Node klientai naudoja TLS sertifikato patikrą su pasirenkamu `SUPABASE_DB_CA_CERT`. Realus konkurencijos ir šifruotos kopijos atkūrimo testas įtrauktas į CI su laikinu PostgreSQL.  Patikrinti TLS, migracijų būseną, viešo skaitymo ribas, duomenų pilnumą, atkūrimą po ryšio nutrūkimo ir tai, kad ankstesnis paleidimas negali pakeisti naujesnio. Gamybinė migracija atliekama tik patvirtinus konkretų pakeitimą.
4. **Native beta patikra.** iPhone ir Android scenarijai su realiais ekranais, save / restart / undo, šaltinio ir kontakto atidarymu, tuščiomis bei klaidų būsenomis. Rezultatus fiksuoti su platforma ir build versija.
5. **Leidimo vartai.** Užpildyti tikrais duomenimis `supportEmail` ir `privacyPolicyUrl`, patvirtinti turinio naudojimą bei bundle ID. Tada ruošti pasirašytą vidinės beta build’ą ir jo pateikimo peržiūrą.

## Kas šiuo metu patikrinta kode

- PR #38 `src/data/directPets.json` turi 1 061 įrašą. Tai įtaisytos kopijos dydis, o ne garantuotas šiuo metu ieškančių namų gyvūnų skaičius.
- `src/data/shelters.json` turi 37 organizacijas. 20 jų turi telefono arba el. pašto duomenis su `contactEvidence`.
- `app.json` `supportEmail` ir `privacyPolicyUrl` tebėra `null`.
- `com.myliutave.app` yra dabartinis iOS ir Android identifikatorius. EAS projekto ID konfigūracijoje nėra.
- Migracijų failų buvimas repozitorijoje savaime nepatvirtina jų pritaikymo gyvoje DB.
- `docs/store/preflight.md` ir `docs/security-audit.md` aprašo ankstesnius patikros etapus. Jų išvadas reikia sutikrinti su PR #38 paskyromis, DB integracija ir pasirinktų šaltinių turiniu.

## Darbo taisyklės

„Claude Code“ vadovauja įgyvendinimui. „Codex“ prisideda atskiroje vietinėje šakoje ir rezultatus perduoda per [Issue #1](https://github.com/nojusdr-lab/globis/issues/1) bei susijusį PR. Nekeisti main tiesiogiai. Esamą darbą tęsti nuo aktualaus commito ir jo priėmimo kriterijų.

Mokamos paslaugos, išorinės paskyros, gamybinės migracijos ir viešas deployment reikalauja savininko leidimo konkrečiam paruoštam rezultatui. Įprasti kodo taisymai, vietiniai testai ir PR vykdomi savarankiškai.

Įvaikinimo paraiškos [#20](https://github.com/nojusdr-lab/globis/issues/20), išplėstos paskyrų rolės [#19](https://github.com/nojusdr-lab/globis/issues/19), pranešimai ir Globis AI [#21](https://github.com/nojusdr-lab/globis/issues/21) planuojami pagal atskirus priėmimo kriterijus.
