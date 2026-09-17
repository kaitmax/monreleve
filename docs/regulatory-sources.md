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

### ROWS 6 AND 7 — WHAT THE REVIEWER IS ASKED (added FW17)

Kept separate from P1–P3 above, because those are *readings adopted where no
source speaks* and these two are the opposite: **a source speaks and nobody
has opened it.** Conflating the two would blur the distinction this document
exists to keep.

Both reach a reader in FW17's guides, so each is written there under R146
case (b) — named as unresolved, linked to `/sources` — rather than stated
flatly or omitted.

- ☐ **Row 6 — the day classification (over 4 h = 1 day; 2–4 h = ½ day).**
  *Asked:* open circulaire no. 45 of 12 June 2019, point 7.5.1, and confirm
  the boundary.

  **Why it is not a formality.** The four-hour line decides whether a day
  counts once or by half, and that lands directly on the declarable rate —
  the number filed with the AFC. The published Geneva cases cannot settle it
  because the authority's own examples work in whole days, so the conversion
  sits one layer *below* anything Geneva demonstrates.

  **AND THE CALCULATOR'S DEFAULT RESTS ON IT.** `DEFAULT_GRANULARITY` on the
  public form is `'halfDay'` — an FW11 interpretation, recorded in that
  increment and in `CalculatorForm.tsx`: SPEC §9.3 puts step 0.5 on the
  visible day field, and the engine rejects a half-day value declared under
  granularity `'day'`, so both cannot hold. That default is only meaningful
  if half-days are a real unit of this rule. **The two move together**: if
  the reviewer's reading of point 7.5.1 changes the boundary or removes the
  half-day, the default is re-decided in the same change.

- ☐ **Row 7 — the eight 1983-accord cantons (BE, SO, BS, BL, VD, VS, NE,
  JU).** *Asked:* confirm the **membership list** against the text of the
  accord of 11 April 1983.

  **What is NOT asked, and the distinction is the point.** That two regimes
  exist and carry different consequences is settled — SPEC §7.2 step 1, the
  R125 copy items above, and the shipped result-panel branch that names the
  status only for `residence-1983`. What is unverified is *which cantons are
  in the group*, because Genève is a `source` canton and no published example
  reaches the list.

  So a guide states the distinction plainly and hedges only the enumeration.
  A reader in Genève gets the right answer either way; a reader in Jura gets
  a correct description of the consequence and an honest note that their
  canton's membership is pending.

## THE DROIT D'OPTION LAMAL/CMU — VERIFIED 16.09.2026

> **A SEPARATE SUBJECT AND A SEPARATE SOURCE.** These are not `RuleSet`
> constants and they have no row in the table above: nothing here concerns
> telework, the fiscal ceiling or the engine. They are recorded in this file
> because it is the product's register of regulatory facts, and an article
> may only cite what this file carries (R146).

**Source: CLEISS** — Centre des Liaisons Européennes et Internationales de
Sécurité Sociale, a French public body. An authority, not an advisory site.

https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html

> **THE URL IS CONFIRMED.** The operator fetched the page above on
> **16.09.2026** and read it in full; the rows below are transcribed from that
> fetch. The URL resolves, the content matches, and CLEISS is the publisher.
>
> It was provisional for one day. FW18b cited the body with certainty and the
> page provisionally, because the operator had reported the content of their
> pass without the address and a citation is itself a claim that inherits this
> file's standard. Recorded then as PARK-5, closed on the operator's
> confirmation.

