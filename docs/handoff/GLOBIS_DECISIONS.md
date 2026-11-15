# GLOBIS — DECISIONS & CONSTRAINTS

_Last consolidated: 2026-11-15. This file separates accepted direction from open questions._

## Accepted decisions

| Area | Decision |
|---|---|
| Brand | Use **Globis** as the current working brand. Trademark/domain clearance remains open. |
| Product purpose | Build a trustworthy Lithuanian animal adoption platform, not only a swipe app. |
| Naming | “Sutapom” was rejected. |
| Navigation | Three destinations: Globoti, Prieglaudos, Išsaugoti. |
| Discovery | Right swipe saves; left swipe passes; rewind must exactly undo the last action. |
| Saved animals | Dedicated screen, not only a hidden drawer. |
| Pet details | Full-screen details/gallery; source link and real freshness timestamp when available. |
| Shelter navigation | Filter by exact shelter ID, not city. |
| Shelter counts | Active Globis listing count is not shelter capacity. Do not label it “Bendra talpa”. |
| Contact | Show only valid real phone/email; never show synthetic contact data. |
| Reserved listings | Exclude from discovery; mark clearly in shelter roster. |
| Unknown fields | Hide unknowns; do not guess. |
| Visual direction | Premium, warm, nature-inspired palette: pine, terracotta, parchment and linen. |
| Workflow | GitHub as shared source of truth; feature branches and PRs; no direct commits to main. |
| Implementation | Evolve current Expo/React Native app; no rewrite without evidence. |

## Non-negotiable data rules

- Never fabricate animal or shelter facts.
- Never use random values for sex, age, size, waiting time, bios or personality.
- Never assume chipped, vaccinated, neutered or compatible unless source-backed.
- Do not treat a missing source listing as proof of adoption.
- Do not display generated phone numbers, emails, addresses, registration numbers or verification claims.
- Keep original listing URL and data provenance when possible.
- Unknown is not false; missing is not a negative claim either.

## Approved visual tokens

- Primary pine: #244E38
- Dark pine: #183626
- Terracotta: #C66B3D
- Warm clay: #9C7A5E
- Amber: #B8832E
- Parchment: #EFE8DC
- Linen: #F8F4EC
- Muted text: #63564B
- Heading font candidates: Fraunces / Lora
- UI font candidates: Plus Jakarta Sans / system sans
- Minimum touch target: 44×44pt
- Radius scale: 12 / 16 / 24 / 32 / pill

## Open questions — owner approval required

1. Trademark and domain checks for Globis.
2. Final logo selection and verified asset mapping.
3. Whether to create a backend and which provider (Supabase/Firebase); Issue #1 requests analysis only.
4. User registration/authentication and roles.
5. Shelter verification and moderation evidence/process.
6. Adoption application workflow and status lifecycle.
7. Business model and monetization.
8. Source-data licensing, permitted scraping, and reliability.
9. Release/deployment strategy.

## Historical / technical cautions

- Repo still has legacy “Myliu tave” metadata. Do not change bundle IDs/package identity without assessing update consequences.
- Generated animal JSON appears in both `data/` and `src/data/`. Confirm workflow/source-of-truth before edits.
- A previous source audit found random/fabricated values in the scraper. Recheck current code before treating the finding as still present.
