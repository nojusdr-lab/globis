# 0001. Backend: Supabase (ES, Frankfurtas)

Data: 2026-11-18 · Būsena: priimta (savininkas sukūrė projektą 2026-11-17)

## Kontekstas

Programėlei reikia serverio, kuris laikytų prieglaudų skelbimus (kasdien atnaujinamus scraperių) ir neprivalomų paskyrų išsaugotų sąrašus. Reikalavimai: ES duomenų centras (BDAR), nemokamas planas pradžiai, Postgres, eilučių lygio teisės (RLS).

## Svarstyti variantai

| Variantas | Už | Prieš |
|---|---|---|
| **Supabase** | Postgres + RLS + Auth vienoje vietoje, Frankfurto regionas, schema jau buvo repo (`supabase/migrations`) | Nemokamas projektas užmiega po 7 d. be veiklos; laiškų šablonų be SMTP keisti negalima |
| Appwrite Cloud | Frankfurtas, 75K MAU nemokamai | Ne Postgres, reikėtų perrašyti schemą ir publikavimo apsaugas |
| Nhost | Postgres + Hasura | Mažiau patikrintų ribų, ES regiono sąlygos neaiškios |
| Savas VPS (PocketBase) | Pilna kontrolė | Atsarginės kopijos, atnaujinimai ir saugumas mūsų rankose |

## Sprendimas

Supabase, regionas Central EU (Frankfurt). Programėlė skaito tik viešą `published_animals` per anon raktą; rašo tik CI scraperis per `SUPABASE_DB_URL`. Paskyros: el. paštas + slaptažodis, lentelė `saved` su RLS `auth.uid() = user_id`.

## Pasekmės

- Kasdienis rinkimas palaiko projektą aktyvų, todėl jis neužmigs.
- Skelbimų duomenis visada galima atkurti iš scraperių; vertingi tik paskyrų duomenys (`auth.users`, `saved`).
- Atsarginės kopijos: nemokamame plane savininkas turi patikrinti Database → Backups, kas prieinama. Kol paskyrų mažai, priimtina; prieš viešą leidimą verta Pro planas (dienos kopijos) arba savaitinis `pg_dump` į privačią vietą.
- Laiškai: be savo SMTP Supabase siunčia tik kelis laiškus per valandą ir šablonų keisti neleidžia. „Pamiršau slaptažodį“ paslėptas, kol bus SMTP (pvz. Resend su savu domenu).
- Nemokamo plano ribos (500 MB DB, 50K MAU) stebimos CI santraukoje.
