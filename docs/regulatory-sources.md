# Regulatory sources

Every constant in `web/lib/calc-engine/rules.ts` is listed here with its
primary reference. One entry per constant. If a figure is not in this file, it
does not belong in the engine.

> ## TRANSCRIPTION VERIFIED 09.09.2026 against primary sources. LEGAL REVIEW PENDING — three items below.
>
> The Checkpoint A pass of **09.09.2026** checked these figures against the
> primary sources rather than the advisory ones SPEC §7.1 was drafted from.
> What that pass establishes, and what it does not:
>
> **VERIFIED — the transcription is correct.** Every row ticked below was read
> off the primary source named beside it. The six Geneva worked examples match
> on their inputs and on all four outputs. Truncation to two decimals is
> confirmed rather than inferred.
>
> **NOT ESTABLISHED — legal review.** Transcribing a published figure
> correctly is not a lawyer confirming that the product's *reading* of it is
> right. Three interpretations remain open under *STILL PROVISIONAL* below,
> and each goes to the named expert reviewer.
>
> **TWO ROWS THIS PASS DID NOT COVER,** recorded here rather than left to be
> discovered: the day-classification rule (over 4 h / 2–4 h) and the
> 1983-accord canton list. Neither appears in the 09.09.2026 verification, so
> both keep an unchecked box. No Geneva fixture reaches either — the published
> cases count days rather than hours, and Genève is a `source` canton.
>
> `LAST_REGULATORY_REVIEW` is now `"2026-09-09"` (R51), so the footer carries a
> real date and the calculator's R54 gate is open.

Drafted 07.09.2026, in FW3. Engine status added 07.09.2026, in FW5.

---

## ENGINE STATUS

The engine is code-complete as of FW5. **Checkpoint A ran on 09.09.2026**: the transcription is verified and three interpretations remain open (P1-P3 below). The fixtures are frozen.
What follows is the honest division between what is proven, what is proven
only against itself, and what is not proven at all — because those three are
easy to conflate once a test suite is green.

### Proven against an external authority

The six worked examples published by the Geneva tax administration, in
`fixtures/geneva-cases.json`. They are the only claims in this engine that an
outside party has stated and we merely reproduce:

| Case | Telework | Missions | Swiss | France | Rate |
|---|---|---|---|---|---|
| a | 72 | 0 | 240 | 0 | 30,00 % |
| b | 91 | 8 | 237 | 3 | 40,00 % |
| c | 84 | 24 | 226 | 14 | **39,16 %** |
| d | 94 | 12 | 230 | 10 | 40,00 % |
| e | 144 | 5 | 91 | 149 | 60,00 % |
| special | 0 | 30 | 220 | 20 | **4,16 %** |

The two bold values are the reason the engine truncates rather than rounds.
The cases were written down and shown **failing** before any waterfall
existed, so the arithmetic was made to match the AFC and not the reverse.

**Caveat, and it matters:** the table itself was transcribed from
`SPEC-frontalier-web.md` §7.5, not from the AFC publication. Until someone
opens the publication, this is proof that the engine matches the *spec's
transcription* of the authority.

### Proven internally, by property

Eight invariants from SPEC §7.6, each over 10 000 generated cases spanning
part-time rates, mid-year periods, both denominator methods and all three
granularities. Each is paired with a deliberately broken variant that
`fast-check` must falsify, so a property cannot pass by being vacuous.

These prove the engine is **self-consistent** — days are never lost or double
counted, the credit never exceeds either limit, truncation never overstates.
They cannot prove any of it is the *right* rule.

Two further guards: `fixtures/denominator-cases.json` and
`fixtures/rate-cases.json` pin arithmetic defects that exist only because of
binary floating point. They protect against a class of silent one-day and
one-hundredth errors, and the rate file protects the number filed with the
AFC specifically.

### Not verified at all

- **Every constant** in `RuleSet(2026)`. All seven were drafted from advisory
  sources. See the table below and the verification list.
- **Two interpretations** the codebase adopted where no source speaks: the
  `A1_REQUIRED` trigger and the mission-cap proration under the exact method.
  Both carry `PROVISIONAL` markers in the code.
- **Whether truncation is the filing rule** or an artefact of how the worked
  examples were printed.
- **The interpretative agreement of 29 April 2026**, held second-hand, which
  is the source for the mission sub-cap sitting *inside* the 40 % rather than
  beside it — and that single reading changes every result the engine
  produces.

### The three fixture files

`fixtures/geneva-cases.json`, `fixtures/denominator-cases.json` and
`fixtures/rate-cases.json` are **frozen at Checkpoint A** and are consumed by
the Kotlin engine at AN2 as well as by the TypeScript engine now. A divergence
on any case fails both builds (D20). They are language-neutral for that
reason: periods are exact ratios rather than decimals, because a decimal
transcription of 7/12 parses to a different double and would fail to reproduce
the very defect it pins.

