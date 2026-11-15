# GLOBIS — IMPLEMENTATION ROADMAP

_Last consolidated: 2026-11-15. Recheck repository state before starting; this is the agreed order, not a claim that work is already complete._

## Current known baseline

- Expo / React Native app.
- Entry point: `App.js`.
- Data access: `src/data/pets.js` → `src/data/allPets.json`.
- Scraper: `scripts/scrape-globok.js`.
- Scheduled workflow: `.github/workflows/update-pets.yml`.
- Theme tokens: `src/theme/tokens.js`.
- UI components: `src/components`.
- Duplicate generated data directories: `data/` and `src/data/`.
- GitHub issues #1 and #2 hold coordination and UX direction.

## Phase 0 — Re-establish current truth

Before coding:
- Inspect current branch and HEAD; check working tree.
- Inspect `.github/workflows/update-pets.yml`, scraper, data files and imports.
- Identify canonical generated-data output and whether duplicate JSON is intentional.
- Inspect package scripts and Expo SDK version.
- Check whether any newer commits/PRs have already addressed audit findings.
- Report conflicts, unknown source fields and risks.

## PR 1 — P0: Data integrity and correctness

**Scope**
- Remove random/fabricated animal facts and synthetic shelter contacts.
- Preserve missing fields as null/empty; update UI to hide unknown data.
- Determine reserved status from real source evidence; exclude reserved pets from discovery but keep them in shelter roster.
- Store observation/fetch timestamps only when actually available.
- Fix exact shelter ID filtering.
- Derive active Globis listing counts from eligible real records.
- Resolve duplicated generated JSON workflow/source of truth.
- Add validation/tests to catch fabricated facts and fake contacts.

**Likely files**
- `scripts/scrape-globok.js`
- `.github/workflows/update-pets.yml`
- `data/**` and/or `src/data/**` (only after source-of-truth check)
- shelter/pet data selectors and relevant UI components
- focused tests/validation scripts

**Acceptance**
- No random or synthetic animal/shelter facts.
- Unknown fields remain unknown.
- No fake phone/email/registration code displayed.
- Reserved pets absent from discovery, visible as reserved in shelter context.
- Shelter selection is based on exact shelter ID.
- Counts are derived and correctly labelled.
- Data generation is reproducible and documented.
- Available checks pass; limitations are reported.

Do not begin PR2 until PR1 has been reviewed.

## PR 2 — P0: Interaction correctness and persistence

- Fix horizontal swipe threshold and tap responder collision.
- Disable photo tap zones for 0/1 photos.
- Make rewind undo the exact prior action, including index and saved/passed arrays.
- Disable rewind when unavailable.
- Persist saved, passed and language state locally using an Expo-SDK-compatible approach.
- Test like/pass/rewind and persistence.

## PR 3 — P1: Navigation and visual system

- Implement three destinations: Globoti, Prieglaudos, Išsaugoti.
- Compact header and filter sheet.
- Apply approved palette, typography and verified logo assets.
- Add safe-area behavior only with SDK-compatible dependency.
- Ensure ≥44pt targets, accessibility roles/states and reduced-motion support.
- Preserve existing functionality and translations.

## PR 4 — P1/P2: Details, shelters and contact

- Improve full-screen animal detail experience and gallery reset.
- Source link, share, save/pass/contact actions.
- Dedicated saved screen.
- Shelter search, species filters, detail page and roster.
- ContactBottomSheet with validated real contact fields.
- Responsive web layout (centered deck; sidebar rail on wide screens).

## Delivery rules

- One PR at a time; no direct commits to main.
- Before each PR, state branch, scope, expected files, tests and risks.
- Keep diffs focused and reviewable.
- Run available lint/type/test/build checks; add targeted tests where practical.
- Explain results in plain Lithuanian.
- Do not create paid accounts, Supabase/Firebase projects, production deployments or external services without explicit owner approval.
