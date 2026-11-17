# tautmilesgloba.lt fixtures

Source: the polite probe of 2026-11-16 (`probe-output/tautmilesgloba/`, GlobisBot, one request per page).

| File | From | What was changed |
|---|---|---|
| `dovanojami.html` | https://tautmilesgloba.lt/dovanojami/ (probe file `02-tautmilesgloba-lt-dovanojami-.gz`) | Kept `section#main-gyvunas` with all 19 real animal cards (unchanged) and the real, empty `div.archive-pagination`. Header, filter form, scripts, footer (phone numbers, email, addresses) removed. Two of the real injected casino spam links from the footer kept, to test that they are ignored. |
| `synthetic-page-1.html` | same probe page | **SYNTHETIC pagination:** the first 12 real cards, plus a WordPress-style pagination block (current page 1, link to page 2, `a.next`). The real site had only one page on 2026-11-16, so its page-link markup has not been seen. |
| `synthetic-page-2.html` | same probe page | **SYNTHETIC page:** the remaining 7 real cards, with a last-page pagination block (prev link, current page 2, no "next"). `/dovanojami/page/2/` was not probed. |
| `robots.txt` (inline in the test) | https://tautmilesgloba.lt/robots.txt, same probe | Verbatim. |

Cards hold only animal names, an intake date, a photo URL and the image alt text "Dovanojamas".
No phone numbers, emails or people's names remain.
