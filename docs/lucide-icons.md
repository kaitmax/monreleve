# Lucide icons — attribution and licence

Created for **AN10b (R293 / PARKAN-23)**. This is the source of truth for the
open-source attribution that **AN12's licences screen** must show, beside the
border polygon's ODbL.

## What ships

The app's icons are **Lucide** glyphs, converted to Android vector drawables and
committed under `android/app/src/main/res/drawable/`. There is **no runtime
dependency** (R136): nothing is fetched or linked at build or run time — the
drawables are plain XML in the repository.

| Drawable | Lucide name | Used by |
|---|---|---|
| `ic_sun.xml` | `sun` | bottom nav — Aujourd'hui |
| `ic_calendar.xml` | `calendar` | bottom nav — Calendrier |
| `ic_file_text.xml` | `file-text` | reserved for AN11 — Relevé (not yet shown) |
| `ic_settings.xml` | `settings` | reserved for AN12 — Paramètres (not yet shown) |
| `ic_circle_check.xml` | `circle-check` | ZoneBadge — conforme |
| `ic_triangle_alert.xml` | `triangle-alert` | ZoneBadge — exposition mission |
| `ic_circle_x.xml` | `circle-x` | ZoneBadge — régime perdu |
| `ic_octagon_alert.xml` | `octagon-alert` | ZoneBadge — bascule sociale |
| `ic_building_2.xml` | `building-2` | answer line — *En Suisse* |
| `ic_house.xml` | `house` | answer line — *Domicile* |
| `ic_briefcase.xml` | `briefcase` | answer line — *Mission (France)* |
| `ic_plane.xml` | `plane` | answer line — *Mission (pays tiers)* |
| `ic_calendar_x.xml` | `calendar-x` | answer line — *Absence* |

The five answer-line glyphs were added by **AN-ANSWER-ICON (R430)**: once a day
is recorded the choice card closes into one answer line, and that line carries
the icon of what was answered. None of them reads as location tracking — no pin,
no flag, no map (DESIGN-SYSTEM §2). `AnswerIconDrawablesTest` ties each file to
the Lucide glyph and the version named below, so the drawable and this table
cannot drift apart.

**This table does not yet list every committed drawable.** Nine icons added by
tasks between AN10b and AN-ANSWER-ICON — `ic_bell`, `ic_calendar_check`,
`ic_chevron_left`, `ic_clock`, `ic_info`, `ic_lock`, `ic_mail`, `ic_search`,
`ic_user` — carry the same Lucide header in their own XML and are absent from
the rows above. The gap is recorded here rather than closed by this task: it
belongs to no single task, and the licence those nine would carry (ISC, plus the
Feather MIT addition for `chevron-left`, `clock`, `info`, `lock`, `search` and
`user`, which are on the derived list below) is already stated verbatim.

## Provenance

- Package: **lucide-static v1.48.0**
- Fetched from: `https://unpkg.com/lucide-static@1.48.0/icons/<name>.svg` and
  `https://unpkg.com/lucide-static@1.48.0/LICENSE`
- Fetched on: **2026-09-29**
- Conversion: each SVG (24×24, `fill=none`, `stroke=currentColor`,
  `stroke-width=2`, round cap/join) was converted to a `<vector>` whose paths
  carry the same stroke geometry; `<circle>`/`<rect>` were expressed as path
  data. `Icon(tint = …)` recolours the stroke at each call site.

## Licence (R167 — the instrument, recorded verbatim)

Lucide is **ISC**-licensed. Per Lucide's own `LICENSE`, some glyphs are derived
from the **Feather** project and additionally carry the **MIT** licence — of the
thirteen above, `calendar`, `triangle-alert` (Feather `alert-triangle`),
`circle-x` (Feather `x-circle`) and `octagon-alert` (Feather `alert-octagon`)
are on that Feather-derived list. The five AN-ANSWER-ICON glyphs are **not**:
`building-2`, `house`, `briefcase`, `plane` and `calendar-x` appear nowhere on
it (Feather had `home` and `calendar`, which are different names), so they are
ISC only. The full `LICENSE` file, verbatim, follows.

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