| # | Fact | Content | Verified |
|---|---|---|---|
| D1 | *The window* | **Three months.** | ☑ CLEISS, 16.09.2026 |
| D2 | *What starts it* | The three months run from **any of four events**: taking up work in Switzerland; resuming work after a period of unemployment; taking up residence in France; moving from worker to pensioner status | ☑ CLEISS, 16.09.2026 |
| D3 | *Irrevocability* | The right may be exercised **once** and is **irrevocable** | ☑ CLEISS, 16.09.2026 |
| D4 | *What reopens it* | Only a change of situation: resuming work in Switzerland, transferring residence to France, or retiring on a Swiss pension alone | ☑ CLEISS, 16.09.2026 |
| D5 | *What does NOT reopen it* | Named explicitly by CLEISS: marriage, divorce, a birth or a death in the family, or changing jobs **without an unemployment gap** between them | ☑ CLEISS, 16.09.2026 |
| D6 | *The default* | Failing to opt within three months means **automatic affiliation in Switzerland** | ☑ CLEISS, 16.09.2026 |
| D7 | *Legal basis* | The ALCP, in force 1 June 2002; Regulation (CE) 883/2004 applicable between Switzerland and the EU since 1 April 2012; the modalities from the accord of 7 July 2016 | ☑ CLEISS, 16.09.2026 |
| D8 | *Family members* | A family member residing in France who has **no professional activity of their own** and **no pension or annuity from the Swiss scheme alone** does not exercise a separate option: their health cover follows the option the worker exercised. A spouse who works — in France *or* in Switzerland — falls outside this and has their own affiliation | ☑ CLEISS, 16.09.2026 |
| D9 | *Where the option is exercised* | By status. A **frontier worker** files with the competent **cantonal body of the canton of work**; a **holder of a Swiss pension alone** files with **Institution commune LAMal**, Industriestrasse 75, CH-4600 Olten, also online at `kvg.org`. Part 6 of the form is completed by the **CPAM of the French place of residence**, and the file reaches the Swiss competent authority **within the three months** | ☑ CLEISS, 16.09.2026 |
| D10 | *The instrument* | The form **« Choix du système d'assurance maladie »**, which CLEISS marks **« Formulaire en cours d'actualisation »**. Recorded by NAME per R167; the address it currently carries is a convenience with a fetch date and is allowed to rot | ☑ CLEISS, 16.09.2026 |

### FW20b: D8, D9 and D10 landed, and why fact 6 became two rows

The block below was FW18b's holding pen. FW20b turned it into the three rows
above, and the split is the decision worth recording.

**D8 is the whole of T1**, qualifier included, because the qualifier is the
fact. *"Votre famille suit votre choix"* without *"no professional activity of
their own and no Swiss-only pension"* is wrong for any household where both
partners work — and the failure direction is that a working spouse reads it,
does nothing, and ends up **uninsured**. That is why this was not optional.

**T2 became TWO rows, not one.** The operator's steer was "probably a row",
and the page in front of me says two, on R158's own test: *a source key
identifies a fact, not a URL*. Where the option is filed and which form files
it have **different rot profiles**. CLEISS can reissue the form under a new
reference without the cantonal bodies moving, and the Institution commune's
address can change without the form changing. One key covering both would
leave `claims` unable to tell *"a pensioner files at Olten"* from *"the
instrument is « Choix du système d'assurance maladie »"* — which is exactly
the state FW17 and FW18 left `missionCapDays` in.

The procedure detail — parts 1/2/4 or 1/3/4 by the applicant, part 5 the
choice, part 6 the CPAM, the whole within the three months — sits inside D9
rather than in a fourth row. It is routing, and routing is what D9 is about.

### TRANSCRIBED, NOT YET ROWS — two facts the FW18b pass carried and FW18b did not record

> **THESE BECAME D8, D9 AND D10 IN FW20b** and the block is kept as the
> operator's verbatim transcription from the fetch of 16.09.2026 — the
> accented original the rows are read from, which is where R168 points a
> relay prompt instead of carrying a French quotation through ASCII.
>
> It said until FW20b: "THESE ARE NOT D-ROWS AND MUST NOT BE CITED AS ONE …
> FW20 turns them into rows and decides the R158 split; until it does, no
> `claims` key exists for them and no article may cite them." FW20 did not;
> FW20b did, and the three keys are `droitOptionFamily`, `droitOptionFiling`
> and `droitOptionForm`.
>
> They are here because FW18b's audit found them missing: eight facts were
> verified from the fetch and seven rows were written. Nothing merged — one
> fact split into D1 and D2, and these two never landed.

**T1 — family members cannot opt separately.** CLEISS puts it as a question:

> « Les membres de ma famille qui n'exercent pas d'activité professionnelle
> ou ne perçoivent pas de pension ou rente du seul régime suisse pourront-ils
> exercer un droit d'option ? »

and answers **Non** — if they reside in France, their health cover is
determined by the option the worker exercised.

**THE QUALIFIER IS THE USEFUL PART, and it is load-bearing for the guide.**
The rule covers family members with **no professional activity of their own
and no Swiss-only pension**. A spouse who works — in France *or* in
Switzerland — is outside it and has their own affiliation. *"Your family
follows your choice"* without that qualifier is wrong for any household where
both partners work, which is most of them.

**T2 — where the option is filed, and the instrument.** Two destinations, by
status:

| status | where the option is exercised |
|---|---|
| frontier worker | the competent **cantonal body of the canton of work** (CLEISS links the list as a BAG PDF) |
| holder of a Swiss pension alone | **Institution commune LAMal**, Industriestrasse 75, CH-4600 Olten — also online at `kvg.org` |

