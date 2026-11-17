# padekman fixtures

From the polite probe on 2026-11-16 (`probe-output/padekman/`, GlobisBot/0.1).

- `home.html`: real page `https://padekman.lt/` (probe file `01-padekman-lt-.gz`, 2026-11-16T22:07Z),
  trimmed to the "Ieško namų" portfolio list (`data-category=ishchut-dom`, 20 cards, page 1 of 5)
  and its pagination block. Removed: header, menus, footer, scripts, `srcset`/`sizes` attributes and
  pagination SVG icons. No phones, emails or people's names left.
- `robots.txt`: real robots.txt text from `probe-output/padekman/index.json` (same probe).
- SYNTHETIC (built in the test, not a file): `home.html` with `data-max-num-pages=5` changed to `1`,
  used only to check that a single-page list is treated as complete. No animal facts changed.
