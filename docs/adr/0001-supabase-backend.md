# 0001. Backend: Supabase (ES, Airija)

Data: 2026-11-18 · Būsena: priimta (savininkas sukūrė projektą 2026-11-17)

## Kontekstas

Programėlei reikia serverio, kuris laikytų prieglaudų skelbimus (kasdien atnaujinamus scraperių) ir neprivalomų paskyrų išsaugotų sąrašus. Reikalavimai: ES duomenų centras (BDAR), nemokamas planas pradžiai, Postgres, eilučių lygio teisės (RLS).

## Svarstyti variantai

| Variantas | Už | Prieš |
|---|---|---|
| **Supabase** | Postgres + RLS + Auth vienoje vietoje, ES regionas, schema jau buvo repo (`supabase/migrations`) | Nemokamas projektas užmiega po 7 d. be veiklos; laiškų šablonų be SMTP keisti negalima |
| Appwrite Cloud | Frankfurtas, 75K MAU nemokamai | Ne Postgres, reikėtų perrašyti schemą ir publikavimo apsaugas |
| Nhost | Postgres + Hasura | Mažiau patikrintų ribų, ES regiono sąlygos neaiškios |
| Savas VPS (PocketBase) | Pilna kontrolė | Atsarginės kopijos, atnaujinimai ir saugumas mūsų rankose |

## Sprendimas

Supabase, regionas West EU (Ireland, AWS `eu-west-1`; patikrinta 2026-11-20 pagal `db.<ref>.supabase.co` IPv6 adresą ir AWS IP sąrašą). Programėlė skaito tik viešą `published_animals` per anon raktą; rašo tik CI scraperis per `SUPABASE_DB_URL`. Paskyros: el. paštas + slaptažodis, lentelė `saved` su RLS `auth.uid() = user_id`.

## Pasekmės

- Kasdienis rinkimas palaiko projektą aktyvų, todėl jis neužmigs.
- Skelbimų duomenis visada galima atkurti iš scraperių; vertingi tik paskyrų duomenys (`auth.users`, `saved`).
- Atsarginės kopijos: nemokamame plane savininkas turi patikrinti Database → Backups, kas prieinama. Kol paskyrų mažai, priimtina; prieš viešą leidimą verta Pro planas (dienos kopijos) arba savaitinis `pg_dump` į privačią vietą.
- Laiškai: be savo SMTP Supabase siunčia tik kelis laiškus per valandą ir šablonų keisti neleidžia. „Pamiršau slaptažodį“ paslėptas, kol bus SMTP (pvz. Resend su savu domenu).
- Nemokamo plano ribos (500 MB DB, 50K MAU) stebimos CI santraukoje.

## Gyvo projekto patikra (2026-11-20, tik skaitymas)

- Regionas: AWS `eu-west-1` (Airija), ne Frankfurtas, kaip buvo užrašyta anksčiau. Abu ES, todėl GDPR vertinimas nesikeičia; privatumo politika ir App Review pastabos pataisytos.
- Auth (`/auth/v1/settings`): įjungtas tik el. paštas, registracija atvira, `mailer_autoconfirm: true` (el. pašto patvirtinimas išjungtas, kaip numato `useAccount.js`). Rizika: el. pašto adreso nuosavybė netikrinama; prieš viešą leidimą verta įjungti patvirtinimą su SMTP.
- Programėlės skaitymo kelias (`fetchPublishedRows` → `fromRemote`) gyvai grąžina 1156 publikuotus įrašus.
