# Šifruotos DB kopijos ir atkūrimo patikra

PR #38 paruošta `.github/workflows/db-backup.yml` eiga kasdieniam paleidimui 03:37 UTC. Ji įsigalioja sujungus PR į main ir patikrinus konfigūraciją. Šifruotas artefaktas laikomas 14 dienų.

## Konfigūracija

GitHub Actions konfigūracijai reikia `SUPABASE_DB_URL`, `SUPABASE_DB_CA_CERT` ir `BACKUP_PASSPHRASE`. CA sertifikatas gaunamas iš to Supabase projekto Database settings. Node klientai tikrina sertifikatą ir vardą, o pg_dump naudoja `verify-full`. Slaptažodį laikyti slaptažodžių tvarkyklėje. Raktų ir slaptažodžių nerašyti į pokalbį ar repozitoriją.

Trūkstant konfigūracijos, eiga pateikia įspėjimą. Tai dar nepatvirtina turimos atsarginės kopijos. Reikia sėkmingo paleidimo, išsaugoto šifruoto failo ir atkūrimo patikros.

## Kopijos turinys

`scripts/scrapers/backup-dump.cjs` laiko vieną PostgreSQL eksportuotą snapshot, kol baigiami abu dump. Taip paskyrų eilutės ir jas nurodančios `saved` eilutės priklauso tai pačiai DB būsenai.

- `public.sql` turi programėlės schemą, duomenis, RLS ir prieigos grantus.
- `auth-users.sql` turi `auth.users` ir `auth.identities` duomenis. Identitetai reikalingi atkuriant ryšį su prisijungimo tiekėju.
- Supabase Storage failai, kitos auth lentelės, sesijos ir platformos nustatymai šiame rinkinyje neįtraukti. Atkuriant reikia atskiro paskyrų ir platformos konfigūracijos plano.
- Į Actions artefaktą įkeliamas tik AES-256 šifruotas archyvas. Kopijoje yra jautrių paskyrų duomenų, todėl slaptafrazė saugoma atskirai.

## Automatinė atkūrimo patikra

`Offline pet data integrity` CI turi `postgres-recovery` darbą su laikinu PostgreSQL 16 ir sintetiniais duomenimis. Jis:

1. Pritaiko visas migracijas atskiroje atsitiktinai pavadintoje testinėje DB.
2. Eksportavęs snapshot, įrašo papildomą paskyrą ir išsaugojimą. Atkurtoje kopijoje šių vėlesnių eilučių turi nebūti.
3. Sukuria dump, užšifruoja, iššifruoja ir atkuria į kitą naują testinę DB.
4. Tikrina paskyrą, identitetą, išsaugojimą, viešą skelbimų skaitymą ir draudimą anon vartotojui skaityti paskyros pasirinkimus.

Testas priima tik localhost / 127.0.0.1 `globis_test` jungtį ir kuria savo laikinas DB. Vietinis `npm test` šį testą praleidžia, kai `GLOBIS_TEST_DATABASE_URL` nenurodytas. Tai atskirai rodoma testų rezultate.

## Tikros sistemos atkūrimas

Pirmiausia pasirenkamas atskiras atkūrimo taikinys ir patikrinamos versijos, rolės, auth schema, kopijos data bei aprėptis. Auth duomenys atkuriami prieš public, nes `saved.user_id` priklauso nuo `auth.users`. Vykdymas turi sustoti ties pirmąja SQL klaida ir vykti vienoje transakcijoje.

Į veikiančią Supabase DB šių failų tiesiogiai nevykdyti. Tikram taikiniui parengiamas atskiras planas, saugant esamus duomenis ir Supabase valdomas schemas. Savininkas patvirtina konkretų atkūrimą po bandomojo atkūrimo rezultatų.

Oficialūs šaltiniai. [Supabase backup ir restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [SSL patikra](https://supabase.com/docs/guides/database/connecting-to-postgres).
