# penktakoja.lt fixtures

Source: the polite probe of 2026-11-16 (`probe-output/penktakoja/`, GlobisBot, one request per page).
Everything is in `routes.json` (URL -> response used by the fake fetch).

| Route | From | What was changed |
|---|---|---|
| `https://penktakoja.lt/robots.txt` | https://penktakoja.lt/robots.txt (probe `index.json`, `robots.text`) | Verbatim. |
| `.../wp-json/wp/v2/product?product_cat=15&per_page=100&page=1&_fields=...` | https://penktakoja.lt/wp-json/wp/v2/product?per_page=5 (probe file `05-penktakoja-lt-wp-json-wp-v2-product-per-page-5.gz`) | The 5 real dog products, trimmed to the fields the adapter asks for (`id, link, title, modified_gmt, featured_media, content, product_cat, class_list`). `excerpt` (it held only the shelter phone number), `_links`, `meta`, `guid` and other fields removed. **SYNTHETIC URL:** the probe asked without the category filter and with `per_page=5`; all 5 items are in category 15 (`product_cat-sunys`), so the same items are served under the filtered URL. |
| `.../wp-json/wp/v2/media?include=23959,23964,23969,23923,23929&...` | **SYNTHETIC.** The media endpoint was not probed. Ids are the real `featured_media` ids from the product response; the URLs are the real thumbnail `src`/`data-lazy-src` of the same dogs on https://penktakoja.lt/ (probe file `01-penktakoja-lt-.gz`). The id-to-file pairing is assumed from the dog name in the file name. Media 23929 (ŠMAKIS) is left out on purpose to test "no photo = empty list". |

The pagination tests in `tests/penktakoja.test.cjs` re-serve these same 5 real products split
into smaller pages (`per_page=2` and `per_page=5`); those routes are built in the test and are
SYNTHETIC in their URLs and page boundaries only.

No phone numbers, emails or people's names are in the kept data.
