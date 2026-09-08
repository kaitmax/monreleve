# Checkpoint A

Checkpoint A closes Phase 1. It has **two halves and they are not
interchangeable.**

The **machine checks** below are run by the build and recorded here. They
prove the engine computes what the fixtures say it computes, that the
component layer renders and is readable, and that the guards which keep those
true are themselves alive. They are ticked because a command exited zero and
the evidence is named beside each one.

The **human gate** is the regulatory verification of every constant against a
primary source. It is the operator's work and it is **entirely unverified**.
No machine check substitutes for it: the fixtures could be reproduced exactly
and every one of them still be built on a misread of the avenant. What the
machine checks establish is that the code agrees with the fixtures — not that
the fixtures agree with the law.

Recorded 08.09.2026 at `bbdc06f`; **REVISED 08.09.2026** at the end of FW9,
over the NINE-component library.

WHY THE FIRST RECORD HAD TO BE REVISED RATHER THAN APPENDED TO. It was
written when seven components existed, and `tasks/plan.md` requires "visual
baselines + a11y green for all NINE". Every row was true and row 5 was
true-but-incomplete in a way a reader could not see: "29 baselines" over
seven components reads exactly like "29 baselines" over nine. Appending a
note would have left the misleading number in the table.

---

## Machine checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | All six Geneva cases exact, including 39,16 % and 4,16 % | ☑ pass | `tests/unit/calc-engine/fixtures.test.ts` — 20 tests |
| 2 | Denominator and rate fixtures | ☑ pass | `denominator.test.ts` + `rate-fixtures.test.ts` — 94 tests |
| 3 | 100 % coverage on `lib/calc-engine` and `lib/ui/core` | ☑ pass | 285/285 statements, 173/173 branches, 51/51 functions; per-directory thresholds, never averaged. Unchanged: FW9 added no code to either directory |
| 4 | The eight invariants | ☑ pass | `properties-1-4.test.ts` + `properties-5-8.test.ts` — 25 tests, fast-check |
| 5 | Every component baseline green, **all nine components** | ☑ pass | 35 baselines, 33 distinct; `pnpm test:visual` — 38 passed, in the container (R37), verified in COMPARE mode |
| 6 | Contrast audit green | ☑ pass | `tests/unit/tokens/contrast.test.ts` — 107 assertions, computed from the compiled tokens, resolving each rule's EFFECTIVE background (R76) |
| 7 | `dangerouslySetInnerHTML` uniqueness | ☑ pass | `tests/unit/meta/inner-html.test.ts` — 6 tests |
| 8 | The 200 px thumbnail-legibility artifact present | ☑ pass | `web/tests/visual/baselines/rail-inline-200px.png`, 2 822 bytes |

