# bukmanodraugas fixtures

Source: polite probe of https://bukmanodraugas.lt/ on 2026-11-16 (`probe-output/bukmanodraugas/`).
No phone numbers, emails or people's names were in the kept text.

| File | From | Notes |
|---|---|---|
| `robots.txt` | https://bukmanodraugas.lt/robots.txt | Real, unchanged. |
| `posts.json` | https://bukmanodraugas.lt/wp-json/wp/v2/posts?per_page=5 | Real 5 posts (all in category 38 "Šunys ieško namų"), cut down to the keys the adapter asks for with `_fields` (id, link, title, modified_gmt, featured_media, content, categories). The test serves it at the adapter's `posts?categories=38,39&...` URL. Values unchanged. |
| `categories.json` | **SYNTHETIC** | Shape of `/wp-json/wp/v2/categories?slug=...`. Ids 38 and 39 and the names "Šunys ieško namų" / "Katės ieško namų" are real, copied from the listing pages (`data-term-id="38"`, `wp-json/wp/v2/categories/38` and `/39` links, card labels). The `rado-namus` category id was not seen, so it is left out. |
| `media.json` | **SYNTHETIC** | Shape of `/wp-json/wp/v2/media?include=...`. Media ids are the real `featured_media` values from `posts.json`; each `source_url` is the real card image of the same post on https://bukmanodraugas.lt/category/sunys-iesko-namu/. |
