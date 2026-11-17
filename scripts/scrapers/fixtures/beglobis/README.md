# beglobis fixtures

From the polite probes of www.beglobis.com (GlobisBot/0.1): home page and robots.txt on 2026-11-16
(`probe-output/beglobis/`), list and one detail page in the follow-up probe (`probe-output/beglobis/extra/`).

- `list-page1.html`: real page `http://www.beglobis.com/Dovanojami-684.html` (probe file
  `extra/01-www-beglobis-com-Dovanojami-684-html.gz`), trimmed to `<head>` meta/title/`<base>` and the
  `#middle` column: 18 real cards and both pagination blocks (page 1 of 2). Removed: scripts, styles, menus,
  the left/right columns, the filter form and the footer (manager's name, phone, e-mail).
- `detail-3084.html`: real page `http://www.beglobis.com/Mylia-684.html?productid=3084&reset=1` (probe file
  `extra/02-…`), trimmed to the `#middle` animal block. Removed lines: Telefonas, El. paštas,
  Šeimininko vardas (empty), Adresas; and the comments block. No phones, emails or people's names left.
- `list-page2.html`: real page `http://www.beglobis.com/Dovanojami-684.html?productpage=1` (probe file
  `extra/01-www-beglobis-com-Dovanojami-684-html-productpage-1.gz`), trimmed the same way: 9 real cards,
  last page (the "»" is plain text, no link).
- `detail-4101.html`: real page `http://www.beglobis.com/Lota-684.html?productpage=0&productid=4101` (probe file
  `extra/02-www-beglobis-com-Lota-684-html-productpage-0-productid-4101.gz`), trimmed like `detail-3084.html`.
- `robots.txt` is not a file: the probe got HTTP 404; the test serves a 404.
- CRLF line endings of the probe pages were changed to LF.

SYNTHETIC (built in `tests/beglobis.test.cjs`, not files):
- Minimal detail pages for the 25 cards whose real detail page was not probed: only their real list name
  and list status "Dovanojamas", nothing else.
- Mylia's detail with the guardian set to a real "Globėjas" filter option ("Grinda, Vilniaus gyvūnų globos
  namai") to test skipping other guardians' animals (no real non-Beglobis detail page seen yet).
