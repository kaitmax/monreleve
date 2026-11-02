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

### STILL PROVISIONAL — EXPERT LEGAL REVIEW PENDING (3 items, was 5)

> **UPDATE 2026-10-11 (REG-APPLY).** The accord amiable FR-CH of 29 April 2026
> (fetched and transcribed below) now **provides a primary source** for two of
> the three: it orders residence-state missions before third-state ones (1b,
> P1) and it prorates the 10-day cap for part-time and partial-year employees
> with no condition on the denominator method (1d, P3). These are no longer
> *readings adopted where no source speaks*; they are **transcriptions from the
> accord awaiting the same expert legal review** as every transcribed row. What
> remains genuinely a reading is named under each item below.

- ☐ **P1 — the France-before-third-state imputation ORDER. NOW SOURCED
  (accord 1b).** ge.ch treats *"France ou un autre État"* as a single pool in
  all six published cases and never orders them, but the accord amiable of
  29 April 2026, 1(b), does: *"Parmi les missions temporaires, celles exercées
  dans l'État de résidence du salarié sont prises en compte en priorité par
  rapport à celles exercées dans un État tiers."* For a France-resident
  frontalier the État de résidence is France, so this is France-before-a-third-
  state, which is exactly what the waterfall does. **Harmless in the
  fixtures** — no published case splits the two — and now sourced for the user
  who does. Expert confirmation of the application is pending.

- ☐ **P2 — the 49,9 versus < 50 edge under two-decimal truncation.**
  OFAS/BSV confirms the published maximum: *"jusqu'à 50% (au maximum 49.9%)"*
  (source B below). The 49,9 ceiling is therefore sourced; what stays a
  **reading** is the product's choice to **over-warn** in the narrow band
  between 49,9 and 50. 49,95 % is legally below 50 and above the published
  49,9, and the band stays `> 49,9` because over-warning is the safe direction
  for a signal that drives copy and no arithmetic — and truncation really can
  produce 49,99. *Confirm that over-warning is acceptable.* (Was ruling R32.)

- ☐ **P3 — mission-cap proration under the exact method (was ruling R19).
  SETTLED by accord 1(d); the engine was corrected.** ge.ch prorates for
  part-time **and** partial year but did not address an employer-supplied exact
  total, and the interim R19 reading prorated by `periodFraction` only under
  `exact`. The accord 1(d) prorates the 10-day **limit** itself
  *"proportionnellement et arrondie à l'unité supérieure"* for a part-time or
  partial-year employee, **with no condition on the denominator method** — so
  the exact method must prorate by `employmentRate` too. The engine was
  corrected on the operator's ruling of 2026-10-11 ("fix the engine then apply
  the copy"): `missionCapFor` now prorates by both factors under both methods,
  and `mission-cap.test.ts` and `fixtures/denominator-cases.json` were updated
  (`cap-exact-50-full` 10→5, `cap-exact-50-half-year` 5→3). The Geneva
  conformance fixtures were unchanged (all are 100 % full-year). What remains
  Mon Releve's own **reading** is the **COMBINED** case — part-time AND
  partial-year at once — because 1(d) names the two situations separately and
  does not authorise multiplying both factors explicitly.
  `EXACT_METHOD_UNVERIFIED` still fires on the exact path.

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

## ACCORD AMIABLE FR-CH OF 29 APRIL 2026, AND FOUR MORE SOURCES — VERIFIED 2026-10-11 (REG-APPLY)

> **RE-FETCHED AND READ THIS SESSION.** Each source below was fetched again on
> 2026-10-11 and read directly: the accord and the Geneva LAMal table as PDFs
> (extracted with `pdftotext` and read page by page), the other three as HTML.
> None relied on the REG-UPDATE report alone (R146). The accented originals live
> at the URLs named; the quotations here are the primary text.

### Source A — Accord amiable FR-CH, 29 April 2026. VERIFIED.

- **Instrument (R167):** *« Accord amiable conclu entre les autorités
  compétentes de la Suisse et de la France sur les modalités du régime
  applicable à l'exercice du télétravail dans le cadre de la Convention du
  9 septembre 1966 … »*
- **URL (convenience, allowed to rot):**
  https://www.estv.admin.ch/dam/fr/sd-web/Bibcb06jL1wG/int-laender-fr-dba-ai-cdi-20260429-fr.pdf
- **Fetched:** 2026-10-11. Signed *« À Berne, le 29 avril 2026 »*, Pascal Duss
  (autorité compétente suisse) and Martin Klam (autorité compétente française).

Clause 1 chapeau: *« Pour l'application de la limite de 10 jours par année de
missions temporaires exercées par le salarié pour le compte de son employeur
dans son État de résidence ou dans un État tiers, les règles d'interprétation
suivantes sont applicables : »*

- **1(a):** *« il est entendu que seules sont incluses dans l'expression
  « activités exercées en télétravail depuis l'État de résidence » les missions
  temporaires exercées par le salarié, dans son État de résidence ou dans un
  État tiers, pour le compte de son employeur, à hauteur de la fraction
  respectant, à la fois, la limite annuelle de 10 jours, et celle de 40 % du
  temps de travail par année civile, après imputation des autres jours de
  télétravail, c'est-à-dire des jours de télétravail qui ne sont pas des
  missions temporaires ; »*
- **1(b)** *(sources P1 — the imputation order):* *« il est entendu qu'aux fins
  de l'application du a), les autres jours de télétravail sont décomptés en
  priorité par rapport aux jours de missions temporaires. Parmi les missions
  temporaires, celles exercées dans l'État de résidence du salarié sont prises
  en compte en priorité par rapport à celles exercées dans un État tiers ; »*
