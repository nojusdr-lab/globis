# sos-gyvunai fixtures

All source pages come from the polite probe of 2026-11-16 (`probe-output/sos-gyvunai/`, GlobisBot/0.1).

| File / key | Source | Notes |
|---|---|---|
| `data.json` → `robots` | `https://sos-gyvunai.lt/robots.txt` | Real, verbatim. |
| `data.json` → `posts` | `https://sos-gyvunai.lt/wp-json/wp/v2/gyvunas?per_page=5` | Real 5 posts (Imbieras, Izė, Natas, Stirna, Bona), cut to the `_fields` the adapter asks for. Content trimmed: Facebook emoji images, CSS classes and Facebook links removed; the donation block after "Mokėjimo paskirtis" (bank accounts, PayPal email, SMS number) replaced by a placeholder. No phones, emails or people's names. |
| `data.json` → `media` | **SYNTHETIC** | Shape of `/wp-json/wp/v2/media?include=...`. Ids are the posts' real `featured_media`; `source_url` is the real `og_image` URL from each post's `yoast_head_json` in the same probe file. |
| `data.json` → `terms` | **SYNTHETIC** | Shape of `/wp-json/wp/v2/gyvunai`. Ids from the posts' `gyvunai` arrays, slugs from their `class_list`, names from the site menu on `/visi-gyvunai/`, parents from the menu nesting. Real term names may differ. |
| `visi-gyvunai.html` | `https://sos-gyvunai.lt/visi-gyvunai/` | Real top navigation `<ul>` only (shows "Dovanojami gyvūnai" → "Visi gyvūnai"); rest of the page, incl. footer contacts, removed. |

Pagination tests split the real 5-post page into smaller WordPress pages; the 400 "past the last page" answer is synthetic.

Real pages still needed to replace the synthetic parts:
- `https://sos-gyvunai.lt/wp-json/wp/v2/gyvunai?per_page=100&page=1&_fields=id,name,slug,parent`
- `https://sos-gyvunai.lt/wp-json/wp/v2/media?include=4469,4437,4434,4446,4431&per_page=100&_fields=id,source_url`
