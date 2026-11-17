# beglobis fixtures

From the polite probe on 2026-11-16 (`probe-output/beglobis/`, GlobisBot/0.1, 22:07Z).

- `home.html`: real page `http://www.beglobis.com/` (probe file `01-www-beglobis-com-.gz`), trimmed to
  the `<head>` meta/title/`<base>` and the left-column "Ieško namų" block (2 `.seekingItem` cards and the
  "Visi “Beglobio” gyvūnai" link). Removed: scripts, styles, menus, news lists (one news title contains a
  person's name), banners and the footer (manager's name, phone, e-mail). No phones, emails or people's names left.
- `robots.txt` is not a file: the probe got HTTP 404 for `http://www.beglobis.com/robots.txt`; the test serves a 404.
- SYNTHETIC (built in the test, not a file): `home.html` with the block heading "Ieško namų" replaced by the
  real menu label "Gyvūnai", only to check that status is not guessed. No animal facts changed.