CI on `origin/main`: green through `fb59c3a`
(https://github.com/kaitmax/Frontalier/actions/runs/34204083340).

TWO COMMITS IN BETWEEN WERE RED, and the reason belongs in this record
rather than only in a session report. Ruling R73 lengthened the metric tile
labels - "Jours restants" became "Jours restants avant 40,0 %" - so the
content-sized specimen cards grew from 570 px to 605 px and two baselines no
longer matched. The increment that changed the copy was gated with typecheck,
lint, unit tests and build, but NOT `pnpm test:visual`, and rendered-text
width is only caught there. `135ea8c` and `1dcccf1` are red for that reason
and nothing else; the regenerated baselines land with this revision.

THE LESSON IS A RULE, not a note: a change to any string that reaches the
screen invalidates a baseline, so the visual run is part of green for that
increment. A copy edit is a visual change.

### Each check was proven to be capable of failing

A green check that cannot go red records nothing. Each of these was falsified
at least once, deliberately, and the failure observed:

- **Coverage (3).** An uncalled export planted in `lib/ui/core/format/number.ts`
  produced `ERROR: Coverage for functions (97.22%) does not meet
  "lib/ui/core/**" threshold (100%)` — naming the directory, so the gate is
  demonstrably not passing on `lib/calc-engine` alone. The engine half was
  falsified in FW7 by an unreachable branch, which took it to 98,79 %.
- **Baselines (5).** Verified in **compare** mode, never from the update run —
  an update writes the file and then passes against what it just wrote, which
  is a green that means nothing.
- **Contrast (6).** The warning colour planted as body text fails at 3,43:1;
  the same colour at Display 48/600 passes. Both directions recorded, because
  the audit's value is the distinction rather than the pass.
- **innerHTML (7).** A second injection site planted on `app/page.tsx` fails
  two tests by name; stripping the written reason from the dev harness's
  eslint directive fails a third.
- **The suite itself.** `scripts/check-suite-floor.mjs` (ruling R63) holds the
  floor at 56 files / 1 005 tests and requires four glob canaries to have been
  collected. Without it, an include glob that stopped matching would remove
  tests from the run while `pnpm test` still exited zero — measured: a broken
  glob dropped the suite to 676 passing and stayed green.

---

## Human gate — UNVERIFIED

**Nothing below has been verified.** None of it may be ticked from an advisory
summary, a secondary article, or a previous version of this file. Each needs
the primary text.

Until this section is complete, `LAST_REGULATORY_REVIEW` in
`web/lib/content/regulatory.ts` stays `null` and the footer renders
*« Vérification réglementaire en cours »* rather than a date (ruling R51). The
site must never display a review date that has not happened.

### The constants — `RuleSet(2026)`

Source of record: `docs/regulatory-sources.md`, table under *Constants*.

| # | Constant | Value | Primary source to obtain | Verified by | On |
|---|---|---|---|---|---|
| 1 | `fiscalCeiling` | `0.4` | Avenant of 27 June 2023 to the France–Switzerland double-taxation convention, in force 1 January 2026 | ☐ | ☐ |
| 2 | `missionCapDays` | `10` | Same avenant; interpretative agreement of 29 April 2026 | ☐ | ☐ |
| 3 | *(proration rule)* | rounded up | Amicable agreement of 30 June 2023 | ☐ | ☐ |
| 4 | `socialCeiling` | `0.499` | EU framework agreement on telework; art. 16 of regulation (EC) 883/2004 | ☐ | ☐ |
| 5 | `simplifiedBasisDays` | `240` | Circular no. 45 of 12 June 2019, point 7.5.1 | ☐ | ☐ |
| 6 | *(day classification)* | >4 h = 1 day; 2–4 h = ½ | Circular no. 45 of 12 June 2019, point 7.5.1 | ☐ | ☐ |
| 7 | `residence1983Cantons` | BE, SO, BS, BL, VD, VS, NE, JU | Amicable agreement on the accord of 11 April 1983 | ☐ | ☐ |

### The open questions

These are not lookups. Items marked **INTERPRETATION** are readings this
codebase adopted in the absence of a source and go to the named expert
reviewer, not to a website.

| # | Question | Kind | Verified by | On |
|---|---|---|---|---|
| 8 | `A1_REQUIRED` — is there a telework share below which no A1 is required? | INTERPRETATION (R18) | ☐ | ☐ |
| 9 | Mission-cap proration under the exact method — against the employer's own total, or a full-time year? | INTERPRETATION (R19) | ☐ | ☐ |
| 10 | Truncation versus rounding of the declarable rate — is truncation the filing rule, or an artefact of how the worked examples were printed? | SOURCE | ☐ | ☐ |
| 11 | Is the social ceiling a legal maximum of 49,9 %, or shorthand for "strictly under 50 %"? | INTERPRETATION (R32) | ☐ | ☐ |
| 12 | The interpretative agreement of 29 April 2026 is held **second-hand** — obtain the text itself. | SOURCE | ☐ | ☐ |

### Why item 10 is the one that moves the most

`tasks/plan.md` records that **invariant 7 inverts if the rule is rounding**.
The engine truncates to two decimals because the AFC publishes 39,16 % for
94/240 and 4,16 % for 10/240, where rounding gives 39,17 and 4,17. If
truncation turns out to be a printing artefact rather than the filing rule,
the fixtures change, a property inverts, and Checkpoint A reopens. It is
cheap to ask and expensive to assume.

Item 11 is the second: 49,9 % as a maximum and 49,9 % as shorthand for "under
50 %" put the *same* declarable rate on opposite sides of the social
threshold, and truncation to two decimals means 49,99 is a value the engine
really can produce.

---

## What Checkpoint A does not gate

**FW10 may proceed** with the human gate open (ruling R50): it touches nothing
that depends on a constant.

**FW11 IS NO LONGER GATED ON THIS, and that is a correction to the first
version of this file.** It said the calculator may not start until the gate
is recorded, following R50. Ruling R54 supersedes R50's FW11 clause: the
calculator is built HIDDEN - noindex and excluded from the sitemap - while
`LAST_REGULATORY_REVIEW` is null, so the work can proceed without any
unverified number reaching a reader. What the gate still blocks is
PUBLISHING it. It is the surface that turns a constant into an answer a user
acts on, and shipping it
against unverified constants would put a number in front of a cross-border
worker that no one has checked against the law.
