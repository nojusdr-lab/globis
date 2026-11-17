# gyvunugloba fixtures

Source: polite probe of 2026-11-16 (`probe-output/gyvunugloba/`, GlobisBot/0.1).

| File | Source | Notes |
|---|---|---|
| `robots.txt` | https://gyvunugloba.com/robots.txt | Verbatim (from `index.json`). |
| `iesko-namu-gyvunai.html` | https://gyvunugloba.com/iesko-namu-gyvunai/ | Real page, trimmed: only the title block (`<h1>` "Ieško namų gyvūnai") and page content kept; menus, footer (phone, email, person's name), scripts removed. |
| `kates-page-1-synthetic.html` | **SYNTHETIC** | Page https://gyvunugloba.com/iesko-namu-gyvunai/kates/ was not probed. Built from the real portfolio `<article>` markup of https://gyvunugloba.com/ (same probe): Leopoldas, Sodas, Apvalaini (desktop masonry) + Leopoldas, Sodas (mobile grid duplicate), unchanged. The "Show more" paging block reshapes the real one from the home page (`rel="146"`, `/page/2/`) to `rel="2"` and `/iesko-namu-gyvunai/kates/page/2/`. |
| `kates-page-2-synthetic.html` | **SYNTHETIC** | Page 2 of the cat list (not probed). Real home-page articles Alytė, Vezuvijus; no paging block (last page). |
| `sunys-synthetic.html` | **SYNTHETIC** | https://gyvunugloba.com/iesko-namu-gyvunai/sunys/ not probed. Real home-page articles Loris, Agrastas, Šakira (+ Loris mobile duplicate). |
| `kiti-synthetic.html` | **SYNTHETIC** | https://gyvunugloba.com/iesko-namu-gyvunai/kiti/ not probed. Empty portfolio holder. |

Animal names, categories (Katės/Šunys) and photo URLs are exactly as on the real home page. No facts were added.
No phone numbers, emails or people's names remain.
