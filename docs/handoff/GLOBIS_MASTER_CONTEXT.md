# GLOBIS — MASTER PROJECT CONTEXT

_Last consolidated: 2026-11-15. Purpose: continue the project in a new ChatGPT account or with another AI without restarting discovery._

## 1. Project identity

- **Working brand:** Globis.
- **Product:** Lithuanian animal adoption and shelter-discovery platform.
- **Core purpose:** help people discover animals that genuinely need homes and contact shelters through trustworthy, accurate information. It is not merely a Tinder-style swipe toy.
- **Naming:** “Globis” is the selected working name. Trademark clearance and domain acquisition have not been confirmed.
- **Rejected name:** “Sutapom”.
- **Important legacy detail:** repository metadata still contains “Myliu tave”. Do not casually rename bundle identifiers/package identity; assess app-store update implications first.

## 2. Product principles (non-negotiable)

1. **Trust before engagement.** Never invent animal or shelter information.
2. Unknown data stays unknown. Do not convert missing values into guesses, defaults, or reassuring claims.
3. Medical status, temperament, compatibility, sex, age, size, waiting duration, vaccination, microchip, neutering and similar facts must be source-backed.
4. A missing listing is not proof of adoption.
5. Reserved animals must be excluded from the normal discovery deck and clearly marked wherever else they appear.
6. Never display generated phone numbers, emails, registration codes, addresses, hours, verification labels, capacity or other placeholders as real.
7. Preserve original source links and provenance. Display freshness timestamps only when actually observed.
8. Build an adoption service with credible shelter information and contact paths, not just a swipe interface.
9. Keep the product understandable and accessible: clear labels, adequate touch targets, keyboard/screen-reader support, reduced-motion respect.

## 3. Target experience and approved UX direction

### Main navigation
Three destinations:
- **Globoti** — animal discovery.
- **Prieglaudos** — shelter/organization directory.
- **Išsaugoti** — saved animals, with count badge.

Compact header: Globis wordmark/logo, LT/EN language switch, one Filters action. Mobile bottom navigation; on wide web layouts (>768px), a vertical sidebar rail is acceptable.

Filters: species (Visi / Šunys / Katės), city, and urgent-first sort/toggle. Preserve existing filtering behavior.

### Discovery / swipe
- Give the animal card maximum practical space between header and bottom navigation.
- Horizontal gesture should activate only after roughly 6–8px movement; taps must remain usable.
- Disable photo-navigation tap zones for zero/one-photo animals.
- Swipe right = save; show a small non-blocking toast (“Išsaugota! Susisiekti dabar →”), not a blocking full-screen match modal.
- Swipe left = pass.
- Rewind, Pass, Info and Like actions remain available.
- Rewind must undo the exact most recent action and atomically restore index plus saved/passed arrays. Disable it when there is nothing to undo.
- Show deck progress only if it does not clutter the interface.

### Animal details
Full-screen detail sheet/modal with gallery. Reset photo index when changing animal. Hide unsupported medical/compatibility attributes. Show original listing URL and real update timestamp if available. Sticky actions: Save and Contact; Share/Pass may be included if they fit. The card body itself should open details, not only a tiny footer target.

### Saved animals
Dedicated screen rather than a hidden drawer. Show photo, name, known age, city and contact action. Allow unsaving. Persist saved animals, passed animals and language locally across restarts.

### Shelters
Search by organization name; filter by dogs/cats. Filter animals by exact shelter ID, not city, when navigating from a shelter. Derive active Globis listing counts from actual eligible animal records; do not trust stale hard-coded city totals.
Do not label source listing counts as “Bendra talpa” (capacity) unless a source explicitly supplies true capacity. Prefer “Aktyvūs Globis skelbimai”; attribute any separately reported source count.
Group organizations with zero active Globis listings separately.
Shelter detail should show only available description, known address, real contacts, evidence/source of verification and that shelter’s own animal roster. Do not invent visiting hours, directions, verification, capacity or contacts.

### Contact
Replace blocking MatchModal with a half-screen ContactBottomSheet. Show phone/email only if valid, real source values exist. Hide empty/synthetic values and blank registration code. Keep website/source link when real.

### Visual direction
Palette:
- Pine green #244E38
- Dark pine #183626
- Terracotta #C66B3D
- Warm clay #9C7A5E
- Amber #B8832E
- Parchment #EFE8DC
- Linen #F8F4EC
- Muted text #63564B

Typography: Fraunces or Lora for display headings; Plus Jakarta Sans or system sans for UI. If custom fonts are adopted, bundle consistently.
Touch targets ≥44×44pt. Radius scale: 12 / 16 / 24 / 32 / pill.
Use supplied Globis assets only after inspecting exact filenames and dimensions. Candidate mappings from prior review: Code_Generated_Image.png (header lockup), (1) app icon, (4) Android monochrome, (2) watermark — verify actual assets before use.
Keep texture/performance/accessibility balanced. Respect Reduce Motion and accessibility roles/states.

