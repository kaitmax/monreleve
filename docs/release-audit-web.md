# Release audit — Mon Relevé (web)

**FW29.** One question per criterion: *is this true today, and what proves it?*

Every line below cites evidence **produced or re-run in this session**. A
report from an earlier task is a **pointer**, never the evidence. A criterion
whose evidence could not be re-run is **UNVERIFIED**, never MET.

| | |
|---|---|
| Commit | `abfab6a1dcdc87c086775474995baa4bab0b1f56` |
| `gate:clone` | **PASSED** on that commit, fresh clone, no `.env`, scratch database |
| CI | run `35974016195`, same commit, `CI_FULL` on |
| Audited | 2026-09-24 |

> **This audit builds nothing and fixes nothing.** Where it finds a gap it
> records a finding or a NEEDS entry. That is the whole of its output.

---

## 1. The full chain, re-run in this session

Every figure below was produced tonight, on this commit.

| Suite | Result | Command |
|---|---|---|
| `typecheck` | exit 0 | `pnpm typecheck` |
| `lint` | exit 0 (eslint + stylelint) | `pnpm lint` |
| `test` | **2 877 passed** | `pnpm test` |
| `build` | exit 0 | `pnpm build` |
| `test:e2e` | **284 passed** | `pnpm test:e2e` |
| `test:visual` | **108 passed**, zero tolerance | `pnpm test:visual` |
| `test:a11y` | **139 passed** (6 files) | `pnpm test:a11y` |
| `test:runtime` | **9 passed** | `pnpm test:runtime` |
| `test:db` | **542 passed** | `pnpm test:db` |
| `test:late` | **10 passed** | `pnpm test:late` |
| `test:container` | **16 passed** | `pnpm test:container` |
| `test:container:e2e` | **270 specs + 9 over HTTP** | `pnpm test:container:e2e` |
| `test:container:scheduler` | **4 passed** | `pnpm test:container:scheduler` |
| `test:container:restore` | **6 passed** | `pnpm test:container:restore` |
| `test:coverage` | **100 %** stmts/branches/funcs/lines | `pnpm test:coverage` |
| `size` | all gated routes pass A and B | `pnpm size` |
| `gate:clone` | PASSED | `pnpm gate:clone` |

### Coverage, exactly

```
Statements   : 100% ( 313/313 )
Branches     : 100% ( 180/180 )
Functions    : 100% ( 55/55 )
Lines        : 100% ( 299/299 )
```

### Size, exactly

Budget A is ≤ 125 KiB total first-load JS per public route; budget B is ≤ 25
KiB of feature delta over the recorded framework floor of **100.6 KiB**.

| Route | Total KiB | Delta | Spare (A / B) |
|---|---|---|---|
| `/calculateur-teletravail-frontalier` | 121.3 | 20.7 | **3.7 / 4.3** |
| `/guides/[slug]` | 108.8 | 8.2 | 16.2 / 16.8 |
| `/releve-annuel`, `/sources`, `/tarifs` | 107.7 | 7.1 | 17.3 / 17.9 |
| `/application`, `/cgu`, `/confidentialite`, `/guides`, `/mentions-legales` | 107.6 | 7.0 | 17.4 / 18.0 |
| `/releve/print` | 101.9 | 1.3 | 23.1 / 23.7 |

**FINDING (not a failure): the calculator has 3.7 KiB of spare under GATE A.**
It passes. It is also the one route where a moderate feature would breach the
budget, and it is the route most likely to receive one. Recorded so the next
person to add to it knows before they start rather than after.

Fonts (47.1 KiB preloaded, 130.2 KiB on disk) and CSS are **reported and never
gated** — R2 — and polyfills (38.6 KiB gzip, served `nomodule`) are excluded.

---

## 2. The closed-world checks

These are the checks that go stale **silently**: they keep passing while their
scope quietly stops covering the thing they were written for. For each, the
question is not *does it pass* but **is its scope derived or listed?**

**A listed scope is a finding.**

| Check | Scope | Derived? |
|---|---|---|
| Entry points (R246) | Next's filename conventions under `app/**`, plus a closed-world census of the package root | **derived** — and the root half is closed-world, so an unclassified file fails |
| Declaration parity (R185) | every `.d.mts` beside a `.mjs`, anywhere in the package | **derived** — was `scripts/` only until FW28 |
| Glob canaries | walks | **derived** |
| French literals (R155) | walks `lib/fr` and `content/guides` | **derived** |
| No gradients (R82) | walks | **derived** |
| `innerHTML` | walks | **derived** |
| `next/link` (R\*) | walks | **derived** |

**All seven derive their scope.** None is a listed set that somebody has to
remember to extend.

Two of them were **narrower than their own documentation claimed**, and both
were corrected during FW28 rather than tonight:

- **Declaration parity** said parity was "asserted, not argued" while globbing
  `scripts/` only — correct solely because every `.mjs` happened to live there.
  The first declaration outside it (`lib/deploy/placeholders.d.mts`) arrived
  uncovered.
- **The entry-point census** scanned for code *extensions*, so it could not see
  a `Dockerfile` — a file that decides what exists to run at all.

Both are the same shape: **a scope that was correct only because nothing had
moved yet.** That is the failure mode this section exists to look for, and it
is worth stating that it was found twice in one task.

---

*Sections 3 onward — SPEC §21 criterion by criterion, the standing mechanisms
re-proven, the human gates and the consolidated NEEDS list — follow as each is
produced.*
