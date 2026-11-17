# lese.lt fixtures

Source: the polite probe of 2026-11-16 (`probe-output/lese/`, GlobisBot, one request per page).

| File | From | What was changed |
|---|---|---|
| `list-page-1.html` | https://lese.lt/lese-globotiniai/ (probe file `02-lese-lt-lese-globotiniai-.gz`) | Kept only the `stat` filter `<select>`, the first 13 of the 20 real animal cards (unchanged), and the pagination block. Header, footer, scripts, SVGs removed. **SYNTHETIC pagination:** the real page links to pages 2–5 and 385; here it links only to page 2. |
| `list-page-2.html` | same probe page | **SYNTHETIC page:** the remaining 7 real cards from the same probe page, with a last-page pagination block (prev link, current page 2, no "next"). Page 2 itself was not probed. |
| `robots.txt` (inline in the test) | https://lese.lt/robots.txt, same probe | Verbatim. |

Routing note (also SYNTHETIC): the adapter asks for `https://lese.lt/lese-globotiniai/?stat=1`
(the site's own "Ieško namų" filter). The probe only fetched the unfiltered list, so the test
serves the unfiltered page under the filtered URL. That is why "Rado namus" cards appear;
the adapter keeps their real status.

No phone numbers, emails or people's names were present in the kept markup (cards hold only
animal names, status text, a date and a photo URL).
