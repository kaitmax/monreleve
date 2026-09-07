# Regulatory sources

Every constant in `web/lib/calc-engine/rules.ts` is listed here with its
primary reference. One entry per constant. If a figure is not in this file, it
does not belong in the engine.

> ## VERIFICATION PENDING — Checkpoint A
>
> **Nothing in this file has been checked against a primary source yet.** The
> figures below were drafted from the advisory sources that `SPEC-frontalier-web.md`
> §7.1 was itself written from. Before the Geneva fixtures are frozen, every
> row must be verified against **admin.ch**, the **AFC** (Administration
> fiscale cantonale, Genève) and **impots.gouv.fr**, and its *Verified* column
> filled in with the URL and the fetch date.
>
> SPEC §7.1 is explicit about why: *"advisory sources are how this spec was
> drafted, not how the engine ships."* This banner comes off only at the
> Checkpoint A human gate, when `docs/regulatory-sources.md` is dated and
> signed and `fixtures/geneva-cases.json` is published for the Kotlin port.
>
> Until then, treat every number below as **provisional**.

Drafted 07.09.2026, in FW3.

---

## Constants in `RuleSet(2026)`

| # | Constant | Value | Rule | Primary source (to verify) | Verified |
|---|---|---|---|---|---|
| 1 | `fiscalCeiling` | `0.4` | 40 % of annual working time (art. 10) | Avenant of 27 June 2023 to the France–Switzerland double-taxation convention, in force 1 January 2026 | ☐ pending |
| 2 | `missionCapDays` | `10` | 10 days/year of mission, **inside** the 40 % | Same avenant; interpretative agreement of 29 April 2026 | ☐ pending |
| 3 | *(proration rule)* | — | Mission cap prorated for part-time and partial years, **rounded up** | Amicable agreement of 30 June 2023 | ☐ pending |
| 4 | `socialCeiling` | `0.499` | 49.9 %, conditional on a valid A1 certificate | EU framework agreement on telework; art. 16 of regulation (EC) 883/2004 | ☐ pending |
| 5 | `simplifiedBasisDays` | `240` | 240 working days/year at full time | Circular no. 45 of 12 June 2019, point 7.5.1 | ☐ pending |
| 6 | *(day classification)* | — | Over 4 h = 1 day; 2–4 h = ½ day | Circular no. 45 of 12 June 2019, point 7.5.1 | ☐ pending |
| 7 | `residence1983Cantons` | BE, SO, BS, BL, VD, VS, NE, JU | Same 40 % ceiling; frontalier **status** itself at risk on breach | Amicable agreement on the accord of 11 April 1983 | ☐ pending |

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

## CHECKPOINT A — VERIFICATION REQUIRED

Everything below must be resolved before the fixtures freeze. Items marked
**INTERPRETATION** are not source questions at all — they are readings this
codebase adopted in the absence of a source, and they go to the named expert
reviewer rather than to a website.

- ☐ **A1_REQUIRED — when should it fire? (INTERPRETATION, ruling R18.)** The
  sources say only that the 49,9 % ceiling is *conditional on a valid A1*, and
  SPEC §7.4 lists the warning code with no condition attached. The engine
  emits it whenever any day is counted against the ceiling, on the reading
  that holding an A1 is a **standing obligation to state** rather than a
  threshold to detect. Over-warning is the safe direction for a signal that
  drives copy and no arithmetic. The site carries a `PROVISIONAL` marker
  (`web/lib/calc-engine/warnings.ts`). *Question for the reviewer: is there a
  telework share below which no A1 is required, and if so what is it?*

- ☐ **Mission-cap proration under the exact method (INTERPRETATION, ruling
  R19.)** No source addresses how the 10-day sub-cap prorates when the
  employer supplies an exact annual total rather than using the 240-day
  basis. The engine prorates by `periodFraction` **only** under `exact`, and
  by both factors under `simplified240`, reasoning that an exact total is the
  days actually worked and so already embodies the working-time rate —
  prorating by `employmentRate` again would count the same reduction twice and
  quietly cost a part-timer mission days. Documented in
  `fixtures/denominator-cases.json` under `missionCapCases`; the site carries
  a `PROVISIONAL` marker. `EXACT_METHOD_UNVERIFIED` already fires on this
  path. *Question for the reviewer: is the cap prorated against the
  employer's own total, or against a full-time year?*

- ☐ **Truncation versus rounding of the declarable rate.** The engine
  truncates to 2 decimals because the AFC publishes 39,16 % for 94/240 and
  4,16 % for 10/240, where rounding gives 39,17 and 4,17. SPEC §7.3 states
  that matching the authority beats being conservative, and `tasks/plan.md`
  records that invariant 7 inverts if the rule is rounding. *Confirm against
  the AFC publication that truncation is the filing rule and not an artefact
  of how the worked examples were printed.*

- ☐ **The interpretative agreement of 29 April 2026 is held second-hand.** It
  is the source for the mission sub-cap sitting *inside* the 40 % rather than
  beside it — which changes every result in the engine — and it reached this
  spec through an advisory summary, not the text. *Obtain the agreement
  itself.*

Every constant in the table above also carries its own unchecked box in the
*Verified* column, and none may be ticked from an advisory source.

## What is deliberately not here

- **The Geneva worked examples.** They arrive at FW4 as
  `fixtures/geneva-cases.json`, pinned to `taxYear: 2026`, and are frozen at
  Checkpoint A. SPEC §7.5: *"If any fails, nothing ships."*
- **Reviewer cases.** `reviewer-cases.ts`, signed off by the expert reviewer,
  including at least one `residence-1983` canton and one part-time mid-year
  start. Checkpoint E.
- **Any 2027 rule set.** Adding a year requires its own sourced and reviewed
  fixture file before it can become the default (SPEC §7.7).