Never edit an expected value to make code pass. A case that will not pass is a
question for the operator.

---

## Constants in `RuleSet(2026)`

| # | Constant | Value | Rule | Primary source (to verify) | Verified |
|---|---|---|---|---|---|
| 1 | `fiscalCeiling` | `0.4` | 40 % of annual working time (art. 10) | Avenant **signed 27.06.2023, in force 24.07.2025, applicable from 01.01.2026** — three distinct dates; admin.ch communiqué msg-id-96063, economie.gouv.fr, Sénat l24-480 | ☑ transcription: ge.ch/admin.ch, 09.09.2026 — legal review pending |
| 2 | `missionCapDays` | `10` | 10 days/year of mission, **inside** the 40 % | Same avenant; ge.ch, *"double limite annuelle"*. **The "interpretative agreement of 29 April 2026" cited here until 09.09.2026 was not found in any primary source and is deleted (R9)** — the interpretation is the amicable agreement of 30 June 2023 | ☑ transcription: ge.ch/admin.ch, 09.09.2026 — legal review pending |
| 3 | *(proration rule)* | — | Mission cap prorated for part-time and partial years, **rounded up** | ge.ch, citing the amicable agreement of 30 June 2023 | ☑ transcription: ge.ch/admin.ch, 09.09.2026 — legal review pending |
| 4 | `socialCeiling` | `0.499` | 49.9 %, conditional on a valid A1 | bsv.admin.ch/fr/teletravail: *"jusqu'à 50% (au maximum 49.9%)"*. The legal text is *less than 50%*; 49,9 is the published maximum. The band stays **> 49,9**, which over-warns between 49,9 and 50 — the safe direction. See **P2** | ☑ transcription: ge.ch/admin.ch, 09.09.2026 — legal review pending |
| 5 | `simplifiedBasisDays` | `240` | 240 working days/year at full time | Circular no. 45 of 12 June 2019, point 7.5.1; used in all six ge.ch worked examples | ☑ transcription: ge.ch/admin.ch, 09.09.2026 — legal review pending |
| 6 | *(day classification)* | — | Over 4 h = 1 day; 2–4 h = ½ day | Circular no. 45 of 12 June 2019, point 7.5.1 | ☐ **pending — NOT covered by the 09.09.2026 pass.** The published cases count days, not hours, so no fixture reaches it |
| 7 | `residence1983Cantons` | BE, SO, BS, BL, VD, VS, NE, JU | Same 40 % ceiling; frontalier **status** itself at risk on breach | Amicable agreement on the accord of 11 April 1983 | ☐ **pending — NOT covered by the 09.09.2026 pass.** Genève is a `source` canton, so no published example reaches this list |
| 8 | `a1ThresholdRate` | `0.25` | The telework share from which the EU framework agreement — and so its A1 — applies; below it **art. 13 of reg. (EC) 883/2004** governs instead | bsv.admin.ch/fr/teletravail. **Added at Checkpoint A**, replacing the provisional reading that fired `A1_REQUIRED` on any counted day at all | ☑ transcription: ge.ch/admin.ch, 09.09.2026 — legal review pending |

## Notes per entry

**1. Fiscal ceiling, 40 %.** The number the whole product exists to track. It
is a share of *annual working time*, not of calendar days, which is why the
denominator (entry 5) matters as much as the ceiling itself.

**2 and 3. Mission sub-cap, 10 days.** Sits *inside* the 40 %, so mission days
compete with telework days for the same allowance rather than adding to it.
The proration rounds **up**, which is the one rule in the engine that favours
the user; SPEC §7.2 step 4 states it explicitly.

**4. Social ceiling, 49.9 %.** A different legal fact from the fiscal ceiling,
with a different consequence: crossing it moves social-security affiliation
rather than tax. Conditional on a valid A1. `DESIGN-SYSTEM.md` §2 records that
the external design system omitted this threshold entirely and that it cannot
be dropped.

**5. Simplified denominator, 240 days.** Absorbs leave, public holidays and
sickness, so the engine performs no calendar arithmetic and needs no holiday
table. The employer chooses between this and an exact count and must apply the
choice uniformly; the engine mirrors that choice and never invents one.

**6. Day classification.** Lives in `granularity.ts`, not in `RuleSet`,
because SPEC §7.7 fixes the `RuleSet` shape and these are not among its
fields. Recorded here because it is a sourced regulatory rule like the others.

**7. The 1983-accord cantons.** Eight of twenty-six. The ceiling is the same;
the consequence is not. Under `source`, French tax falls on the excess days.
Under `residence-1983`, the frontalier status itself is at risk. The engine
reports which regime applies; the wording lives in `lib/fr`.

