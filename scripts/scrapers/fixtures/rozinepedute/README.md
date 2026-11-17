# rozinepedute fixtures

- `gyvunai.html` — REAL. https://rozinepedute.lt/gyvunai/ ("Dovanojami gyvūnai"), fetched by the
  polite probe on 2026-11-16 (probe-output/rozinepedute/02-rozinepedute-lt-gyvunai-.gz).
  Trimmed: kept the page `<title>`, the `<link rel="next">` from `<head>`, and the `<main>`
  section "animals-archive" (heading, species filter, all 18 animal cards, the Bricks
  `brx-query-trail` element). Removed: rest of `<head>`, header/menu, the "Paremk mus" section,
  footer (address, phone, e-mails), scripts, `srcset`/`sizes` attributes; one newline added after
  each `</li>`. No phone numbers, e-mails or people's names remain.
- robots.txt is inlined in the test as the real text from probe-output/rozinepedute/index.json.

Test-only reshaping (in `tests/rozinepedute.test.cjs`, not in the file):
- SYNTHETIC two-page version: the same 18 real cards split 9 + 9, with the loop trail values
  changed to posts_per_page 9 / data-max-pages 2 (the real site shows all animals on one page).
- Three real cards renamed TESTAS (rezervuota) / TESTAS2 (grįžo namo) / TESTAS3 (gydoma) to test
  card status words. No real animal gets a made-up fact.
- Trail removed / data-end changed to test "cannot prove end of list".
