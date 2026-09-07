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

<!-- Rows 2+ are added by FW2 increments 2 and 3. -->
