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

## Final table

Verbatim from `pnpm size` on the final commit:

```
First-load JS per route (gzip level 9). Ruling R2 gates:
  GATE A  total <= 125.0 KiB
  GATE B  delta <= 25.0 KiB over the 100.6 KiB framework floor

route                 bucket   js total   delta    css  fonts  verdict
----------------------------------------------------------------------------------
/                     public      100.6     0.0    1.5   47.1  pass (A 24.4 spare, B 25.0 spare)
/_not-found           public      101.5     0.9    1.5   47.1  pass (A 23.5 spare, B 24.1 spare)
/dev/composants       dev         100.6     0.0    1.5   47.1  not gated - would pass (A 24.4 spare, B 25.0 spare)
/dev/spike            dev         103.1     2.5    2.8   47.1  not gated - would pass (A 21.9 spare, B 22.5 spare)
----------------------------------------------------------------------------------
css   reported, never gated: it is not JS.
fonts reported, never gated: 47.1 KiB preloaded (latin subset), 130.2 KiB across 2 file(s) on disk. woff2 is already compressed.
polyfills excluded: 38.6 KiB gzip / 110.0 KiB raw, served nomodule.
framework floor: 100.6 KiB, measured on next 15.5.25 / react 19.2.8, 07.09.2026.

All gated routes pass both gates.
```

## Decision: GO

Both gates pass with the representative component set in place, with room to
spare. `pnpm size` is green.

| | Gate A (total ≤ 125.0) | Gate B (delta ≤ 25.0) |
|---|---|---|
| representative page | 103.1, **21.9 KiB spare** | 2.5, **22.5 KiB spare** |

Nothing needs escalating and no gate needs changing. The component vocabulary
this project has chosen — Sass tokens, CSS Modules, `lucide-react`, Inter
variable, one interactive island per page — fits inside the budget with about
88 % of the allowance unused.

### What the 22.5 KiB still has to cover

The spike deliberately measured presentation only. Still to land on a public
route, with a guess at each:

| Arriving in | What | Expectation |
|---|---|---|
| FW3–FW5 | `lib/calc-engine` — pure TS, zero runtime deps | small, single-digit KiB |
| FW6–FW7 | zones, French formatters, `renderRailSvg` | small; `Intl` is a platform API |
| FW8–FW9 | the real components replacing this spike's markup | comparable to the 2.5 KiB measured here |
| FW13 | URL params codec | under 1 KiB |
| FW15 | JSON-LD, Umami — a same-origin script, not bundle JS | no first-load JS |

The engine is the only unknown of any size, and it is pure TypeScript with no
dependencies by spec. On the evidence here, a calculator route landing around
108–112 KiB total is the realistic expectation, well inside Gate A.

### Two observations for the operator, neither requiring action

1. **Gate A binds before Gate B today, by 0.6 KiB.** Gate A caps the total at
   125.0; Gate B caps it at 100.6 + 25.0 = 125.6. So as configured, Gate B
   cannot fail without Gate A having failed first. This is not a defect in the
   ruling — the two gates measure different things and diverge the moment the
   floor moves. If a framework upgrade lowered the floor to, say, 90 KiB, Gate
   B would become the binding gate at 115 KiB and would correctly stop us from
   spending the windfall. It is worth knowing which gate is live, and today it
   is A.
2. **`/_not-found` carries 0.9 KiB of delta that is not ours.** It is Next's
   built-in 404. Nothing in our code affects it, and it passes both gates
   comfortably, but it will always show a non-zero delta.

### What this spike does not prove

- **LCP.** Gate A is a byte budget. The `< 2.5 s` slow-4G requirement is a
  separate Lighthouse gate that tightens at FW11. The FW1 baseline run
  measured LCP 0.6 s on desktop preset, which is not the same test.
- **Behaviour.** The island's stepper, accordion and panel were built to be
  weighed. They have no tests beyond the build's own prerender, and they are
  not the components FW8–FW9 will ship.
- **Multiple islands.** One island per route was measured. A route with three
  independent islands pays more React boundary overhead, though not more
  React.
