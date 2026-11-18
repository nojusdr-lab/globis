# Duomenų bazės atsarginės kopijos

Nemokamas Supabase planas kopijų nedaro. Tai daro `.github/workflows/db-backup.yml`: kasdien 03:37 UTC (po rinkimo), kopija laikoma 14 dienų Actions → „Database backup“ → Artifacts.

Repo viešas, todėl kopija užšifruota. Kad veiktų, savininkas vieną kartą prideda secret `BACKUP_PASSPHRASE` (Settings → Secrets and variables → Actions). Slaptažodį laikyk slaptažodžių tvarkyklėje: be jo kopijos neatidaromos. Kol secret nėra, darbas praleidžiamas su įspėjimu.

Kopijoje: visa `public` schema (lentelės ir eilutės, tarp jų `saved`) ir `auth.users` eilutės. Nėra: Supabase Storage failų, kitų `auth` lentelių (sesijos, tapatybės), nustatymų.

## Atkūrimas

```
gpg -d globis-db-YYYY-MM-DD.tar.gz.gpg | tar -xz
psql "$SUPABASE_DB_URL" -f dump/auth-users.sql
psql "$SUPABASE_DB_URL" -f dump/public.sql
```

Pirma `auth-users.sql`, nes `saved.user_id` rodo į `auth.users`. `public.sql` kuria lenteles, todėl į tuščią projektą be migracijų. Prieš atkuriant į veikiančią DB pasitark: tai perrašo duomenis.