The instrument is the form **« Choix du système d'assurance maladie »**, and
CLEISS marks it **« Formulaire en cours d'actualisation »** — which is part of
the fact, not a detail to omit.

The procedure on the same page: parts 1, 2 and 4 — or 1, 3 and 4 depending on
situation — are completed by the applicant; part 5 carries the choice; part 6
is completed by the **CPAM of the French place of residence**; the form then
goes to the Swiss competent authority **within the three months**.

> **RECORD THE FORM BY NAME, THE URL AS A CONVENIENCE.** The operator's
> caution, and it generalises: the form's own address carries `juin2019`
> (`cleiss.fr/pdf/suisse_droit_option_formulaire-juin2019.pdf`) and the page
> says it is being updated, so it is a link that will rot. The durable fact is
> the form's NAME. This is R153's shape one layer out — copy names the rule
> rather than quoting its value; a citation names the instrument rather than
> pinning its current file.

### Why D2 is the one that matters

**Every advisor writes "three months from hiring", and that is wrong** for a
frontalier who was already working in Switzerland and then moves to France.
Their window opens on the move, not on a hiring that may be years past. D2 is
the reason this subject was worth verifying rather than paraphrasing, and it
is the most valuable paragraph in the guide that cites it.

### What this unblocks, and what it does not

**Unblocked:** `/guides/droit-option-lamal-cmu`, refused in FW18 as P2
precisely because D1 and D3 had no source.

**Still blocked:** the comparator at `/calculateur-lamal-cmu` (P4). Its other
half is the LAMal premium data, whose licence could not be read — see Q54.
Note for whoever returns to it: **URSSAF publishes an official simulator for
the CMU contribution and CLEISS links it**, so the comparator never needed to
compute the French side. That changes R157's arithmetic and should be weighed
before any premium dataset is pursued.

## COPY ITEMS FOR THE REVIEWER

Wording the reviewer must confirm, kept separate from the readings above
because these are not open questions about the RULES. The arithmetic is
settled and sourced; what needs a second pair of eyes is what the product
SAYS about it. Ruling R125.

- [ ] **The fiscal-breach banner now reads differently per regime.** FW12,
  ruling R125.

  `FISCAL_CEILING_EXCEEDED` used to end with *"dans les cantons relevant de
  l'accord de 1983, le statut de frontalier lui-même est en jeu"* for every
  reader. Under the source regime that is **false**: a breach taxes the
  excess days in France and the status itself is not in question. Only the
  eight `residence1983Cantons` put the status at stake.

  **The engine had this right and the copy leaked it anyway.** `warnings.ts`
  emits `FRONTALIER_STATUS_AT_RISK` only for `residence-1983`, with the
  reason written beside the guard: *"Only under the 1983 accord is the status
  itself at risk. Telling a Geneva frontalier their status is at risk would
  simply be false."* The banner body put that same false statement back in
  prose — and for the eight cantons where it IS true, it repeated what the
  dedicated warning says one line below.

  So the body now branches on the regime the engine already carries. Two
  sentences, both naming where the excess days are taxed; only the 1983 one
  names the status. SPEC §7.2 step 1 is **confirmed, not reinterpreted** —
  *"the ceiling is the same under both regimes, the consequence is not"* is
  exactly this distinction, and the engine comment already cited it.

  *What the reviewer is asked:* whether the two French sentences state the
  consequence correctly for their regime. **Not** whether the distinction
  exists — Checkpoint A settled that, and `residence1983Cantons` is row 7 of
  the constants table.

  Asserted cross-layer in `tests/unit/pages/result-panel-warnings.test.tsx`:
  over all twenty-six cantons, the phrase *"statut de frontalier"* appears in
  the rendered panel exactly when the engine emitted the status warning. A
  phrase the engine restricts to one regime cannot appear in copy rendered
  for another.

## What is deliberately not here

- **The Geneva worked examples.** They arrive at FW4 as
  `fixtures/geneva-cases.json`, pinned to `taxYear: 2026`, and are frozen at
  Checkpoint A. SPEC §7.5: *"If any fails, nothing ships."*
- **Reviewer cases.** `reviewer-cases.ts`, signed off by the expert reviewer,
  including at least one `residence-1983` canton and one part-time mid-year
  start. Checkpoint E.
- **Any 2027 rule set.** Adding a year requires its own sourced and reviewed
  fixture file before it can become the default (SPEC §7.7).
