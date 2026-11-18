# 0002. Nuotraukos: rodomos iš prieglaudų svetainių, nekopijuojamos

Data: 2026-11-18 · Būsena: pasiūlyta (keisti, jei prieglaudos duos raštišką leidimą)

## Kontekstas

Gyvūnų nuotraukos priklauso jas paskelbusioms prieglaudoms. Prieglaudų sutikimų (34 žingsnis) dar nėra. Programėlė turi rodyti nuotraukas, bet neturi teisės jų platinti kaip savo.

## Variantai

| Variantas | Už | Prieš |
|---|---|---|
| **Krauti tiesiai iš prieglaudos svetainės** (dabar) | Jokių kopijų; prieglauda ištrina, nuotrauka dingsta ir pas mus; 0 MB saugykloje | Priklauso nuo jų serverio; jų serveris mato vartotojo IP (parašyta privatumo politikoje) |
| Kopijuoti į Supabase Storage | Greita, stabilu, galima mažinti | Reikia teisių; nemokamas planas 1 GB; kopijas reikia valyti |

## Sprendimas

Krauti tiesiai iš prieglaudos svetainės. Saugoma tik nuoroda (`photos`, iki 10). Kiekviena kortelė turi nuorodą į originalų skelbimą. Nepavykus įkelti rodoma „Nuotraukos nėra“, ne svetima nuotrauka.

`http` nuotraukas iOS blokuoja. Todėl `https` puslapio to paties host `http` nuorodos keičiamos į `https` (`scripts/scrapers/lib/record.cjs`, `photoUrl`). Kitų host'ų `http` nuorodos paliekamos, nes nežinome, ar jie turi `https`.

## Kada keisti

Jei prieglauda raštu leidžia laikyti kopijas arba jos serveris lėtas ar nepasiekiamas, galima kopijuoti tik tos prieglaudos nuotraukas į Storage, su ištrynimu kai skelbimas dingsta.