- **1(c):** *« il est entendu que la fraction des jours de missions temporaires
  excédant au moins l'une des limites stipulées au a) n'est pas incluse dans
  l'expression « activités exercées en télétravail depuis l'État de
  résidence » ; »*
- **1(d)** *(sources the mission-cap proration — the engine was corrected to
  match it, 2026-10-11):* *« pour les salariés qui exercent leur activité
  pendant une période inférieure à l'année civile et ceux qui exercent un emploi
  à temps partiel pendant l'année entière, la limite annuelle de 10 jours est
  ajustée proportionnellement et arrondie à l'unité supérieure. »*
- **2** *(sources the on-call PARK item):* *« Il est entendu que les périodes
  d'astreinte ne sont pas constitutives de missions temporaires … Elles ne sont
  incluses dans l'expression « activités exercées en télétravail depuis l'État
  de résidence » que si elles donnent lieu à une intervention effective du
  salarié dans son État de résidence. »*
- **3** *(effect date):* *« Le présent accord entre en vigueur le jour suivant
  sa signature par les deux autorités compétentes. Ses dispositions prennent
  effet à la même date que celle de l'avenant à la Convention, signé le 27 juin
  2023. »* (The printed PDF has a typo, *« avennt »*, for *« avenant »*.)
- **4** *(dénonciation):* a minimum six-month notice before the end of a
  calendar year; the accord then ceases to apply after that year.

This accord is the **named instrument** behind rows 2 and 3 of the constants
table (the 10-day cap and its proration) and behind P1 and P3. It is the
primary source the earlier note (row 2) was reaching for when it recorded that
a "29 April 2026 interpretative agreement" could not be found as a *separate*
document: the accord itself, dated 29 April 2026, is that instrument.

### Source B — OFAS / BSV, Télétravail. VERIFIED.

- **URL:** https://www.bsv.admin.ch/fr/teletravail — **published 12 September
  2025.** Fetched 2026-10-11.
- The percentage limit: *« jusqu'à 50% de télétravail transfrontalier (au
  maximum 49.9% du temps de travail) »* — confirms `socialCeiling` 0.499 and
  **P2's published maximum**.
- The band the multilateral agreement covers: *« … compris entre 25% et 49.9%
  du temps de travail »* — confirms `a1ThresholdRate` 0.25.
- Who it does NOT apply to: persons also doing a non-telework activity in their
  residence state (*« visites régulières à des clients, activité accessoire
  indépendante »*), persons with another EU/EFTA employer or activity outside
  the residence state, and the self-employed.
- The A1: requested by the Swiss employer *« au moyen de la plateforme ALPS
  (Applicable Legislation Portal Switzerland) »*, *« validité maximale de 3 ans,
  renouvelable »*.

### Source C — AFC Genève, obligations de l'employeur en matière de télétravail. VERIFIED.

- **URL:** https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/obligations-employeur-matiere-teletravail
  — **page update date 23 April 2026.** Fetched 2026-10-11.
- Tracking since 01.01.2026: *« L'employeur doit suivre les jours de télétravail
  et de missions temporaires effectués par chacun de ses employés domiciliés en
  France. »*
- First transmission: *« La première transmission interviendra en janvier 2027
  pour les données de 2026. »*
- The rate is **NOT** required on the salary certificate: *« Non, ce n'est pas
  obligatoire. Ce taux doit figurer sur la liste récapitulative (LR) d'impôt à
  la source (version papier) ou être transmis via ELM ou ISeL. »*
- Several employers: *« Vous devez déclarer à l'AFC Genève le taux de
  télétravail correspondant aux jours travaillés pour votre entreprise
  uniquement. »*
- Change of residence during the year: *« Vous devez établir deux
  attestations-quittances au titre de l'année : une concernant chaque période de
  résidence. »*
- Leaving during the year: *« L'attestation "en cas de rapports de travail de
  moins d'un an" (art. 5a OIS) doit être remise à l'employé s'il en fait la
  demande. »*

These are the sentences the **employer-document** section of `/sources` is to
track one by one: the rate belongs on the LR / ELM / ISeL rather than the
certificat de salaire, and the "moins d'un an" attestation is handed over *on
request*, not automatically. They also support a future **employer field** (one
relevé per employer) and the **residence-change** PARK item.

### Source D — Geneva LAMal premiums 2026 for residents of France. RECORDED (existence only).

- **URL:** https://www.ge.ch/document/40783/telecharger — fetched 2026-10-11
  (PDF, `pdftotext`). Title *« Cotisations mensuelles assurance de base 2026 »*
  / *« Personnes domiciliées en France »*. PDF metadata: created 26.09.2025,
  publisher République et canton de Genève.
- **Franchise annuelle:** *« Adultes : CHF 300.- / Enfants : CHF 0.- »*. Year
  covered: 2026. Columns *« AVEC COUVERTURE ACCIDENT »* / *« SANS COUVERTURE
  ACCIDENT »*, ages 26+, 19-25, 0-18, by caisse (N° OFSP).
- **Reuse terms: NONE stated on the document.** Per R146, the premiums are
  **NOT republished**; only the document's existence, date, deductible and year
  are recorded. This is a PARK input (the LAMal/URSSAF comparator), gated on the
  reuse terms being read from ge.ch.

### ameli — droit d'option (corroborates CLEISS). VERIFIED.

- **URL:** https://www.ameli.fr/assure/droits-demarches/europe-international/travailleur-frontalier-suisse
  — *« Travailleur frontalier suisse : droits et prise en charge »*. Fetched
  2026-10-11.
- *« Vous pouvez exercer votre droit d'option … dans un délai de 3 mois à
  compter de votre prise d'emploi en Suisse ou de votre domiciliation en
  France. »* — corroborates D1.