### States and responsive behavior
- Reserved animal: visible “Rezervuotas”; excluded from discovery but retained in shelter roster.
- Unknown fields: hide rather than guess.
- Empty discovery: “Nepavyko rasti augintinių”, subtle watermark, reset-filters action.
- Loading skeletons should match card geometry.
- Consider react-native-safe-area-context only after Expo SDK compatibility check.
- Mobile-first; web/tablet centered deck max width about 420px; sidebar rail above 768px.

## 4. Technical baseline (from repository review recorded 2026-11-15)

- App stack: Expo / React Native.
- Main entry: `App.js`.
- Data module: `src/data/pets.js` imports `src/data/allPets.json`.
- Scraper: `scripts/scrape-globok.js`.
- Scheduled workflow: `.github/workflows/update-pets.yml`.
- Theme tokens: `src/theme/tokens.js`.
- UI under `src/components`.
- Data also exists under both `data/` and `src/data/`; source-of-truth/output duplication must be understood before editing.
- Existing app uses local view state and current LikesDrawer/MatchModal flow.
- package currently has Expo / React Native dependencies; no navigation, persistence or safe-area packages were present in the recorded review.
- Existing scraper was found to:
  - use Math.random() for sex, waitingDays and generated bios;
  - default missing age and size;
  - set chipped/vaccinated to true without source evidence;
  - infer neutered;
  - assign species-based compatibility/personality claims;
  - generate fallback shelter phone/email;
  - fetch detail pages only for first 120 animals and synthesize remaining bios.
- Other recorded issues:
  - city counts are static and inconsistent (1,073 vs 957);
  - ActionButtons receives canRewind=true unconditionally;
  - CardStack rewind only decrements index and does not correctly undo saved/passed arrays;
  - shelter CTA filters by city rather than shelter ID;
  - adoption inquiry opens email client only; no persisted application workflow.

**These are findings from the last recorded source review, not a claim that the current main branch has not changed. Reinspect the current branch and files before implementing.**

## 5. Data source and current scope

The project has scraped/imported shelter and animal listing data, including a scraper named after Globok. Preserve existing working source ingestion unless there is a justified reason to change it. Do not assume scraped records are verified or complete. Establish provenance for every field and distinguish:
- source-provided facts;
- derived values with a documented deterministic rule;
- unknown/missing values.

No database/backend integration should be started just because it was discussed. GitHub Issue #1 asks for a Supabase-vs-Firebase analysis only and explicitly says not to create a project, install packages or begin integration until the owner approves.

## 6. GitHub and coordination

- Repository: https://github.com/nojusdr-lab/globis
- Local folder (on owner's Mac): `~/Desktop/gyvunu timderis`
- Remote origin: `https://github.com/nojusdr-lab/globis.git`
- Default branch: `main`
- Last known main SHA in earlier context: `30e30b03a71b9f3ee7586df6c9532b433a380377` (logo assets). Verify current HEAD before work.
- Issue #1 — https://github.com/nojusdr-lab/globis/issues/1 — ChatGPT ↔ Codex coordination and Supabase analysis request.
- Issue #2 — https://github.com/nojusdr-lab/globis/issues/2 — approved UX/UI direction, verified findings and staged implementation plan. Treat this as the canonical UX handoff.
- GitHub is the shared source of truth for code, issues, PRs and written decisions. Do not ask the owner to manually shuttle long prompts between AI tools.

## 7. Delivery strategy

Implement in small, reviewable PRs:
1. **PR1 P0 data integrity and correctness:** remove fabricated fields/contacts; preserve unknowns; reserved status; source timestamps; exact shelter ID filtering; derived active listing counts; resolve data-output source of truth; tests/validation.
2. **PR2 P0 interaction correctness and persistence:** swipe/tap responder; single-photo behavior; atomic rewind; local persistence for saved/passed/language; tests.
3. **PR3 P1 navigation and visual system:** three destinations; compact header/filter sheet; tokens/typography/assets; safe areas/accessibility/reduced motion.
4. **PR4 P1/P2 details, shelters and contact:** details/source/share; saved screen; shelter search/detail/roster; validated contact sheet; responsive web layout.

Do not begin PR2–4 until PR1 is reviewed. Work on feature branches and open PRs. Never commit directly to main. Run available checks and report anything not testable. No paid accounts, production deployment or external services without explicit approval.

## 8. What is not yet decided / must not be assumed

- Trademark clearance and domain ownership for Globis.
- Final logo asset and exact asset-to-platform mapping.
- Backend choice and whether/when to use Supabase or Firebase.
- User accounts, shelter representative onboarding and admin workflows.
- Real adoption application lifecycle and moderation/verification process.
- Monetization/business model.
- Whether custom fonts and safe-area package should be added (check SDK and bundle impact).
- Exact data source licensing/permission and operational reliability.
- Any deployment/release plan.

## 9. Owner and collaboration preferences

- Owner is a non-programmer; explain technical work in plain Lithuanian, with one clear next step at a time.
- Avoid making the owner copy/paste long prompts between AI agents. Put durable context, decisions and task instructions in GitHub.
- Do not run multiple agents editing the same files simultaneously.
- Before code changes, explain scope, branch, likely files, tests and risks briefly.
- Be honest about what was actually inspected, changed, tested and deployed.
