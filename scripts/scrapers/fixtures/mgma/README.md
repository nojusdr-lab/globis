# mgma.lt fixtures

Source: polite probe of https://mgma.lt/ on 2026-11-16 (`probe-output/mgma/`).

| File | From | Real or synthetic |
|---|---|---|
| `robots.txt` | https://mgma.lt/robots.txt (probe `index.json` → `robots.text`) | Real, unchanged. |
| `products.json` | https://mgma.lt/wp-json/wp/v2/product?per_page=5 (probe file `03-…`) | Real, trimmed: 4 of 5 products (Soja, Pripsi, Pudra, Pūkenė), only the fields the adapter asks for (`id,link,title,modified_gmt,featured_media,excerpt,product_cat`), emoji `<img>` tags and their empty wrapper spans removed, phone number replaced with `[telefonas pašalintas]`. |
| `media.json` | Image URLs are the real `yoast_head_json.og_image[0].url` of the same 4 products (probe file `03-…`). | SYNTHETIC shape: the probe did not fetch `/wp-json/wp/v2/media`; ids are the real `featured_media` ids. |
| `product_cat.json` | Ids 20 and 22 are the real `product_cat` ids seen on the products. Slug `kaciukai` for id 20 is real (homepage `product_cat-kaciukai` class on Soja/Pripsi/Pudra). | SYNTHETIC names: `Kačiukai` (from the slug) and `Rado namus` (a real menu label on mgma.lt; that id 22 is this category is a guess: both id-22 products have "padovanota" in the title). |

Test-only reshaping (in `tests/mgma.test.cjs`): Pūkenė (real `product_cat: [22]`) is served inside
the category-20 response so the adapter's title-status rule can be tested on a real title
("Pūkenė padovanota 2026 11 11"). Pagination pages are built by slicing `products.json`.
