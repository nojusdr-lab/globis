# katinosvajone fixtures

All real pages come from the polite probe (probe-output/katinosvajone/extra/, requested
2026-11-16, saved 2026-11-17). Trimmed to what the tests read: header, menu, social links,
scripts, footer and the sex/neutered filter selects removed; whitespace collapsed.
No phone numbers, e-mails or people's names are kept.

- `list-filtered-1.html` — REAL. https://www.katinosvajone.lt/musu-globotiniai?pet_status=for_adoption
  (page 1 of 3 of the "Dovanojama(-as)" filter, 16 cards, real pagination 1–3).
- `list-175.html` — REAL. https://www.katinosvajone.lt/musu-globotiniai?pg=175 (last page of the
  unfiltered list; shows the real disabled "Pirmyn" `<li class="next"><span>`). Pagination items
  1–172 removed.
- `detail-tankas.html` — REAL. https://www.katinosvajone.lt/musu-globotinis/tankas. The second
  `dl.pet-details-list` under "Kontaktai" (phone numbers) removed.
- `list-filtered-2-synthetic.html` — SYNTHETIC. Filtered page 2 was not probed. Built from
  `list-filtered-1.html` (its last real card row: Čipsas, Ausius, Mažoji, Šafranas) with the
  last-page pagination markup seen on the real `?pg=175` page, URLs switched to the filter.
  The test turns page 1 into "page 1 of 2" by dropping that last row and the item for page 3.
- `detail-empty-synthetic.html` — SYNTHETIC. The real detail page markup with an empty facts
  list and no photos; served for every animal except Tankas so no facts are invented.