- *« L'option, une fois exercée, a un caractère irrévocable. »* — corroborates
  D3.
- *« Passé ce délai, vous êtes obligatoirement affilié auprès de l'assurance
  maladie suisse. »* — corroborates D6.
- CLEISS stays the authoritative publisher (R167); ameli is a second
  French-public source that corroborates rows D1, D3 and D6.

### NOT rowed (could not be primary-verified this session)

- **URSSAF** (frontalier CMU contribution, 8 % on revenus N-2 less 25 % of the
  PASS): secondary sources only; no row (R146). A PARK input for the comparator.
- **Form 2047-SUISSE:** located
  (impots.gouv.fr, millésime 2026) but the multi-page PDF body was not
  transcribed; recorded as located-not-transcribed.
- **A separate ESTV "practical guide" of 29 April 2026:** not located as a
  distinct document. The accord A itself is the primary ESTV instrument and is
  verified above.

## THE LAMAL / CMU COMPARATOR — SOURCES READ 27.10.2026, CHECKED 28.10.2026 (FW-COMPARATEUR)

> **WHERE THE WORDS COME FROM.** The operator collected every source below
> with Claude in Chrome on **27 October 2026** and committed the collection
> report and the data files to `docs/sources/primes-lamal/` (commit 49f8164).
> The quotations in this section are copied FROM that report,
> `docs/sources/primes-lamal/sources-2026-10.md` (section numbers in
> brackets), which is the accented original and is not edited: its SHA-256 is
> recorded in `CHECKSUMS.txt`. Nothing here was re-fetched except where a row
> says so.
>
> **WHAT FW-COMPARATEUR CHECKED, ON 28.10.2026.** Every claim the report
> makes about the FILES was re-derived from the files themselves, and the
> report's claims about PAGES were checked for internal consistency only —
> a page cannot be re-read from a file. Each check is listed under its row.
> Nothing the files say contradicts the report.
>
> **L15-L17 ARE FW-CALCS-A2's (02.11.2026)**, and their quotations come from
> the second collection, `docs/sources/primes-lamal/sources-2026-11.md`
> (sections S1-S3), not from the October report - each section says so.
>
> **THIS CLEARS PARK-4 AND PARK-24** under the operator's ruling recorded in
> CLAUDE.md as R664–R673 (the addendum's G1–G10): *premium data licensed and
> dated; French contribution primary-verified.*

| # | Fact | Content | Source | Read |
|---|---|---|---|---|
| L1 | *The Swiss premium data* | Premiums of the compulsory Swiss health insurance for insured persons **residing in France**, by insurer (N° OFSP), age class and accident cover, for premium years **2026** and **2027** | OFSP / BAG, dataset *« Primes de l'assurance-maladie »* on opendata.swiss, files `Prämien_EU` | ☑ 27.10.2026 |
| L2 | *The reuse terms* | `Prämien_EU.csv/.xlsx` carry the terms *« Utilisation libre. Obligation d'indiquer la source. »*: commercial use allowed; **the source (author, title, link to the dataset) is mandatory** | opendata.swiss terms of use; per-resource `license` field | ☑ 27.10.2026 |
| L3 | *A monthly premium* | The premium is the amount paid **each month** to the insurer. Annual cost = 12 × the figure in the file | priminfo.admin.ch; cross-checked against ge.ch's *« Cotisations mensuelles »* | ☑ 27.10.2026, cross-check 28.10.2026 |
| L4 | *By State, not by canton* | For insured persons residing in an EU State, the premium is calculated **by State of residence** | LAMal art. 61 al. 4 | ☑ 27.10.2026 |
| L5 | *Age classes* | Young adults are **19 to 25 on 31 December** of the year; adults are the others aged **over 25**; the class follows the **year of birth**. The child bound (**18 and under**) is DERIVED, not quoted | LAMal art. 16a al. 1 and 4; OAMal art. 91 al. 3 | ☑ 27.10.2026 |
| L6 | *Accident cover* | Suspended on request for a person fully covered under the LAA; a part-time worker employed **at least eight hours a week** by one employer is covered for non-occupational accidents | LAMal art. 8 al. 1; OLAA art. 13 al. 1 | ☑ 27.10.2026 |
| L7 | *The French contribution* | `8 % × (A − 0,25 × PASS)` for a calendar year | CSS art. D380-2 I | ☑ 27.10.2026 |
| L8 | *The income it is levied on* | A = the income defined at art. 1417 IV CGI, for the **last calendar year for which it is known** (in practice the year before last) | CSS art. L380-3-1 IV; CGI art. 1417 IV; URSSAF | ☑ 27.10.2026 |
| L9 | *Prorata* | A period shorter than a year is prorated by days: × days ÷ 365. **Computed since FW-CALCS-A2** (R744) for an affiliation from a date, days from the start to 31 December both counted | CSS art. D380-2 II; URSSAF | ☑ 27.10.2026 |
| L10 | *Rounding* | The base and the contribution are rounded **to the nearest euro** | URSSAF | ☑ 27.10.2026 |
| L11 | *Who it covers* | One declaration per frontalier; the frontalier's **ayants droit** (conjoint, concubin, pacsé, enfant) can be attached at no separate contribution | URSSAF; CLEISS (row D8) | ☑ 27.10.2026 |
| L12 | *PASS 2026* | **48 060 €** | URSSAF | ☑ 27.10.2026 |
| L13 | *PASS 2027* | **48 900 €, ANNOUNCED** — *« Un arrêté sera publié d'ici la fin de l'année. »* | URSSAF | ☑ 27.10.2026 (announcement) |
| L14 | *The exchange rate* | ECB euro reference rate, **27 October 2026: 1 EUR = 0,9239 CHF**, published for information purposes | ECB | ☑ 27.10.2026 |
| L15 | *Swiss cost-sharing caps* | Franchise **300 CHF** a calendar year (none for a child); quote-part **10 %** of the costs above it, capped at **700 CHF** a year for an adult and **350 CHF** for a child; several children with the same insurer pay together at most an adult's franchise and quote-part; applies to insured persons residing in the EU and insured in Switzerland. The hospital contribution (al. 5) comes on top and has no annual cap | LAMal art. 64 al. 2, 4, 5; OAMal art. 103 al. 1, 2, 7; priminfo; OFSP | ☑ 02.11.2026 |
| L16 | *A partial first month* | General rule: the basic premium is divisible and computed in days - **for a birth, a move to or from Switzerland, a death only**. **NOT ESTABLISHED for a frontalier**: no text found names that case. The comparator counts whole months from the month after the start (R744's fallback) and says so | priminfo FAQ; OFSP FAQ and PDF; LAMal art. 5; OAMal art. 7 al. 4, 90, 92a | ☐ NOT ESTABLISHED, 02.11.2026 |
| L17 | *How the three months are counted* | **NOT FOUND**: every source gives the period (three months) and the events that open it, none says from which day to which day. The helper shows an indicative end date with *environ* and a warning | ameli; CLEISS; URSSAF; OFSP; ALCP annexe II; OAMal art. 7 al. 4 | ☐ NOT FOUND, 02.11.2026 (Légifrance blocked) |

### L1 — the Swiss premium data. VERIFIED from the files.

- **Dataset (R167, the instrument):** *« Primes de l'assurance-maladie »*,
  Office fédéral de la santé publique OFSP. Editeur *« Bundesamt für
  Gesundheit, Sektion Prämien und finanzielle Risiken »*. Landing page
  https://www.priminfo.admin.ch/de/praemien.
- **URL (convenience):** https://opendata.swiss/fr/dataset/health-insurance-premiums
  — the page showed *« Dernière mise à jour 29 septembre 2026 »*, *« Date de
  publication 26 septembre 2013 »*, *« Couverture temporelle 1 janvier 2027
  - 31 décembre 2027 »* [§1].
- **Files** (committed under `docs/sources/primes-lamal/`, SHA-256 in
  `CHECKSUMS.txt`, re-hashed 28.10.2026 and identical):
  `2027_Praemien_EU.csv` (premium year 2027, survey year 2026) and
  `2026_Praemien_EU.csv` (extracted from `Archiv_Praemien_2026.zip`,
  archive entry dated 2025-09-23; premium year 2026, survey year 2025).

**Checked against the files on 28.10.2026** (each claim of report §2 and §3):

| Claim | 2027 file | 2026 file |
|---|---|---|
| Header row as quoted (17 columns, `Versicherer` … `Tarifbezeichnung`) | ☑ identical | ☑ identical |
| France is coded | ☑ `FR` | ☑ `EU FR` |
| `Hoheitsgebiet` / `Region` for France | ☑ `P_OKPEU` / `PR_REG_0` | ☑ `EU` / `PR-REG EU0` |
| Rows for France | ☑ 80 | ☑ 80 |
| Insurers for France | ☑ 13: 8, 32, 290, 376, 455, 509, 1384, 1479, 1509, 1542, 1555, 1560, 1562 | ☑ the same 13 |
| Insurers in the whole file / countries | ☑ 14 / 30 | ☑ 14 / 30 |
| Tariff, franchise level, franchise | ☑ `BASE` only; `FRASTU_01`; `FRA_01_E_0300`, `FRA_01_J_0300`, `FRA_01_K_0000` | ☑ `BASE`; `FRAST1`; `FRA-300` (adults, young adults), `FRA-0` (children) |
| Age subgroups | ☑ `E1`, `J1`, `K1`, `K3` | ☑ empty, `K1`, `K3` |
| The three example rows quoted in §2 | ☑ each present exactly once | ☑ present exactly once |
| Line count of `Prämien_EU.csv` [§2] | ☑ 2 231 | — |

The report's claims about `2027_Prämien_CH.csv`, which is not committed,
were checked read-only against the operator's downloaded copy: SHA-256 equal
to `CHECKSUMS.txt`, 219 917 lines, 28 canton codes including ZE and ZR,
`PR_REG_0`–`3`, 32 insurers, 88 tariffs, subgroups E1 J1 K1 K3 K4 K5 — all as
the report states. The comparator does not use that file. The 2027 change
notice (`2027_to_whom_it_may_concern.pdf`) was read with `pdftotext`: its
French part carries *« Dans le cadre de la publication des primes 2027, la
structure des fichiers de primes est adaptée »* and the row *« Territoire
national | Nouvelles valeurs P_OKPCH et P_OKPEU »*, as quoted [§2].

**Every insurer offers all six France rows** (three age classes × with and
without accident cover) under subgroups `K1`, `J1`, `E1`. **Insurer 32
alone** also files two child rows under `K3`. The data files define no
subgroup (`Erläuterungen`: *« Sous-groupe d'âge ("K1", "K2", "K3", "K4",
"K5", "J1", "E1") »*, nothing more), so **the comparator uses `K1` for every
child** and does not guess what `K3` means. Parked (PARK-29).

### L2 — the reuse terms. Quoted from the report; not re-read.

Report §1, from the dataset page (icon alt/title text):

> Utilisation libre. Obligation d’indiquer la source.

From the full terms page https://opendata.swiss/fr/terms-of-use (no page
date), the definition of that symbol:

