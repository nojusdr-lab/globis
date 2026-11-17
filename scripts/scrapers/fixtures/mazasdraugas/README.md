# mazasdraugas.lt fixtures

Source: polite probe of https://www.mazasdraugas.lt/ on 2026-11-16 (`probe-output/mazasdraugas/`).

| File | From | Real or synthetic |
|---|---|---|
| `robots.txt` | https://www.mazasdraugas.lt/robots.txt (probe `index.json` → `robots.text`) | Real, unchanged. |
| `posts.json` | https://www.mazasdraugas.lt/wp-json/wp/v2/posts?per_page=5 (probe file `06-…`) | Real, trimmed: all 5 posts (Šaris, Seba, Pripsas, Naitas, Tobis), only the fields the adapter asks for (`id,link,title,modified_gmt,categories,content`). In `content.rendered`: `srcset/sizes/style/data-*/class` and similar attributes and extra whitespace removed; the contact block (phone, bank account, PayPal email, Patreon tracking link) replaced with `[kontaktai pašalinti]`. Text, images and tag structure (including the site's stray closing tags) unchanged. |
| `categories.json` | Ids 34 and 35 are the real `categories` ids on the posts; slugs are real (`class_list` of the same posts: `category-dovanojamos-kates`, `category-dovanojami-sunys`); names are the real menu labels "Dovanojamos Katės" and "Dovanojami Šunys". | SYNTHETIC shape: the probe did not fetch `/wp-json/wp/v2/categories`. |

Test-only reshaping (in `tests/mazasdraugas.test.cjs`): pagination pages are built by slicing
`posts.json`; one test gives Naitas both category ids so species must become unknown (null).
