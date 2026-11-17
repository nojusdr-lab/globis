# linksmosiospedutes fixtures

Source: the polite probe of 2026-11-16 (`probe-output/linksmosiospedutes/`, GlobisBot/0.1).

| File | Source URL | Notes |
|---|---|---|
| `robots.txt` | https://www.linksmosiospedutes.lt/robots.txt | Verbatim (from `index.json`, `robots.text`). |
| `suniukai.html` | https://www.linksmosiospedutes.lt/lt/suniukai/ | Real page, trimmed: `<base>`, the `<h1 class="title">`, 4 of 20 cards unchanged (Oronas, Zuzu, Šyra, Salsa (VIDEO)), and the footer "GLOBOTINIAI" link cell unchanged. Head, scripts, styles, menus, contacts, bank details and sponsor logos removed. |
| `kaciukai.html` | https://www.linksmosiospedutes.lt/lt/kaciukai/ | Real page, trimmed the same way: 3 of 33 cards unchanged (Auricijus, Džoja, Verdis). |
| `kaciukai-paged-1.html` | SYNTHETIC | Built from the real `kaciukai` page (2 real cards: Auricijus, Džoja). A `.paging` block was added; the site had no pagination on 2026-11-16, so its link format (`?page=2`) is a guess. Only used to test that the adapter follows pages to the end. |
| `kaciukai-paged-2.html` | SYNTHETIC | Same, with the third real card (Verdis) moved to "page 2". |

No phone numbers, emails or people's names remain. No animal facts were added; the synthetic files only move real cards between pages.