## CHECKPOINT A — RESULT, 09.09.2026

The pass read the primary sources and recorded what they say. It did **not**
obtain a legal opinion, and the distinction is the point of this section:
six of eight constants are now verified transcriptions, and three
interpretations remain open.

### Verified beyond the constants table

These are not `RuleSet` fields, so they have no row above, but each is a
sourced regulatory fact the engine depends on.

- ☑ **The six Geneva worked examples.** https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/regles-missions-temporaires-etranger, updated 19.05.2026. All six
  match on their inputs **and on all four outputs**. This is the assertion
  SPEC §7.5 rests on: *"If any fails, nothing ships."*
- ☑ **Truncation to two decimals — confirmed, not inferred.** The same page
  publishes **39,16 %** for 94/240 and **4,16 %** for 10/240. Rounding would
  give 39,17 and 4,17. This closes SPEC §22 question 4, and invariant 7
  stands as written.
- ☑ **Missions are excluded when telework alone already exceeds 40 %.** Same
  page, case (e), an explicit sentence.
- ☑ **Mission travel-day rules.** Same page, FAQ table — matches SPEC §7.2
  step 3 exactly. A travel day with no work performed, or worked mostly in
  Switzerland, is not counted.

### STILL PROVISIONAL — LEGAL REVIEW REQUIRED (3 items, was 5)

Each of these is a **reading** this codebase adopted where no source speaks.
They go to the named expert reviewer, not to a website.

- ☐ **P1 — the France-before-third-state imputation ORDER.** ge.ch treats
  *"France ou un autre État"* as a single pool in all six published cases and
  never orders them. Our waterfall imputes France first, on no primary
  source. **Harmless in the fixtures** — no published case splits the two —
  **and real for a user who does.** This is what survives of the deleted
  "29 April 2026 interpretative agreement": the citation was wrong, but the
  question it was supposed to answer is still open.

- ☐ **P2 — the 49,9 versus < 50 edge under two-decimal truncation.**
  49,95 % is legally below 50 and above the published 49,9, so the product
  **over-warns** between the two. The band stays `> 49,9` because
  over-warning is the safe direction for a signal that drives copy and no
  arithmetic — and truncation really can produce 49,99, so this is a value
  the engine reaches rather than a hypothetical. *Confirm that over-warning
  is acceptable.* (Was ruling R32.)

- ☐ **P3 — mission-cap proration under the exact method (ruling R19).**
  ge.ch prorates for part-time **and** partial year but does not address an
  employer-supplied exact total. The interim reading stands: prorate by
  `periodFraction` only under `exact`, and by both factors under
  `simplified240`, because an exact total is the days actually worked and so
  already embodies the working-time rate — prorating by `employmentRate`
  again would count the same reduction twice and quietly cost a part-timer
  mission days. `EXACT_METHOD_UNVERIFIED` fires on this path, and the site
  keeps its `PROVISIONAL` marker.

### Resolved by this pass

- **A1_REQUIRED's trigger** (was ruling R18, PROVISIONAL). It fired whenever
  any day was counted against the ceiling — a standing obligation the product
  announced rather than a threshold it detected. The framework agreement
  applies **from 25 %** telework to under 50 %; below 25 %, art. 13 of
  reg. (EC) 883/2004 governs and the A1 is not the instrument in question.
  Now `a1ThresholdRate` (row 8) and the `PROVISIONAL` marker is off.

  *Concretely:* Geneva case `special` has 0 telework days and 30 mission days
  in France, 10 of them credited. The old trigger fired A1_REQUIRED on it —
  telling a frontalier who never teleworked to hold a document for a rule
  that does not govern them. It no longer does.

- **The "interpretative agreement of 29 April 2026" does not exist.** No
  primary source names it. Deleted from this file, from SPEC §7.1, from
  SPEC §22 and from `rules.ts`. The rule it was cited for is unchanged.

- **Truncation versus rounding.** See above; confirmed.

Rows 6 and 7 of the constants table were **not reached** by this pass and
keep their unchecked boxes. Neither is exercised by a Geneva fixture.

## What is deliberately not here

- **The Geneva worked examples.** They arrive at FW4 as
  `fixtures/geneva-cases.json`, pinned to `taxYear: 2026`, and are frozen at
  Checkpoint A. SPEC §7.5: *"If any fails, nothing ships."*
- **Reviewer cases.** `reviewer-cases.ts`, signed off by the expert reviewer,
  including at least one `residence-1983` canton and one part-time mid-year
  start. Checkpoint E.
- **Any 2027 rule set.** Adding a year requires its own sourced and reviewed
  fixture file before it can become the default (SPEC §7.7).
