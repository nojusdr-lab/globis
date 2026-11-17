# jbu fixtures

From the polite probe on 2026-11-16 (GlobisBot/0.1), second run saved in
`probe-output/jbu/extra/` (the first run was stopped by an old robots.txt redirect bug).

- `list.html`: real page `https://jbu.lt/beglobiai-gyvunai` (final URL `https://jbu.lt/beglobiai-gyvunai/`,
  probe file `extra/02-jbu-lt-beglobiai-gyvunai.gz`), trimmed to the charset/title/generator meta,
  the page heading and the main content section (intro text, report links, and the portfolio grid with
  1 animal card). Removed: scripts, styles, header menus and the footer (e-mail, phone, opening hours).
  The intro paragraph with the phone number was replaced by `[Įvadinė pastraipa su telefonu pašalinta]`.
  No phones, e-mails or people's names left.
- `detail-beglobis-gyvunas-11.html`: real page `https://jbu.lt/portfolio/beglobis-gyvunas-11/`
  (probe file `extra/01-jbu-lt-portfolio-beglobis-gyvunas-11-.gz`), trimmed to charset/title, the page
  heading and the `section.portfolio-single` block (photo + label lines). Removed: header (phone, e-mail),
  menus, scripts and footer. No phones, e-mails or people's names left.
- `robots.txt` is not a file: the real answer was `User-agent: *` (probe file `extra/01-jbu-lt-robots-txt.gz`);
  the test serves that text.
- SYNTHETIC (built in the test, not files), only reshaping the real page: detail value
  "Beglobis" replaced by "Rezervuotas" / "Grįžo namo" (status checks); a page-2 link `https://jbu.lt/beglobiai-gyvunai/page/2/`
  added and page 2 = the real page with an empty grid (pagination format not seen on the real site);
  `data-per-page` lowered to 1 (end-not-proven check). No animal facts invented.
