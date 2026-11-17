# gyvunugloba fixtures

Source: polite probe of 2026-11-16 (`probe-output/gyvunugloba/`, GlobisBot/0.1); list pages from the follow-up probe in `probe-output/gyvunugloba/extra/`.

| File | Source | Notes |
|---|---|---|
| `robots.txt` | https://gyvunugloba.com/robots.txt | Verbatim (from `index.json`). |
| `iesko-namu-gyvunai.html` | https://gyvunugloba.com/iesko-namu-gyvunai/ | Real page, trimmed: only the title block (`<h1>` "Ieško namų gyvūnai") and page content kept; menus, footer (phone, email, person's name), scripts removed. |
| `sunys.html` | https://gyvunugloba.com/iesko-namu-gyvunai/sunys/ | Real page (follow-up probe), trimmed: only `<h1>` and the portfolio grid kept, all 13 items unchanged; menus, footer (contacts), scripts removed. |
| `kates.html` | https://gyvunugloba.com/iesko-namu-gyvunai/kates/ | Real page, trimmed the same way, all 22 items. |
| `kiti.html` | https://gyvunugloba.com/iesko-namu-gyvunai/kiti/ | Real page, trimmed the same way, 2 items. |

Nothing here is synthetic. The real list pages have no paging block; the pagination tests add the theme's
real "Show more" block (copied from the home page) inside the test code only.
No phone numbers, emails or people's names remain.