> **Utilisation libre. Obligation d’indiquer la source.**
> Vous pouvez utiliser ce jeu de données à des fins non commerciales.
> Vous pouvez utiliser ce jeu de données à des fins commerciales.
> L’indication de la source (auteur, titre et lien vers le jeu de données) est obligatoire.

Per resource, from the portal's metadata API (`package_show`, field
`license`): **`terms_by` for `Prämien_EU.csv` and `Prämien_EU.xlsx`** (and
the `Erläuterungen` and change-notice files); `terms_open` for
`Prämien_CH.*`, `Prämien_CHEU.xlsx` and every `Archiv_Praemien_20xx.zip`.
**This row rests on the report's quotation of the API, dated 27.10.2026; it
could not be re-read from a file.** The 2026 premiums were extracted from an
archive marked `terms_open`, whose condition is weaker than `terms_by` — the
page applies the stricter attribution to both years.

**THE ATTRIBUTION THE PAGE CARRIES** (ruling R664): author *Office fédéral de
la santé publique OFSP*, title *« Primes de l'assurance-maladie »*, link to
the dataset page above — under the Swiss figures on `/calculateur-lamal-cmu`
and on `/sources`, rendered from the dataset module's header rather than typed.

### L3 — a monthly premium. Quoted, then CONFIRMED from the data.

