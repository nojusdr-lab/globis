# mazijausmai fixtures

- `ieskantys-namu.html` — REAL. https://mazijausmai.lt/ieskantys-namu/, fetched by the polite
  probe on 2026-11-16 (probe-output/mazijausmai/02-*.gz). Trimmed: kept the page `<title>`, the
  `<h1>` section "Namų ieškantys gyvūnai" and 3 of the 10 Elementor grid rows (rows 1, 4 and 10:
  Liepsnelė, Orionas, Saris, Micaras / Arielis, Klivija, Kiras, Ramunėlė / three "." placeholders
  and "Pusnė (kol kas nedovanojama - gydoma)"). Header, menu, footer (address, phone, e-mail),
  scripts, `srcset`/`sizes` attributes removed; whitespace collapsed. No phone numbers, e-mails
  or people's names remain.
- robots.txt is inlined in the test as the real text from probe-output/mazijausmai/index.json.

Test-only reshaping (in `tests/mazijausmai.test.cjs`, not in the file): two real cells are
relabelled `TESTAS (rezervuotas)` / `TESTAS2 (grįžo namo)` to test caption status words, and a
pagination link is appended to test the "not complete" path. No real animal gets a made-up fact.
