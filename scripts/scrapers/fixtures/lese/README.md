# lese.lt fixtures

Source: GlobisBot probes of lese.lt (`probe-output/lese/extra/`, fetched 2026-11-17 after the
2026-11-16 first probe). Each file keeps only the `type` and `stat` filter `<select>`s, the real
animal cards (unchanged) and the pagination block. Header, footer (bank details, address,
contacts), scripts and SVGs were removed. No phone numbers, emails or people's names remain.

| File | Real URL | Changes |
|---|---|---|
| `stat1-page-1.html` | https://lese.lt/lese-globotiniai/?stat=1 | Trimmed only. 20 cards, real pagination (links to pages 2–4). |
| `stat1-page-2.html` | https://lese.lt/lese-globotiniai/page/2/?stat=1 | 20 real cards. **SYNTHETIC pagination:** links to pages 3, 4 and "next" removed so the page acts as the last page (page 3 was not probed). |
| `stat1-type-suo-page-1.html` | https://lese.lt/lese-globotiniai/?stat=1&type=suo | 20 real cards. **SYNTHETIC pagination:** only "current page 1" kept, so it acts as the last page (the real list has 3 pages). |
| robots.txt (inline in the test) | https://lese.lt/robots.txt | Verbatim. |

**SYNTHETIC in the test:** pages for the other types (`grauzikas`, `kate`, `kita`, `paukstis`, `roplys`,
`seskas`) were not probed. The test builds them from the `stat1-page-1.html` shell with
no cards, no pagination and that type selected. These pages contain no animal facts.