priminfo.admin.ch (no page date; read 27.10.2026) [§9]:

> La prime est le montant que vous devez payer chaque mois à votre caisse-maladie.

(https://www.priminfo.admin.ch/fr/praemien; the user guide
https://www.priminfo.admin.ch/fr/anleitung says the same: *« La prime
d’assurance, c’est le montant que vous devez payer chaque mois à votre
caisse-maladie. »*) The data files say only *« Prime en CHF »*, with no
period [§2, §15].

**The sanity check the ruling asked for (R665), and it is stronger than "of
the same order".** Source D, ge.ch's document *« Cotisations mensuelles
assurance de base 2026 — Personnes domiciliées en France »*
(https://www.ge.ch/document/40783/telecharger), was fetched again on
**28.10.2026** (1-page PDF, SHA-256
`52ce06bb1edce76e6b0ee1fc7c5a2e1304c1b99a618fb3e3240546af7655cb21`, footer
date 26.09.2025) and read with `pdftotext`. It lists 13 insurers by N° OFSP —
the same 13 — under six columns (26+, 19-25, 0-18, with and without accident
cover). **All 78 of its figures equal the OFSP 2026 file's `EU FR` rows**
(children: subgroup `K1`). A planted change of one figure in a copy of the
CSV (insurer 8, adult, with accident, 750 → 751) produced exactly one
mismatch, so the comparison can fail. A cantonal document titled *monthly*
carrying the federal file's values one for one settles the period. For scale,
the 2027 adult premiums of Geneva RESIDENTS (canton GE, base tariff, CHF 300,
with accident) run from 711,20 to 915,70 CHF in the CH file; France
residents' run from 225 to 885.

ge.ch's figures are still **not republished** (R146: the document states no
reuse terms). The page shows the OFSP figures; ge.ch is cited only as the
cross-check that established their period.

### L4 — by State of residence. LAMal art. 61 al. 4.

https://www.fedlex.admin.ch/eli/cc/1995/1328_1328_1328/fr — *« du 18 mars
1994 (État le 1er juillet 2026) »*, *« Ce texte est en vigueur »* [§10]:

> 4 Pour les assurés résidant dans un État membre de l’Union européenne, en Islande, en Norvège ou au Royaume-Uni, les primes sont calculées en fonction de l’État de résidence. Le Conseil fédéral édicte les dispositions sur la fixation et l’encaissement des primes de ces assurés.

The data agrees: France has one premium region (`PR_REG_0`, *« pas de
subdivision par des régions »*). **The canton is therefore not an input**,
and SPEC 9.6 is amended to say so.

### L5 — age classes. LAMal art. 16a; OAMal art. 91 al. 3.

LAMal (same page, État le 1er juillet 2026) [§10]:

> 1 Les assureurs bénéficient d’un allégement de la compensation des risques pour les assurés âgés de 19 à 25 ans le 31 décembre de l’année concernée (jeunes adultes).
> 4 Sont réputés adultes les jeunes adultes et les assurés qui ont plus de 26 ans le 31 décembre de l’année concernée.

OAMal, https://www.fedlex.admin.ch/eli/cc/1995/3867_3867_3867/fr — *« (État
le 22 octobre 2026) »*:

> 3 L’échelonnement des primes selon le groupe d’âge pour les assurés visés à l’art. 61, al. 3, LAMal s’effectue d’après l’année de naissance.

**WHAT IS QUOTED AND WHAT IS DERIVED.** Quoted: 19 to 25 on 31 December of
the year is a young adult; the class follows the year of birth. **Derived,
not quoted:** a child is 18 or younger on 31 December, and an adult (in the
premium file's sense, class `ERW`) is 26 or older. Al. 4 literally says
*« plus de 26 ans »*, which read alone leaves an insured person aged exactly
26 in no class; the bound used is the one al. 1's upper limit implies (25 is
the last young-adult year). Art. 61 al. 3 names children and young adults
without ages [§10], and no text searched states *« 0 à 18 »* [§10, §15].
ge.ch's document heads its columns *« 26+ »*, *« 19-25 »* and *« 0-18 »*,
which agrees, and is a cantonal document rather than the law. The page
therefore asks for each person's **year of birth** and derives the class:
age = premium year − year of birth.

### L6 — accident cover. LAMal art. 8 al. 1; OLAA art. 13 al. 1.

LAMal [§11]:

> 1 La couverture des accidents peut être suspendue tant que l’assuré est entièrement couvert pour ce risque, à titre obligatoire, en vertu de la loi fédérale du 20 mars 1981 sur l’assurance-accidents (LAA). L’assureur procède à la suspension lorsque l’assuré lui en fait la demande et apporte la preuve qu’il est entièrement assuré conformément à la LAA. Il réduit la prime en conséquence.

