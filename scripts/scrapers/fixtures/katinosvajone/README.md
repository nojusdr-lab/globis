# katinosvajone fixtures

- `page-1.html` — REAL. https://www.katinosvajone.lt/musu-globotiniai, fetched by the polite
  probe on 2026-11-16 (probe-output/katinosvajone/02-*.gz). Trimmed: kept only the
  `.box-content.animals` block (16 animal cards and the real pagination, 175 pages); header,
  menu, filter form, social links, scripts and footer removed; whitespace collapsed.
  The page has no phone numbers, e-mails or people's names.
- `page-2-synthetic.html` — SYNTHETIC. Built from the structure seen on page 1, because
  page 2 / the last page was not probed. It reuses the last row of real cards from page 1
  (Balu, Kuperis, Kodis, Kopa, with their real status words) plus two invented test cards:
  `TESTAS` (status word "Grįžo namo", a real option text from the site's filter) and
  `TESTAS2` (no status word). The disabled "Pirmyn" item (`<li class="next"><span>`) mirrors
  the disabled "Atgal" item seen on page 1; the real last page may differ.
  The test turns page 1 into a 2-page world (drops its last row, keeps pagination items 1–2).
