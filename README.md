# Myliu tave 🐾 — Lithuanian Pet Adoption App

**"Myliu tave"** is a Tinder-style pet adoption mobile app built with **Expo (React Native)** for animal shelters across Lithuania. It aggregates real animals from shelters across 11 Lithuanian cities (Vilnius, Kaunas, Klaipėda, Šiauliai, Panevėžys, Alytus, Mažeikiai, Utena, Visaginas, Kazlų Rūda, Marijampolė).

Designed following the **Organic** aesthetic anchor:
- **Palette**: Earth tones (sage `#8B9D83`, clay `#B08B6E`, terracotta `#C66B3D`, ochre `#C08E3A`, moss `#606C38`), sand `#E8DCC7` and oat `#D4B895` surfaces. No pure white, black, or cold sterile greys.
- **Structure**: Generous tactile rounded corners (16–32 px).
- **Texture**: Soft tactile grain overlay (`GrainOverlay`).
- **Motion**: Gentle organic springs (300–500 ms) and breathing pulse animations on hero like actions.
- **Content Discipline**: Real Lithuanian rescue animals with verified shelter contacts, authentic photos, waiting-time pills, medical readiness badges, and warm Lithuanian bios.

---

## Features

1. **Swipeable Card Stack with 20-Card Pagination**:
   - Smooth gesture-driven card deck (swipe right to like/match, swipe left to pass).
   - High-performance chunk loading: loads 20 cards at a time as the user swipes through all 950+ animals smoothly without memory bloat.
   - Tactile terracotta "MYLIU" and clay "PRALEISTI" stamp seals with angle tilt physics.

2. **Waiting-Time & Medical Readiness Badges**:
   - Long-term resident badge: highlights pets waiting 180+ days in warm terracotta ("Laukia 240 d.") to prioritize animals in urgent need of adoption.
   - Medical readiness pills: "Čipuotas" (Microchipped), "Skiepytas" (Vaccinated), and "Sterilizuotas" (Neutered).

3. **Multi-Photo Gallery & Pet Details Modal**:
   - High-resolution pet photos with tap navigation.
   - Expandable bio sheet with shelter info, compatibility tags (*„Draugiškas su katėmis“*, *„Tinka bute“*, etc.), and personality traits.

4. **"Valio! Susisiekite su prieglauda" Match Modal**:
   - Instant celebration modal upon right-swipe.
   - One-touch phone dialing, pre-filled email inquiry, and direct website links.

5. **Lithuanian Shelters Directory ("Prieglaudos" Tab)**:
   - Complete directory of 37 Lithuanian shelters with real addresses, phones, emails, logos, and dog/cat breakdowns.
   - Filter shelters by city and view animal counts.
   - "Rodyti augintinius" button to jump straight into swiping that shelter's animals.

6. **Comprehensive Filters & Bilingual Support**:
   - Species filters: **Visi / Šunys / Katės**.
   - "Skubiausi" toggle: sorts deck by longest-waiting residents first.
   - City filter: scrollable bar covering all 11 Lithuanian cities with animal counts.
   - Bilingual toggle: instant **LT / EN** switching across the entire app.

---

## Data Pipeline & Scraper

Data is scraped from globok.lt using `scripts/scrape-globok.js`:
- Scrapes all 37 registered shelter profiles and contact details into `data/shelters.json`.
- Extracts animal listings (names, photos, species, sex, age, city, waiting time, medical readiness) into `data/allPets.json`.
- Uses polite 200ms delays to respect the server.

To refresh the dataset:
```bash
PATH="$(pwd)/.node-bin/bin:$PATH" node scripts/scrape-globok.js
```

---

## How to Run

### Dev Server
```bash
PATH="$(pwd)/.node-bin/bin:$PATH" HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081
```

- **Web Preview**: Open [http://localhost:8081](http://localhost:8081) in your browser.
- **Mobile (Expo Go)**: Scan the QR code displayed in the terminal using the Expo Go app.

### Google Play Store Build (Android AAB)
```bash
PATH="$(pwd)/.node-bin/bin:$PATH" npx eas build --platform android
```
Configured in `app.json` under package `com.myliutave.app`.