OLAA, https://www.fedlex.admin.ch/eli/cc/1983/38_38_38/fr — *« (État le
1er janvier 2026) »* [§11]:

> 1 Les travailleurs à temps partiel occupés chez un employeur au moins huit heures par semaine sont également assurés contre les accidents non professionnels.

So the default (ruling R667): **the frontalier** — employed at least eight
hours a week by one employer — is computed **without** accident cover;
**every other person** in the household is computed **with** it, because
nothing says they are covered under the LAA. Each can be switched.

### L7 — the contribution formula. CSS art. D380-2 I.

https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038405782 —
*« EN VIGUEUR DEPUIS LE 01 JANVIER 2019 »*, modified by décret n° 2019-349
du 23 avril 2019 [§16b]:

> I.-La cotisation due par les personnes mentionnées à l'article L. 380-3-1 au titre d'une année civile est calculée selon la formule suivante :
>
> Montant de la cotisation = 8 % × (A-0,25 × PASS)
>
> Où :
>
> A correspond à l'assiette des revenus définis au deuxième alinéa du IV de l'article L. 380-3-1 perçus au cours de la dernière année civile pour laquelle ces revenus sont connus.
>
> PASS correspond au plafond annuel de la sécurité sociale.

URSSAF page 6a (*« Mis à jour le 24 septembre 2026 »*) states the same rate
for 2026 — *« En 2026, le taux de cotisation d’assurance maladie est de
8 % »* — and gives no separate rate for 2027 [§6b]. The article is in force
without an end date, so **8 % applies to 2027 until the article changes**.

**NO FLOOR IS WRITTEN ANYWHERE** [§6d, §8]. Below 25 % of the PASS the
formula is negative. The comparator shows **0 €** there and says it is the
site's reading, not a rule; the question is the expert reviewer's
(Checkpoint E). Parked (PARK-28).

### L8 — the income base. CSS art. L380-3-1 IV; CGI art. 1417 IV.

L380-3-1, https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036390105
— *« EN VIGUEUR DEPUIS LE 01 JANVIER 2018 »* [§16a], IV al. 2:

> Ils sont redevables d'une cotisation fixée en pourcentage du montant de leurs revenus définis selon les modalités fixées au IV de l'article 1417 du code général des impôts. Un décret détermine le taux et les modalités de calcul de cette cotisation ainsi que les obligations déclaratives incombant aux assujettis.

Art. 1417 IV CGI, https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373249
— *« EN VIGUEUR DEPUIS LE 01 JUILLET 2026 »* [§16d] — is the definition of
the *revenu fiscal de référence*: net income retained for income tax,
increased by the items a) to e), among them (point c) income *« exonérés par
application d'une convention internationale relative aux doubles
impositions »*. So a frontalier's Swiss salary, exempt in France under the
treaty where it applies, is **inside** A.

URSSAF's practice [§6a, §6b]: *« Elle est basée sur vos revenus perçus au
cours de l’avant dernière année »*; the declaration collects *« les salaires,
pensions et rentes nets »* and *« les autres revenus »*, and *« Le revenu
fiscal de référence n’est pas pris en compte dans le calcul de votre
cotisation, il sert uniquement de base de vérification. »* ameli [§7b]: the
contribution is computed *« sur la base du revenu fiscal de référence
figurant sur avis d'imposition après déduction d'un abattement forfaitaire
annuel »*.

**What the page asks for** (ruling R670): *votre revenu fiscal de référence
de l'avant-dernière année*, pointing to the avis d'imposition. **Two
questions go to the expert reviewer and are not answered on the page**
(PARK-30): whether URSSAF's two rubrics add up exactly to the 1417 IV amount;
and how a JOINT tax return maps onto A — URSSAF 6b: *« Si vous avez une
déclaration d’impôt commune : indiquez le montant des revenus vous concernant
personnellement. Si vous avez perçus des revenus en commun au sein du foyer
fiscal, veuillez en mentionner la moitié. »* The RFR printed on a joint avis
is the household's, so a couple entering it overstates A. The page says so in
its list of what it does not compare.

**SINCE FW-CALCS-A2 (R743) THE FORM ASKS IT**, and the item left the list:
*Votre déclaration d'impôt : Individuelle / Commune*. *Commune* asks *Vos
revenus personnels de l'avant-dernière année* and *Les revenus perçus en commun
dans le foyer*, and A = personal + half of common, shown under the fields as
*« L'Urssaf retient vos revenus personnels et la moitié des revenus perçus en
commun. Ici : … €. »* - the 6b sentence above, which is this row's source. An
empty common field counts 0; the half of an odd amount is rounded down (L10).
PARK-30's first question - whether URSSAF's rubrics add up to the 1417 IV
amount - is unchanged.

### L9 — prorata. CSS art. D380-2 II.

> II.-[…] Lorsque la période entre ces deux dates est inférieure à une année, le montant de la cotisation est calculé au prorata de la durée de cette période.

(URSSAF 6a gives the same as *« × nombre de jours ÷ 365 »*.) **Not computed**
(ruling R669): the comparator compares a full year, and says so.

**COMPUTED SINCE FW-CALCS-A2 (R744, the operator's addendum 2).** The form
asks *Votre affiliation en <année> : Toute l'année / À partir d'une date*. From
a date, the contribution follows URSSAF 6a's formula and order [§6c of
`sources-2026-10.md`, read 27.10.2026]:

> Si vous êtes affilié en cours d'année, la formule suivante est utilisée : Cotisation = (assiette retenue - abattement de 25 % du plafond de la Sécurité sociale) × 8 % × nombre de jours ÷ 365.
> Le montant de la base de calcul et la cotisation sont arrondis à l’euro le plus proche.

