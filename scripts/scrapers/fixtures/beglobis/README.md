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
- `robots.txt` is not a file: the probe got HTTP 404; the test serves a 404.

SYNTHETIC:
- `list-page2.SYNTHETIC.html`: page 2 (`?productpage=1`) was not probed. Built from page 1's structure
  with one card for Mylia (id 3084, real name, real thumbnail, status "Dovanojamas" as on her real detail
  page; date line left out). The last-page pagination markup (no "»" link) is a guess from page 1's
  "«" (plain text when there is no link). Whether Mylia really is on page 2 is not known.
- In `tests/beglobis.test.cjs`: minimal detail pages for the 18 page-1 cards (only their real list name
  and list status "Dovanojamas"), and Mylia's detail with the guardian set to a real "Globėjas" filter
  option ("Grinda, Vilniaus gyvūnų globos namai") to test skipping other guardians' animals.
