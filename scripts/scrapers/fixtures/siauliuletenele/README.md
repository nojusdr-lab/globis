# siauliuletenele.lt fixtures

Source: the polite probe of 2026-11-16 (`probe-output/siauliuletenele/`, GlobisBot, one request per page).

| File | From | What was changed |
|---|---|---|
| `robots.txt` (inline in the test) | https://siauliuletenele.lt/robots.txt, same probe (`index.json`) | Verbatim. |
| `posts-sunys.json` items 1–5 (ids 92798, 92790, 92785, 92739, 92734) | https://siauliuletenele.lt/wp-json/wp/v2/posts?per_page=5 (probe file `06-...posts-per-page-5.gz`) | Real posts. Kept only `id, link, title, modified_gmt, categories, content`. Galleries cut to the first 2 images; `srcset`/`sizes`/size classes and Facebook CSS classes removed. Removed: the shelter phone number (`tel. 06…`) in every post and one paragraph thanking a person by first name. All five carry category 3 (sunys), so they are what `posts?categories=3` returns first. |
| `posts-sunys.json` item 6 (id 90611, LIALIA) | **SYNTHETIC REST item** built from the real card on https://siauliuletenele.lt/kategorija/sunys/ (probe file `02-...kategorija-sunys-.gz`) | id, link, title, category list and thumbnail URL from the card; `content` is the card's real excerpt ("Rezervuota. 🐾 Susipažinkite – Lialia! ❤️ Lialia") plus the thumbnail. No `modified_gmt` (not on the card). |
| `posts-kates.json` (ids 86345 KENZIS, 88088 IŠ VARPUTĖNŲ, 89199 AFINOS ŠEIMA, 91397 ROKFORAS) | **SYNTHETIC REST items** built from the real cards on https://siauliuletenele.lt/kategorija/kates/ (probe file `04-...kategorija-kates-.gz`) | Same method as LIALIA: real id, link, title, categories, excerpt text (phone removed) and thumbnail. The cat REST response was not probed. |
| `categories.json` | **SYNTHETIC** `/wp-json/wp/v2/categories` response | Slugs and names copied from the homepage menu (probe file `01-siauliuletenele-lt-.gz`). Ids 3 (sunys) and 7 (kates) are real (from the category pages' `vogue_ajax` data); 41, 42, 44, 56, 57, 58 are real ids matched to slugs by comparing the REST posts' `categories` with the same posts' CSS classes on the list page. Ids 9001–9008 are invented placeholders for categories whose real id was not seen. |

The page-size-3 routes in the test (pages 1–2 and an HTTP 400 for page 3) are SYNTHETIC splits of
the same items, used only to test pagination.