Applied as `round(base × 8 % × days ÷ 365)`, the base already rounded (L10),
one rounding at the end; days from the start date to 31 December **both
counted** - 1 March 2027 = 306 days, pinned by
`tests/unit/lamal/scenario.test.ts`. The French card states the line
(*« Au prorata : × N jours ÷ 365, comme le prévoit l'article D380-2 pour une
affiliation en cours d'année. »*, `LAMAL_COPY.result.french.prorata`). The 365
is URSSAF's divisor (`PRORATA_YEAR_DAYS`); a start on 1 January of a leap
year would count 366 days over 365, which no year the comparator holds
reaches today (2026, 2027) - a question for the 2028 refresh.
Whole-year comparisons are unchanged: they take compare()'s own figure.

### L10 — rounding. URSSAF 6a.

> Le montant de la base de calcul et la cotisation sont arrondis à l’euro le plus proche.

Applied as: base = round(A − 0,25 × PASS) to the euro; contribution =
round(8 % × base) to the euro. With A in whole euros and the PASS a multiple
of four, the base is always whole; and 8 % of a whole number of euros is
never exactly half a euro (2 × base / 25 cannot end in ,50), so the rounding
never meets a tie and *« le plus proche »* needs no tie rule.

**FW-CALCS-A2 (R743) brought the tie back, once.** A joint return's A is
personal income + half of the income received in common (L8, URSSAF 6b);
with both in whole euros, an odd common amount makes A end in ,50 and the
base meet exactly the tie *« le plus proche »* does not settle. The site
rounds that half **down** - the reader's side, never their disfavour
(`jointIncomeEur`). It is the site's reading, listed for the expert
reviewer with PARK-30. The prorata (L9) never meets a tie: 8 × days ×
base ÷ 36 500 would need 36 500 × an odd number to be divisible by 16.

### L11 — who the contribution covers. URSSAF 6a, 6d; CLEISS.

6a: *« Cette déclaration est individuelle. Si votre conjoint(e) est
également travailleur frontalier en Suisse et assuré(e) à l’assurance
maladie française, vous devez faire les deux déclarations distinctes. »*
6d (*« Publié le 19 avril 2024 »*): *« Vous pouvez demander le rattachement
de vos proches (conjoint, concubin, pacsé, enfant) comme bénéficiaires, ce
qui leur permettra de bénéficier des prestations de l’assurance maladie
française. »* With row D8 (CLEISS): family members without activity of their
own follow the worker's option. **One contribution on the French side; one
premium per person on the Swiss side.**

### L12, L13 — the PASS. URSSAF.

2026, https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds-securite-sociale.html
— *« Mis à jour le 01 janvier 2026 »*: *« Année | 48 060 € »*; reference
text *« Arrêté du 22 décembre 2025 portant fixation du plafond de la Sécurité
sociale pour 2026 »* (not opened on Légifrance) [§12].

2027, https://www.urssaf.fr/accueil/actualites/plafond-annuel-securite-sociale.html
— *« Mis à jour le 20 octobre 2026 »*:

> À compter du 1er janvier 2027 le plafond annuel de la Sécurité sociale sera fixé à 48 900 €.
> […]
> Un arrêté sera publié d’ici la fin de l’année.

**The 2027 figure is published as ANNOUNCED** (ruling R671) and switches to
final when the arrêté is published — `docs/lamal-refresh.md` says how.

### L14 — the exchange rate. ECB.

https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
— rate of **27 October 2026**: *« CHF Swiss franc 0.9239 »*, and *« The
reference rates are published for information purposes only. Using the
rates for transaction purposes is strongly discouraged. »* [§13]

Terms, https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html:
*« When such information is distributed or reproduced, it must appear
accurately and the ECB must be cited as the source. »* and *« If the
information is modified by the user […] this must be stated explicitly. »*
The site stores the rate unmodified with its date (ruling R672) and shows
both beside every converted figure, with the CHF amounts kept visible.

**THE FRANC SLIDER (FW-CALCS-A2, R747).** *« Et si le franc varie ? »* moves a
HYPOTHESIS from -10 % to +10 % around this rate: reference ÷ (1 + shift), to
the ten-thousandth (+10 % -> 0,9239 ÷ 1,1 = 0,8399), and every Swiss euro
figure on the page is converted at that hypothesis. The stored rate is never
modified and nothing is fetched. Because the ECB's terms require a
modification to be stated, the page says it in two places: the Swiss card
reads *« Hypothèse du curseur : 1 € = … CHF (taux de référence de la BCE du
27.10.2026 : 0,9239 CHF). »*, and the slider's card *« … Le curseur est une
hypothèse, pas un cours. »* At 0 the rate IS this row's rate and every figure
is the reference figure (R751, pinned by `e2e/calcs-figures.spec.ts`).

### L15 — Swiss cost-sharing caps. LAMal art. 64; OAMal art. 103. VERIFIED 02.11.2026.

From `docs/sources/primes-lamal/sources-2026-11.md` (S1, collected 02.11.2026;
SHA-256 902b3830f77c908254c56532e1f79d991f9acb413cc4fd019b6cabf4ed77e75a, not yet
in `CHECKSUMS.txt`). LAMal, consolidation in force 01.07.2026, art. 64 [S1.1]:

>   a. un montant fixe par année (franchise); et
>
>   b. 10 % des coûts qui dépassent la franchise (quote-part).
>
> 4 Pour les enfants, aucune franchise n’est exigée et le montant maximum de la quote-part est réduit de moitié. Plusieurs enfants d’une même famille, assurés par le même assureur, payent ensemble au maximum le montant de la franchise et de la quote-part dus par un adulte.
>
> 5 En cas d’hospitalisation, les assurés versent, en outre, une contribution aux frais de séjour, échelonnée en fonction des charges de famille. Le Conseil fédéral fixe le montant de cette contribution.

OAMal, consolidation in force 22.10.2026 (its applicability ends 31.12.2026;
no later consolidation was listed, and the amounts date from 2004 - fn 438,
439), art. 103 [S1.2]:

> 1 La franchise prévue à l’art. 64, al. 2, let. a, LAMal s’élève à 300 francs par année civile.[fn 438]
>
> 2 Le montant maximal annuel de la quote-part au sens de l’art. 64, al. 2, let. b, LAMal s’élève à 700 francs pour les adultes et à 350 francs pour les enfants.[fn 439]
>
> 7 Les al. 1 à 4 sont applicables par analogie aux assurés résidant dans un État membre de l’Union européenne, en Islande, en Norvège ou au Royaume-Uni et qui sont assurés en Suisse.[fn 442]

priminfo.admin.ch, FAQ [S1.3], on where the child rules stop:

> La franchise ordinaire s'élève à 300 francs par année civile et la quote-part maximale à 700 francs par année pour les adultes. Un assuré qui a opté pour une franchise de 300 francs paiera donc au maximum 1000 francs par année civile. Les enfants jusqu'à 18 ans révolus ne paient pas de franchise et ils versent une quote-part de 350 francs au maximum. L'assuré peut cependant augmenter sa franchise.

**What the page does with it (R746).** The card *« Une année avec beaucoup de
soins »* shows the most the household pays on top of its premiums in a
calendar year: per adult or young adult (the child rules stop at 18, L5),
the franchise the premium data carries (300 CHF, al. 1) + the quote-part cap
(700 CHF); per child, the quote-part cap alone (350 CHF); the children
together at most an adult's 1 000 CHF (art. 64 al. 4, second sentence - the
Swiss totals already assume one insurer for the household). Al. 7 is why it
applies to a frontalier residing in France and insured in Switzerland. The
figures are `COST_SHARING` in `web/lib/lamal/cost-sharing.ts`, never typed in
copy. **It is never added to either side** of the comparison.

