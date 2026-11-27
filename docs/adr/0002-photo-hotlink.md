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

## Pagrindas pagal šaltinį (patikrinta 2026-11-19)

Nuotraukos rodomos iš pačios prieglaudos serverio, kiekvienas įrašas turi nuorodą į originalų skelbimą (`src/data/directPets.json`: 18 prieglaudų, 1361 įrašas, be nuorodos 0; beglobis ten neįtrauktas, jo host nepatikrintas). Kopijų Supabase Storage nėra (kode nėra `storage.from` ar `.upload(`). Sąlygos iš `scripts/scrapers/sources.json`.

| Šaltinis | Nuotraukų host | Sąlygos |
|---|---|---|
| bukmanodraugas, mgma, keturkojo-viltis | savo domenas | sąlygų nuoroda pagrindiniame puslapyje nerasta |
| gyvunugloba, katinosvajone, keturkojodraugas, kggn, lese, naminukai, padekman, penktakoja, tautmilesgloba | savo domenas | sąlygų nerasta |
| mazasdraugas, siauliuletenele, rozinepedute | savo domenas | tik privatumo puslapis |
| beglobis | savo domenas | tik poraštė |
| sos-gyvunai | savo domenas | `/tinklapio-taisykles/`: „Informacija ruošiama“ |
| linksmosiospedutes | savo domenas | sąlygų nėra; robots `Content-Signal: use=reference` — rodome su nuoroda, aprašymo nekopijuojame |
| mazeikiugyvunai | `fra1.digitaloceanspaces.com` (jų API saugykla) | sąlygų nerasta |

Neįtraukti: Maži jausmai (sąlygos draudžia laikyti turinį serveriuose, adapteris išjungtas), Rasų globa (sąlygos 4.2 reikalauja raštiško sutikimo). Nė vienas šaltinis neturi raštiško leidimo (34 žingsnis), todėl kopijuoti nuotraukų negalima; pakeitus sąlygas šaltinis peržiūrimas iš naujo.
