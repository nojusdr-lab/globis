# padekman fixtures

All real data comes from polite probes (GlobisBot/0.1): `probe-output/padekman/` (2026-11-16) and
`probe-output/padekman/extra/` (follow-up probe, saved 2026-11-17). Removed everywhere: phone numbers,
volunteers' names (`dc:creator` and the contact line after "Daugiau informacija:"), scripts, menus, footer.

- `robots.txt`: real robots.txt text (`probe-output/padekman/index.json`, 2026-11-16).
- `feed-1.xml`: real `https://padekman.lt/portfolio-category/ishchut-dom/feed/` (extra/02), trimmed
  to 2 of its 10 items (post 7440 Moisej, 7311 Bocman). Trimming makes this page "full" at 2 items.
- `feed-2.xml`: real `https://padekman.lt/portfolio-category/ishchut-dom/feed/?paged=2` (extra/03),
  trimmed to 1 of its 10 items (post 7298 Viola), so it is the short last page in the test.
- `detail-lika.html`: real `https://padekman.lt/portfolio-item/lika/` (extra/05), trimmed to the
  portfolio-single block (photo, description, categories, date).
- SYNTHETIC `detail-nr-121-moisej.html`, `detail-nr-99-bocman.html`, `detail-nr-94-viola.html`:
  the Lika page structure filled with that animal's real feed content (`content:encoded`), its real
  photo and its real category labels from the 2026-11-16 list pages (Moisej: /koty/; Bocman and
  Viola: home page, where Viola is shown with both "Ieško namų" and "Rado namus"). Their real pages
  were not probed. Nothing invented.