**What it does not count, and says so:** the hospital contribution of al. 5,
15 CHF a day *« sans limite de temps »* [S1.4]. **Not used, and listed for the
reviewer:** OAMal art. 103 al. 5, a flat-rate franchise and quote-part an
insurer MAY levy when cover is planned for less than a calendar year - which
is the case of an affiliation from a date (L9, L16); the card states the
annual caps.

**The card's one sentence with no row:** *« sans mutuelle, le reste à charge
français n'a pas de plafond annuel comparable »* is the operator's wording
(R746, "in the design's words"); no source in this file states it. Raised in
the FW-CALCS-A2 report's QUESTIONS.

### L16 — a partial first month. NOT ESTABLISHED for a frontalier.

The general rule, priminfo FAQ [S2.1] (the OFSP page S2.2 and its PDF S2.3
say the same):

> Non. La prime de l’assurance-maladie de base est divisible. Cela signifie que les assureurs doivent calculer les primes en jours en cas de prise de domicile en Suisse ou de départ à l'étranger.

Its scope, as the collection records it [S2.1]: birth, arrival in or departure
from Switzerland, death - *« None of the three questions names a cross-border
worker (frontalier). »* The frontalier's own start of cover is OAMal art. 7
al. 4 [S2.4] - from the validity of the permit when insured in time - and
neither it nor LAMal art. 5, OAMal art. 90 or 92a says how a part-month is
charged (NOT FOUND, item 4).

**So the comparator does not apply the day rule to a frontalier** (the
orchestrator's note on addendum 2: S2 not established for this page). R744's
fallback applies literally: whole months **from the month after** the start
month - the start month is never counted, even when the start is the 1st -
and the Swiss card says *« Mois de début non compté : règle non vérifiée. »*
Known consequences, in the report: a start on 1 January counts 11 months;
a start in December counts none. The question goes to the operator.

### L17 — how the three months are counted. NOT FOUND.

Every source gives the period and the events, none the counting [S3.1-S3.6;
NOT FOUND item 1]. CLEISS FAQ [S3.3]:

> • Si vous êtes travailleur frontalier ou travailleuse frontalière : vous disposez de 3 mois à compter de la prise d'activité professionnelle en Suisse ou du transfert de résidence en France pour exercer l'option entre les systèmes d'assurance maladie suisse et français.

Légifrance was blocked by a bot check (NOT FOUND item 2), so nothing from the
Code de la sécurité sociale is quoted. **What the page does (R748):** the
helper *« Votre délai »* takes the event (the four of rows D1-D6, as the banner
words them) and its date, and shows an end computed ONE stated way - the
event's date plus three calendar months, clamped to the last day of the
target month (`optionPeriodEnd`, `web/lib/lamal/deadline.ts`) - **with
*environ*** and the warning *« Date indicative : la façon exacte de compter
les trois mois n'est pas vérifiée ici. Confirmez-la auprès de votre caisse
d'assurance maladie avant de vous y fier. »* (the design file's sentence),
which stays whatever S3 later says. The reminder e-mail is not built (R749).

### Source D, and the URSSAF line under "NOT rowed", after this pass

- **Source D** (ge.ch, monthly premiums 2026 for France residents) is now the
  cross-check of L3 above. Its figures are still not republished.
- **URSSAF** under *NOT rowed* below said the CMU contribution rested on
  secondary sources only. **Superseded on 27.10.2026** by L7–L13: the
  formula is read from the Code de la sécurité sociale itself, the rounding
  and the practice from URSSAF's own pages.

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
