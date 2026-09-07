# Bundle budget spike (FW2)

The week-one risk check. Build one representative, component-heavy page with
our own token layer, the Inter variable font and a dozen Lucide icons, measure
the real gzipped first-load JS, and decide **go** or **escalate** before any
feature page exists. Discovering a budget problem in week one is a config
change; discovering it in month three is a rewrite.

Numbers, not adjectives. Every figure below is measured by
`web/scripts/check-budgets.mjs` from the Next build manifests, gzip level 9,
each file compressed separately.

## Gates

Operator ruling **R2** (07.09.2026) replaced the single 100 KB web row of
SPEC §17, which was set against an older framework baseline and is not
achievable on Next 15 + React 19:

| Gate | Rule |
|---|---|
| **A** | total first-load JS per public route ≤ **125 KiB** gzip |
| **B** | feature delta ≤ **25 KiB**, where delta = route total − framework floor |

**Framework floor: 100.6 KiB**, measured in FW1 on `next 15.5.25` /
`react 19.2.8` / `react-dom 19.2.8` on 07.09.2026 — a bare route carrying one
`<h1>` and one `<figure>`, no feature code. It is the constant
`FRAMEWORK_BASELINE_KIB` in the budget script, and by ruling R2 it may be
re-measured only on a framework upgrade, in a commit titled
`chore: re-baseline framework floor`.

`/dev/**` is not a public route, so the gates do not block on it. The script
still prints the gate arithmetic for it, because answering "would a
representative public page fit?" is this spike's entire job.

## Measurements

| # | State | Route | js total | delta | css | fonts | Gate A | Gate B |
|---|---|---|---|---|---|---|---|---|
| 1 | bare route (framework floor) | `/` | 100.6 | 0.0 | 1.5 | 47.1 | pass | pass |
| 1 | spike skeleton — h1 + one paragraph | `/dev/spike` | 100.7 | 0.1 | 1.7 | 47.1 | would pass | would pass |
| 2 | full representative set + client island | `/dev/spike` | 103.1 | **2.5** | 2.8 | 47.1 | would pass, 21.9 spare | would pass, 22.5 spare |

All figures KiB, gzip level 9. `css` and `fonts` are reported for visibility
and are **never** counted against a JS gate (ruling R2). `fonts` is the
preloaded latin subset, the only face a French page fetches.

### Row 1 — skeleton

The spike page at this point is a heading and a paragraph, styled through
tokens in a CSS module. Its import list:

```
next            (Metadata type only, erased at build)
@/lib/fr/spike  (string constants)
./spike.module.scss
```

Delta of **0.1 KiB** over the floor. A Server Component that ships no client
JavaScript costs essentially nothing beyond the framework floor, which is the
result to keep in mind when reading the rows below: everything that follows is
paid for by interactivity and by icons, not by markup.

### Row 2 — full representative component set

Everything the spike was asked to assemble, in one route:

- header with four nav links and a primary button
- form card: labelled select, number input with minus/plus steppers, two
  radios, an accordion row
- table, six rows, hairline rules, tabular figures
- banner with a 4 px accent
- panel styled like a bottom sheet, radius 24 on the top corners only
- twelve distinct Lucide icons

Exact import list. Server Component (`page.tsx`):

```
next                       (Metadata type only, erased at build)
lucide-react               Calculator, CalendarDays, FileText, Info,
                           Smartphone, TriangleAlert
@/lib/fr/spike
./SpikeForm                (the client island)
./spike.module.scss
```

Client island (`SpikeForm.tsx`, `'use client'`):

```
react                      useState
lucide-react               Check, ChevronDown, Download, Minus, Plus, X
@/lib/fr/spike
./spike.module.scss
```

**Delta over the floor: 2.5 KiB.** Gate A has 21.9 KiB spare, Gate B 22.5 KiB.

The island is real, not accidentally server-only: the route ships 2.66 kB of
route-specific JS against 127 B for the purely-server `/`. That difference is
`useState`, the six icons imported into the island, and the event handlers.

The shape of the result matters more than the number. Our own component
vocabulary — tokens, CSS Modules, Lucide, one interactive island — costs about
2.5 KiB gzip. The framework floor costs 100.6 KiB. Roughly 97.6 % of a public
route's first-load JS is Next and React, and essentially none of it is ours.
That is why ruling R2's split into a floor and a delta measures the right
thing: Gate B is the only number this team can move.

### Row 3 — font payload and Lucide tree-shaking

**Fonts.** Inter is self-hosted, woff2, two subsets and no others, preloaded
from the root layout so the spike route carries it too:

| File | Bytes | KiB | Fetched on a French page |
|---|---|---|---|
| `inter-latin-wght-normal.woff2` | 48 256 | 47.1 | yes, preloaded |
| `inter-latin-ext-wght-normal.woff2` | 85 068 | 83.1 | no — gated by `unicode-range` |
| total on disk | 133 324 | 130.2 | — |

- **AC3, font subset under 60 KB: PASS.** The subset a page actually fetches
  is 48 256 bytes = 47.1 KiB = 48.3 kB, against a 60 KB criterion. It passes
  on either reading of KB.
- Cyrillic, Greek and Vietnamese subsets: **0 files** anywhere in `.next` or
  `public`. Nothing imports the package's `index.css` or `wght.css`, so they
  cannot be pulled in by accident.
- Preload present on `/dev/spike`, with `crossorigin` — fonts are fetched in
  CORS mode and a preload without it downloads the file twice:
  `<link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font"
  type="font/woff2" crossorigin="anonymous"/>`
- `tnum` reaches the built CSS (7 occurrences) and the spike's table and
  stepper both carry tabular figures.
- woff2 is already compressed, so these are on-disk bytes. Per ruling R2 they
  are reported and never counted against a JS gate.

**Lucide tree-shaking.** One icon import removed from the client island
(`Download`), rebuilt, measured, restored:

| Island icons | raw bytes | gzip bytes |
|---|---|---|
| 12 (`Check, ChevronDown, Download, Minus, Plus, X` + 6 server-side) | 358 034 | 105 595 |
| 11 (`Download` removed) | 357 807 | 105 526 |
| **delta** | **−227** | **−69** |

**AC3, tree-shaking: PASS.** The bundle shrinks measurably when a single icon
import is removed, which is what per-icon tree-shaking looks like: 227 raw
bytes is about the size of one Lucide SVG path plus its wrapper, and it
compresses to 69 bytes because icon path data is highly repetitive. If
`lucide-react` were being pulled in whole, removing one of 12 icons would move
nothing.

The corollary is the useful one for FW8 onward: at about 69 gzip bytes per
icon, the 22.5 KiB of Gate B headroom left after the representative set is
worth roughly 330 further icons. Icons are not a budget risk on this project,
and no icon-by-icon import discipline needs inventing.
