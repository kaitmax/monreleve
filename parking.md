# parking.md

Open questions that did **not** stop a task, and the conservative option
taken instead. Ruling **R156**, created in FW18.

> **Every entry here is a decision that has already shipped.** A parked item
> is not an outstanding defect and not a task waiting to be done: it is a
> question the evidence did not settle, resolved in the direction that claims
> less, with the alternative and the cost of switching recorded so that
> reversing it is deliberate. A register that is longer is not a product that
> is less finished — it is one that has been honest about more of its edges.
> This is the product's own argument applied to its construction: it claims no
> more than the record supports, including about itself.

## Why this file exists

The operator is not always awake when a session runs. Before R156, an
unclear decision meant one of two bad outcomes: stop the task and lose the
night, or guess and ship something that reads as settled. R156 gives a third:
take the option that claims less, ships less, and can be changed tomorrow
without a migration, a 301, or a correction to something already published —
then record it here and continue.

**This file is the operator's morning reading.** Each entry is a decision
somebody else made on their behalf, with the alternative and the cost of
switching, so that reversing one is a deliberate act rather than an
archaeology exercise.

## THE TWO REGISTERS, AND WHY THIS ONE IS CALLED PARK — ruling R162

This file numbers its entries **`PARK-<n>`**. It did not always, and the
reason it does now is worth two minutes.

There are **two registers** in this product, and until FW18b both numbered
their entries `P<n>` while agreeing on none of the numbers they shared:

| | `parking.md` (this file) | `web/lib/content/provisional.ts` |
|---|---|---|
| What it holds | decisions taken without the operator | regulatory readings that are not settled |
| Who reads it | the operator, next morning | **the public**, on `/sources` |
| Numbered | `PARK-1`, `PARK-2`, … *(since R162)* | `P1`, `P2`, `P3` *(unchanged)* |
| 1 | the employer attestation is described, never asserted | the imputation order |
| 2 | droit-option-lamal-cmu is NOT published *(superseded)* | 49,9 % versus under-50 |
| 3 | the declaration guide carries no date, form or procedure | the exact method's cap proration |

**THE PUBLISHED IDS KEEP THEIRS, and that direction is not arbitrary.**
`jours-de-mission-hors-suisse` sends readers to *« la référence P1 »* and
`seuil-social-49-9-pourcent` to *« la référence P2 »* in prose, `/sources`
renders a section per reading, and `readingAnchor` builds `#lecture-P1` —
which is an anchor, and an anchor is a URL that SPEC §14 makes permanent.
Renaming user-facing references to resolve an internal collision is
backwards. The internal register is the one that moves.

**WHY IT MATTERED ENOUGH TO RENAME.** The collision did not merely risk
confusion; it produced a **factually wrong statement about a regulatory
interpretation, inside the file that exists to keep decisions traceable**.
FW18b wrote "P6 supersedes P2", meaning this file's P2 — the droit d'option
refusal, correctly superseded. Read against the published register, that
sentence says the 49,9 % interpretation had been withdrawn. It had not, it
has not, and it stands today.

That is the lesson, and it generalises past this file: a namespace shared
between an internal record and a published one will eventually make the
internal record assert something false about the published one, and no test
can see it because each register is internally consistent.

Closed as PARK-9.

## The boundary, which is not negotiable

A question is **parked** when it concerns: copy wording; a token value
already present in a brief (R77); a layout choice; a hedge-versus-state
decision on an unverified claim — R146 case (b) *is* the conservative
option; a missing data source (degrade the feature, never invent data); a
component shape; a test's strictness.

A question **stops the task and gets a report** when it concerns:

- anything **permanent** — a slug, a URL parameter name, a database column
  that would need a migration, an anchor, a published redirect;
- anything that would **publish a false or unsourced claim**. R146's three
  options are exhaustive and (c) *not written* is always available, so this
  should never be what forces a stop;
- a **gate, budget or threshold** change;
- a new **runtime dependency**;
- a **red commit** or a failing gate that cannot be fixed inside the
  increment;
- anything touching **`lib/calc-engine`**.

Two sentences that decide most cases: shipping less is always available and
always reversible — not publishing a page costs a day, publishing a wrong
one costs the thing this product sells.

## Format

Appended, newest last. Never edited in place once the operator has read it;
a reversal is a new entry that names the one it supersedes.

```
## PARK-<n> - <one-line title>  [FW<task>, <date>]
QUESTION:  what was unclear, in two sentences.
TAKEN:     the conservative option, and why it is reversible.
NOT TAKEN: the alternative, and what it would cost to switch.
TOUCHES:   files, tests and baselines a switch would change.
```

---

## PARK-1 - the employer attestation is described, never asserted  [FW18, 2026-09-16]

QUESTION:  SPEC 9.5 describes this cluster as "what employers must certify",
and the prompt asks for "what the employer certifies from 2026". No row in
`docs/regulatory-sources.md` covers an attestation — no obligation, no date,
no form — and `claims` accepts only the eight source rows plus P1–P3, so
there is no key under which such a statement could be cited.

TAKEN:     The article never asserts the obligation. It is written in the
conditional throughout — *si votre employeur vous remet un document*, *le
document que vous recevez* — which claims nothing about whether one must be
issued, by whom, or since when. Everything stated as a rule is one of four
declared claims. This is R146 case (c), *not written*, applied to the
article's premise rather than to a sentence. Reversible: if a verified row is
added, the conditional sentences become declarative and nothing else moves —
no slug, no anchor, no link.

NOT TAKEN: Asserting the obligation and hedging it as an open question.
Rejected because R146 case (b) requires a KEY to hedge against, and inventing
one would put a citation in `claims` that resolves to nothing — the failure
that reads as sourced, which R146 exists to prevent. Switching later costs a
new row in `docs/regulatory-sources.md`, an id in `SOURCE_IDS`, and a row
rendered on `/sources`.

TOUCHES:   `web/content/guides/attestation-employeur-teletravail.mdx`
(the lede, the FAQ, four `claims` entries),
`web/lib/content/sources.ts`, `docs/regulatory-sources.md`,
`web/tests/unit/pages/sources.test.tsx`, and the `/sources` baselines.

## PARK-2 - droit-option-lamal-cmu is NOT published  [FW18, 2026-09-16]

SUPERSEDED BY PARK-6 ON 16.09.2026. The article is published. This entry is kept
because the refusal was correct on the record as it stood, and the decision
below is what made the verification worth doing.

QUESTION:  The article's two load-bearing facts are the three-month window
and that the choice is irrevocable. Neither appears anywhere in
`docs/regulatory-sources.md` — the file has no entry for LAMal, CMU, the
droit d'option, a window or irrevocability — and SPEC §22 names
"3-month irrevocable LAMal/CMU option" in its own list of figures "compiled
from advisory and news sources", to be verified "before the fixtures are
frozen". Checkpoint A verified six of eight telework constants and never
reached this one.

TAKEN:     Not published. The route stays `planned`, no MDX file is created,
the hub lists six guides. R146's options are exhaustive and (c) *not written*
is the only one available: (a) needs a verified row and there is none, (b)
needs a key to hedge against and `claims` accepts only the eight source rows
plus P1–P3. Writing the window or the irrevocability would be an unsourced
regulatory claim about a decision a reader cannot undo — which is the
category R156 says must never be published. Reversible at zero cost: nothing
was created, so nothing must be corrected or redirected.

NOT TAKEN: Publishing the article with the window and the irrevocability
hedged in prose. The `claims` mechanism would not have refused it — the test
validates DECLARED claims and does not force every sentence to be declared —
which makes this a loophole rather than a permission. Also rejected:
publishing a "how to find out" page with no rules in it, because SPEC §9.5's
judgement on thin pages ("worse than none") applies here as much as to a
canton page.

TOUCHES:   To publish later: rows in `docs/regulatory-sources.md` for the
window and the irrevocability, ids in `web/lib/content/sources.ts`
(`SOURCE_IDS`, `SOURCE_ENTRIES`), French descriptions in
`web/lib/fr/sources.ts`, then the MDX file, `status: 'live'` in
`web/lib/content/routes.ts`, the hardcoded sitemap list in
`web/tests/unit/content/routes.test.ts`, the census exemption in
`web/tests/unit/pages/singletons.test.tsx`, and the hub baselines.

## PARK-3 - the declaration guide carries no date, form or procedure  [FW18, 2026-09-16]

QUESTION:  SPEC §9.5 describes this cluster as "April declaration season",
which a reader would expect to mean deadlines and forms. No French
declaration date, form number or procedure appears in
`docs/regulatory-sources.md`, whose eight rows are all telework constants.

TAKEN:     Published, but structural: what number a reader must be able to
produce, where it comes from, why it cannot be reconstructed in April, and
which regime decides where the days are taxed — each of those resting on a
declared claim. No date, no form number, no step-by-step. The article says so
on the page, in a section called *Ce que ce guide ne vous dira pas*, because
an article that silently omits the deadline reads as one that forgot.
Reversible: verified rows would turn that section into content without moving
the slug, the anchors or the mesh.

NOT TAKEN: Publishing the deadlines from general knowledge. That is the
unsourced-claim category R156 says never to publish, and a wrong filing date
costs a reader more than an absent one. Also not taken: declining to publish
at all, as with PARK-2 — unlike the droit d'option, this article has a real
subject that IS sourced (which number, from where, and why April is too
late), so it is not a thin page.

TOUCHES:   `web/content/guides/declaration-impots-frontalier.mdx` (one
section and the second FAQ answer), plus rows in
`docs/regulatory-sources.md` and `web/lib/content/sources.ts` if dates are
ever verified.

## PARK-4 - the LAMal/CMU comparator is NOT published (R157 option 3)  [FW19, 2026-09-16]

QUESTION:  R157 fixes an order of preference for premium data and forbids
deviating upward from it. Two things had to be established: whether a dated,
licensed premium dataset could be obtained, and whether the page could be
built honestly without one.

TAKEN:     Option (3). Nothing is published. `/calculateur-lamal-cmu` stays
`planned`, no `lib/lamal` is created, no route, no copy, no baseline. Two
independent reasons, either of which is sufficient:

1. **The data could not be licensed from here.** priminfo.admin.ch does
   publish 2026 premiums (PDF and XLSX) and points to opendata.swiss for the
   CSV — but the opendata.swiss dataset page and the CKAN API both return
   **403** in this environment, so the licence, its terms and its
   redistribution conditions could not be read. R157 forbids "a scraped page
   without a licence", and a dataset whose terms are unknown is exactly that.
   Option (1) is therefore unavailable *from here* — not proven unavailable in
   general, which matters: an operator with browser access may well be able to
   complete it in minutes.

2. **The page's required warning cannot be written, which defeats option (2)
   as well.** SPEC §9.6 requires "a prominent error banner stating the choice
   is **irrevocable** and the window is **three months**", and FW19's own AC2
   repeats it. FW18 parked the droit-option guide (PARK-2) precisely because those
   two facts have no verified row and SPEC §22 lists "3-month irrevocable
   LAMal/CMU option" among figures "compiled from advisory and news sources"
   awaiting verification. So the user-entry path leads to a tool that helps
   somebody toward an irreversible decision while unable to state that it is
   irreversible — which is worse than no tool, not better.

Reversible at zero cost: nothing was created, so nothing must be corrected,
redirected or un-indexed.

NOT TAKEN: (a) Option (2) with the banner omitted — fails AC2 and SPEC §9.6,
and removes the single most valuable thing the page would carry. (b) Option
(2) with the banner hedged — the tool would still be steering an irreversible
choice on facts it cannot source. (c) Premium figures from memory or an
averaged estimate — forbidden outright by R157.

TOUCHES:   To build later: a licensed dataset under `web/data/` with source
URL, fetch date and licence in its header; a row in
`docs/regulatory-sources.md` and an id in `web/lib/content/sources.ts` for the
premium data AND for the droit d'option window and irrevocability; then
`web/lib/lamal/`, the page under
`web/app/(public)/calculateur-lamal-cmu/`, `web/lib/fr/lamal.ts`,
`status: 'live'` in `web/lib/content/routes.ts`, the sitemap census in
`web/tests/unit/content/routes.test.ts`, the R119 census in
`web/tests/unit/pages/singletons.test.tsx`, and new baselines at 1440/390.

## PARK-5 - the CLEISS URL is cited pending the operator's confirmation  [FW18b, 2026-09-16]

CLOSED 16.09.2026. The operator fetched
`https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html`
on 16.09.2026 and read it in full. The URL resolves, the content matches, and
CLEISS is the publisher. `docs/regulatory-sources.md` now records the page as
confirmed rather than provisional; the source rows in
`web/lib/content/sources.ts` needed no change, because they already carried
the URL and the date — it was the CITATION's standing that was provisional,
not its content.

It was open for one day, and the cost of that was one paragraph of hedging in
a file nobody outside the repo reads. That is what the parking rule is for.

QUESTION:  The operator performed the droit d'option verification and reported
its content, naming CLEISS as the body. The prompt asks that the URL be
confirmed with them before the row is written; they were not in the loop when
the task ran.

TAKEN:     The row cites the body with certainty and the page provisionally.
`https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html`
was located by search after the pass, and its published content matches the
pass on every checkable point — three months, default affiliation in
Switzerland, exercised once and irrevocable, and the same three reopeners.
`docs/regulatory-sources.md` says so in a note above the table, so the file
records what is certain and what is not. Reversible at near-zero cost: the URL
is one string in a data file and one line in the document; no slug, anchor or
published link depends on it.

NOT TAKEN: (a) Stopping the task until the URL could be confirmed — R156 says
an open question does not stop the task, and the facts themselves are not in
doubt. (b) Citing only "CLEISS" with no URL, which would make the row
unfollowable for a reader and defeat the point of `/sources`. (c) Asserting
the URL silently, which would be a claim about provenance with no basis — the
same standard R146 sets for the facts themselves.

TOUCHES:   `docs/regulatory-sources.md` (the note and the source line) and the
four `droitOption*` entries in `web/lib/content/sources.ts`. If the operator
read a different page, those are the only edits; the facts and every claim
citing them are unaffected.

## PARK-6 - the droit d'option guide is published, superseding parking P2  [FW18b, 2026-09-16]

QUESTION:  FW18 refused to write this article. Its two load-bearing facts —
the three-month window and the irrevocability of the choice — had no verified
row in `docs/regulatory-sources.md`, and SPEC 22 lists the three-month figure
among those "compiled from advisory and news sources". PARK-2 recorded the refusal
and named what would unblock it: a verified row for each fact.

TAKEN:     Written and published. The operator read CLEISS — the French public
body responsible for the coordination of cross-border social security, an
authority rather than an advisor — and `docs/regulatory-sources.md` carries
the result as rows D1 to D7. Four source keys back four claims, every
regulatory sentence in the article cites one of them, and none is hedged:
R146 case (a) applies, so the article states the facts plainly. The article
also says the thing every advisory page gets wrong — that the window opens on
any of four events and not on the hiring alone — which is the reason it is
worth more than the dozen pages already ranking for the term.

NOT TAKEN: (a) Publishing it in FW18 with hedges, which is what PARK-2 refused and
still refuses: a hedge on a three-month irrevocable deadline is worse than
silence, because a reader who acts on a hedged deadline has still missed it.
(b) Waiting for a second source to corroborate CLEISS. CLEISS is the body, not
a commentator on the body; a second source would be a page quoting it.

TOUCHES:   `web/content/guides/droit-option-lamal-cmu.mdx`, the pillar's
`related` and its forward link, `status: 'live'` in
`web/lib/content/routes.ts`, the sitemap census and the planned-route set in
`web/tests/unit/content/routes.test.ts`, the R119 exemption in
`web/tests/unit/pages/singletons.test.tsx`, and the guide baselines.

SUPERSEDES: PARK-2. Under R162 that name can no longer be read as the
published P2, which is the 49,9 % interpretation and is untouched and
standing. PARK-2 stays in this file rather than being deleted — the refusal
was correct on the record as it stood, and a parking file that erases the
decisions that were later unblocked stops being a record of how the product
decides.

## PARK-7 - the article does not link /calculateur-lamal-cmu  [FW18b, 2026-09-16]

QUESTION:  The comparator is the natural next step for a reader who has just
learned that the choice is irrevocable, and SPEC 9.6 names the page. It is
`status: 'planned'` — FW19 reached R157 option (3) and built no UI, because
the premium data is unlicensed and a comparator that invents a number is
worse than no comparator.

TAKEN:     No anchor and no mention. R85 forbids linking a planned route, so
the only question was whether to name the tool in prose and tell the reader to
wait. The article does not: a promise of a page that does not exist is a
second thing for the reader to remember and the product to owe. Instead the
section that would have carried the link says what drives the cost on each
side — canton, age, franchise and insurance model in Switzerland, income in
France — and states that no simple rule decides between them. That paragraph
is true whether or not the comparator is ever built.

NOT TAKEN: (a) Linking it anyway, which R85 forbids and which would put a 404
on a live page. (b) "Un comparateur arrive prochainement", which dates the
page the moment the plan changes. (c) Linking the URSSAF simulator as a
substitute: it computes the French side only, and a reader on a page about
choosing between two systems who is handed one side's figure has been given
half a comparison with nothing saying so.

TOUCHES:   One section of `web/content/guides/droit-option-lamal-cmu.mdx`. If
FW-whichever builds the comparator, this is where its link goes.

## PARK-8 - the reviewer field stays, and nothing renders it  [FW18b, 2026-09-16]

QUESTION:  R160 took the name out of the chip. `reviewer` is still a required
field of the frontmatter contract, validated at build, carried by all seven
articles and the fixture — and now read by nothing. A required field nothing
reads is the kind of thing that rots quietly.

TAKEN:     Keep it, unrendered. It records who made the pass, which is true
and worth keeping: `lastReviewed` says a pass happened and `reviewer` says who
made it, and dropping half of that makes the remaining half harder to trust,
not easier. The e2e test now asserts the value does NOT reach the reader, so
"recorded but not claimed" is a state the suite holds rather than a comment
somebody has to believe.

NOT TAKEN: (a) Deleting the field and the eight values with it. That is the
irreversible direction — the values would have to be reconstructed from git
history — and it is the operator's call, not one to take while implementing
their ruling. (b) Making it optional and driving the chip off its presence:
reviewer present names them, absent says "en attente". That is the better
mechanism and it is why this entry exists, but it decides what the chip says
once a real expert review happens, and R160 says only what it says today.
(c) Renaming it `internalReviewer` to mark that it is not the expert review.
Cosmetic; the contract's own comment can say so, and a rename touches eight
files for no change in behaviour.

TOUCHES:   `web/lib/guides/frontmatter.ts` (the field), the eight articles,
and `app/(public)/guides/[slug]/page.tsx` if it is ever read again. If the
operator picks (b), the chip is the only render site and the copy module
already holds both sentences' worth of decision in one constant.

## PARK-9 - two registers both numbered their entries P<n> (closed by R162)  [FW18b, 2026-09-16]

QUESTION:  `parking.md` and `web/lib/content/provisional.ts` both identify
their entries as P1, P2, P3 …, and they agree on none of them. The
provisional ids are **published**: `/sources` renders a section per reading,
`readingAnchor` builds `#lecture-P1`, and two guides send readers to "la
référence P1" and "la référence P2" in prose. The parking ids are internal
and were created later, in FW18, without anybody noticing the collision.

TAKEN, AS PARKED:     Neither renamed. A disambiguation note at the top of
this file, and a rule that every cross-reference here names its register.
Conservative because the published ids are the expensive ones — `#lecture-P1`
is an anchor, an anchor is a URL, SPEC §14 makes those permanent — so the
parked option deferred the rename rather than guessing its direction.

CLOSED BY R162, 16.09.2026, and the operator's ruling went further than the
parked option: **this register is renamed to `PARK-<n>`; the published
`P<n>` in `provisional.ts` keep theirs.** The reasoning is the one the entry
could not take on its own authority — *renaming user-facing references to fix
an internal collision is backwards.* Done: every heading and every internal
cross-reference in this file now reads `PARK-<n>`, and the six references to
the PUBLISHED register are untouched and identified as such.

The operator also named the lesson, which this entry had recorded as a risk
and they recorded as a fact: **a namespace collision produced a factually
wrong statement about a regulatory interpretation, inside the file that
exists to keep decisions traceable.** That is the reason the rename was worth
doing rather than documenting around.

MAPPING, for the four committed reports that cite the old names.
`REPORT-FW18.txt`, `REPORT-FW19.txt`, `REPORT-NIGHT.txt` and
`REPORT-FW18b.txt` cite P1 through P11 meaning THIS register. They are the
record of sessions that happened and are not rewritten; read every `P<n>` in
a report dated on or before 16.09.2026 as `PARK-<n>` unless it appears as
"la référence P<n>", `#lecture-P<n>`, or in a list of what `claims` accepts —
those three forms are the published register in every case.

TOUCHES:   This file only. No code reads these ids, nothing compiles
differently, and no test changed.

## PARK-10 - typed DERIVATIVES of a RuleSet value sit beside a live expression  [FW18b, 2026-09-16]

CLOSED BY R163 IN FW20. The operator ruled: prose that narrates a fixture is
tied to the fixture. Implemented as the test branch R163 permits rather than
as interpolation - the fixtures directory sits outside web/, so reading it
from lib/guides at module load would be R139 failure shape, a path that
exists here and in a full clone and may not exist wherever only web/ is
deployed.

web/tests/unit/guides/fixture-narration.test.ts derives every number both
passages state from geneva-cases.json and RuleSet, including the 94 that is
neither - it is the sum of a fixture input and an engine constant, which is
why R147 could never have seen it. Proven by changing frenchTaxedDays from
14 to 12 in the fixture: four tests go red, both guides among them.

QUESTION:  Found by FW18b's read-through, and no layer could have found it.
Two articles narrate the Genève worked example — 84 télétravail days, 24
mission days, base 240 — like this:

    Jours de mission crédités : {missionCap}, soit le plafond
    Jours comptés contre le plafond fiscal : 94 sur une base de {basisDays}
    Taux déclarable : 39,16 %
    Jours imposables en France : 14

`{missionCap}` is live, from RuleSet. **94, 39,16 and 14 are hand-computed
from it** — 84 + 10, 94 ÷ 240, 24 − 10. Move the cap to 12 and the expression
updates while the three derivatives do not, and the passage reads "seuls 12
sont crédités, et les 14 autres deviennent imposables" — a sentence that
contradicts itself in the same breath.

R147's scan cannot see any of it: it looks for the figures themselves —
`10 jours`, `240 jours`, `40 %` — and a derivative matches none of its
patterns. This is the same failure one level down.

TAKEN:     Nothing changed, and the question is recorded. Both readings are
defensible and choosing between them is a rule, not a wording:

  (a) The whole block is a CITATION of an example the Genève administration
      published. Every number in it is the source's, including the cap that
      produced it — so `{missionCap}` is the intruder and should be the
      literal the source printed. R158's reasoning, applied to a figure.

  (b) The block is an ILLUSTRATION of the product's own engine, so every
      number should be an expression and none typed — which needs the scope
      to carry derived values, not just constants.

Recording rather than choosing is the conservative option because either
choice is a precedent for every future worked example, and today's text is
CORRECT: the cap is 10, and 94, 39,16 and 14 are right.

NOT TAKEN: Picking (a) because it is the smaller edit. It replaces one
expression with a literal in two articles and would look tidy, and it decides
by convenience the question of whether a cited example is a quotation or a
demonstration — which is exactly the shape of decision R156 says to park.

TOUCHES:   `web/content/guides/geneve.mdx` and
`web/content/guides/jours-de-mission-hors-suisse.mdx` (the narration under
each table); under (b) also `web/lib/guides/scope.ts`. The figures inside the
`<DataGrid>` itself are already settled — R158 gave them the key
`genevaWorkedExamples` and they are the administration's, not ours.

NOTE:      The engine is not affected either way. SPEC 7.5's Genève fixtures
are what pin 39,16 % and 4,16 %, and they pass. This is about PROSE that
narrates the fixtures going stale while the fixtures themselves do not.

## PARK-11 - /sources hides its status column on a 1440 desktop  [FW18b, 2026-09-16]

QUESTION:  Found by FW18b's read-through, by cropping the regenerated
baseline and reading it (R135). The regulatory table on `/sources` sits in
the 616 px article measure, and its intrinsic width is 665 px. Measured:

    viewport   container   table   status column right edge   page overflow
    1440       616         665     49 px outside the container   0
    1280       616         665     49 px outside the container   0
     390       350         665    315 px outside the container   0

The page never scrolls sideways — `.tableScroll` absorbs it, which is
exactly R159's rule working. The cost lands entirely on the LAST column,
which is the status: a reader on a 1440 screen with 824 px of unused viewport
sees every rule, value, source and date, and a chip clipped mid-word to
"Trans" and "En att".

It matters more since this task. R160 made every guide's chip read
« Relecture experte : en attente » and LINK HERE, so `/sources` is now the
page that answers "what is verified" — and the column carrying that answer
is the one off-screen by default.

IT PREDATES FW18b. `sources.module.scss` already records the same shape:
"container is 616 px wide, so the table overflowed by 64 px and clipped the
…". FW18b's four droit d'option rows made the table denser, not wider.

TAKEN:     Recorded, not fixed. The fix is a container width — the section
could take the `public` measure instead of `article` on wide screens, which
needs no new token and is one prop — but which measure a reference table gets
is a layout decision on a page FW20 is scheduled to rewrite, and taking it
here would move every `/sources` baseline again for a reason outside this
task.

NOT TAKEN: (a) Widening it now. Small, reversible, and still a layout choice
made in passing on somebody else's increment. (b) Dropping or shortening the
status column so it fits — that trades the reader's access to the status for
a tidier default, on the one page whose job is to disclose status. (c)
Treating the measured 0 px of page overflow as the whole answer: it is the
correct result of the rule and says nothing about whether a reader can see
the column.

TOUCHES:   `web/app/(public)/sources/page.tsx` (the Container width on the
table section), `web/app/(public)/sources/sources.module.scss`, and the two
`page-sources-*` baselines.

## PARK-12 - the shell no longer announces unbuilt pages  [FW20, 2026-09-16]

QUESTION:  todo.md's FW20 check is "click every footer link: zero 404s", and
the footer had two: `/calculateur-lamal-cmu` and `/application`. Both are
declared, neither is built. The state is older than this task —
`lib/content/routes.ts` has said since FW9 that "the nav and footer still link
planned ones … and every one of those links is a 404 today" — and eleven tasks
later two were left, 404ing from the footer of every page on the site.

Nothing caught it because nothing asked. The registry test asserts every href
the shell renders is REGISTERED, which these were; the sitemap test asserts no
planned route is LISTED, which they were not. Between *declared* and *in the
sitemap* sat *linked from every page and broken*.

TAKEN:     `isHrefHidden` now hides any route that is not `live`, so the nav
and footer show only pages that exist. It is R85's rule — a target renders
only when it is live — which the result panel has followed since FW12 and the
shell simply never applied.

The reader-facing consequence: "Comparateur LAMal / CMU" and
"L'application" disappear from the footer, and the *Calculateurs* disclosure
now holds one child rather than two.

It follows PARK-7's own precedent. That entry refused to link the comparator
from the droit d'option guide and refused equally to *name* it and tell a
reader to wait, because "a promise of a page that does not exist is a second
thing for the reader to remember and the product to owe". A footer entry is
the same promise in a smaller font.

NOT TAKEN: (a) Rendering them as plain text rather than links — no 404, and
the product still announces two unbuilt things on every page. That is the
option PARK-7 already rejected for the same product. (b) Removing them from
`lib/fr/shell.ts` entirely. The copy is right and the routes are real plans;
what was wrong was rendering an anchor to them. Deleting the entries would
mean rewriting them when the pages ship. (c) Leaving the 404s — todo.md's
acceptance criterion forbids it, and it is the kind of defect a stranger
finds in ten seconds.

REVERSIBLE: one predicate, one line. If you want planned products announced,
it is `if (route.status !== 'live') return true;` in `isHrefHidden` plus a
non-link rendering in `PublicShell`.

TOUCHES:   `web/lib/content/routes.ts`, and four tests that had encoded the
old behaviour — three in `PublicShell.test.tsx` that derived their
expectations from the DECLARED nav rather than the rendered one (R171 again),
and one in `regulatory-gate.test.ts` whose premise was that the unbuilt
comparator kept a disclosure alive.

## PARK-13 - /cgu and /confidentialite describe a product that is not built  [FW20b, 2026-09-17]

QUESTION:  R172 made every claim about the product's own state derive from
`lib/content/product-state.ts`, and a sweep of all 234 reader-facing sentences
in `lib/fr` found the rule's five instances on four pages plus the footer -
all fixed - and a much larger concentration on two pages it did not touch.

`lib/fr/cgu.ts` opens with the product's own definition: *frontalier est un
outil de tenue de registre. Il enregistre les journees que vous declarez, il
les horodate au moment ou le serveur les recoit, et il met en forme un releve
annuel a partir de ces seules declarations.* None of those three things
exists. `prisma/schema.prisma` declares `AlertSubscriber` and nothing else,
`app/api/` holds `alertes`, `health` and `ready`, and there is no print or PDF
route. The same page also says the reader may delete their account from the
application, that offline days sync when the connection returns, and that the
service is free in 2027 *sans limitation de fonctionnalite* - which is the
sentence FW20 narrowed on /tarifs, surviving here in a broader form.

`lib/fr/confidentialite.ts` does the same for the Android application: *L'
application Android tient le registre de vos journees* introduces a seven-item
list of fields recorded nowhere. `android/` does not exist; the siblings of
`web/` are docs, fixtures, prompts, relay and tasks.

Nine sentences on /cgu and roughly a dozen on /confidentialite. Each is a
faithful description of what SPEC 8, SPEC 12 and SPEC 13 specify. Each is
false as a present-tense statement today.

TAKEN:     Nothing, on these two pages. Both are listed in
`tests/support/product-claims.ts` as EXEMPT, with the reason written out, so
the R172 scan reports them as a decision rather than passing over them in
silence. The exemption is the record that they were seen and measured.

The five instances that WERE fixed are the ones on pages whose subject is
what the product does today: the home page's meta description, /a-propos,
/tarifs, /releve-annuel, and $legal-01 in the footer of every page.

NOT TAKEN: (a) Deriving the CGU and the privacy notice from
`PRODUCT_STATE` the way the five were. It is the consistent move and it is
about twenty sentences of contract and privacy copy, each of which would need
a present-tense and a future-tense reading written and reviewed. Rewriting a
contract is a decision the operator makes; R9 gives me document edits, and a
terms-of-service page is not that kind of document. (b) Putting them in the
future tense wholesale. A contract written entirely in the future reads as a
draft of a contract, and the honest form is probably a dated scope line
saying which clauses are in force - which is a legal question, not a wiring
one. (c) Leaving them out of the guard's list, which is what would have
happened if the sweep had not been run: the scan would have passed and the
pages would have looked examined.

WHY IT MATTERS MORE THAN IT LOOKS: /cgu is the page a reader consults when
they want to know what they are agreeing to, and today it tells them they are
agreeing to a register that cannot record anything. It is the same defect
R172 names, on the pages where a false statement is least excusable - and it
is bigger on those two pages than on all five that were fixed combined.

REVERSIBLE: entirely. Removing either file from `EXEMPT` turns its sentences
into failures again, which is the intended way to pick this up.

TOUCHES:   nothing yet. When taken: `web/lib/fr/cgu.ts`,
`web/lib/fr/confidentialite.ts`, their two page tests, and the EXEMPT list in
`web/tests/support/product-claims.ts`.

RULED (Q62, after FW20b): THE FIX IS A DATED SCOPE LINE, NOT A REWRITE.
The operator’s answer, and it changes what "taken" will mean here.

A contract written entirely in the future reads as a draft of a contract.
So the clause BODIES stay in the present - which is the register a contract
is written in - and the page gains a dated line saying WHICH CLAUSES ARE IN
FORCE TODAY, and that the remainder takes effect when the corresponding
feature ships.

That is a different shape from the five R172 fixed. Those were sentences
about what the product does, and the repair was to derive each from
PRODUCT_STATE. This is a legal instrument whose clauses describe the whole
service by design; scoping it is one sentence about the document rather than
a rewrite of twenty sentences inside it.

AND IT WANTS A LAWYER BEFORE THE APP SHIPS, NOT BEFORE. The operator is
explicit that this is a legal question and should not be answered as a
wiring one. Parked in that form: the shape is decided, the wording is not,
and the deadline is the AN series rather than the next task.

## PARK-14 - $legal-01 drops its timestamp clause until the register exists  [FW20b, 2026-09-17]

> **SUPERSEDED BY R183.** The defect below is real and the remedy was wrong.
> Making the single shared string conditional kept ONE constant rendered on
> two surfaces, which has to be true on both; R183 splits it instead -
> `LEGAL_COPY.standing(state)` for the site, conditional, and
> `LEGAL_COPY.documentStanding` for SPEC 12’s document, verbatim and
> unconditional. R165’s lifted-copy rule, arriving on a legal string.
> Kept as written because the reasoning about the defect is the useful part,
> and because a parking entry that quietly changed its answer would be the
> register lying about its own history (R162’s subject, one file over).

QUESTION:  SPEC 12 item 6 specifies the document's legal footer as "each
entry carries a server recording timestamp; document established on user
declaration for record-keeping purposes; not tax advice", and SPEC 17.6 says
the SITE footer carries the same `$legal-01`. `LEGAL_COPY.standing` therefore
read, on every public page since FW8:

  Estimation fournie a titre indicatif, sur la base des jours que vous avez
  declares. CHAQUE JOUR ENREGISTRE EST HORODATE PAR LE SERVICE. Ce document
  ne constitue pas un conseil fiscal et n'engage ni l'administration
  francaise ni l'administration suisse.

`PublicShell.tsx:260` renders it in the footer of every public page. One of
those pages is /releve-annuel, whose body says the day register is not built.
The footer contradicted the article above it ON THE SAME RENDER - R172's
defect collapsed from three pages onto one - and it shipped in FW20 alongside
the very page it contradicts. FW20's read-through did not see it because a
footer is furniture a reader stops reading, and no claim-scan existed yet.

TAKEN:     the middle clause is now conditional on `trackerExists`. SPEC's
wording is preserved EXACTLY in the state SPEC describes: a document is a
thing that has entries, so the clause is true whenever there is a register,
and it is omitted only in the state SPEC was not written about. The two
render sites pass `PRODUCT_STATE` rather than a prop - LegalNote.tsx's "no
props" rule is about a CALLER choosing the wording, and a fact module is not
a choice.

R165 covers it independently: the site footer took the DOCUMENT's sentence
unchanged, which is the lifted-copy defect exactly. One constant rendered in
several places has to be true in all of them.

NOT TAKEN: (a) Leaving it. It is a present-tense claim that the service
timestamps recorded days, on the surface whose whole argument is that it
claims no more than the record supports, six lines below a paragraph denying
it. (b) Writing a second, site-only string. Two disclaimers is how the two
wordings drift, and R84's census counts occurrences of THIS constant. (c)
Rewriting the clause in the future tense. It is a legal disclaimer, not a
roadmap, and a footer that promises future timestamping says less than one
that does not mention them.

FOR THE OPERATOR: this edits a SPEC-quoted legal string. The change is a
branch, not a rewrite - nothing SPEC specifies has been altered, and the
sentence returns verbatim the moment `trackerExists` flips. If you would
rather $legal-01 stay literal and unconditional, the revert is one ternary.

REVERSIBLE: one line in `web/lib/fr/legal.ts`.

TOUCHES:   `web/lib/fr/legal.ts`, `web/lib/ui/react/LegalNote/LegalNote.tsx`,
`web/lib/ui/react/PublicShell/PublicShell.tsx`, and the six test files that
compared against the constant.

## PARK-15 - a baseline was regenerated against a half-edited tree  [FW20b, 2026-09-17]

> **TAKEN, as R182 and R184.** The proposal below asked for two things and
> both are now rules rather than intentions. R184: `scripts/visual.mjs`
> prints the commit it built from and how many paths were uncommitted, so a
> report can SHOW the baselines and the commit are the same tree instead of
> assuming it. R182 generalises the ordering half beyond this script - a
> check runs after the thing it checks for can exist - and its audit found a
> second instance: `og-image.test.ts` compares the shipped OG card against a
> baseline `test:visual` produces, from inside `pnpm test`, which the gate
> runs four steps earlier.

QUESTION:  FW20b increment 3 regenerated the visual baselines while increment
4's work was already underway in the same working tree. The container builds
inside the run, so what it photographed was whatever the files said at that
moment - and at that moment `/application` had been moved to `status: 'live'`
but the shell's CTA still asked only R85's question.

The result: `composants-shell-desktop.png` and 68 siblings were rewritten to
show the header rendering a prominent "Suivre mes jours" button. That is the
exact defect the next increment identified and removed - a site-wide offer of
day-tracking on a product that cannot track a day - and the visual record had
just been made to certify it as correct.

NOTHING REACHED MAIN. Increment 3 was never committed, and the contaminated
baselines were overwritten by a clean run before anything was pushed. The
defect is in the process, not in the repository.

WHY IT IS WORTH AN ENTRY. R135 governs regenerating a baseline - it must be
listed, with a reason, and somebody must crop it and look. All three happened
and none of them would have caught this: the list was accurate, the reason
was true of the sentence that changed, and the crop that was read was
/sources, which was correct. THE ASSUMPTION R135 DOES NOT STATE is that the
tree being photographed is the tree you mean to photograph.

It is the third instance in FW20b of one shape - a guard that cannot see the
thing it guards because of WHEN it runs:
  (a) tests/unit/meta/distdir-leaks.test.ts runs inside `pnpm test`, which
      the gate runs BEFORE `test:visual` - so the leak a visual run creates
      is invisible to the gate run that created it.
  (b) a planted defect was logged as planted without checking the file had
      changed, and `String.replace` had silently hit the FAQ instead of the
      prose (R180).
  (c) this.

TAKEN:     the baselines were regenerated from a settled tree with no edits
during the run, and the two images that carried the CTA were read again
afterwards.

PROPOSED, FOR THE OPERATOR TO RULE ON: a baseline is regenerated from a
QUIESCENT tree. The regeneration is the last thing an increment does, nothing
is edited while it runs, and the run prints the working-tree state it
photographed so the report can show the two agree. Today `scripts/visual.mjs`
prints WHICH baselines changed; it does not print WHAT it built them from,
and those are different claims - the same distinction R177 draws between a
stylesheet link and a stylesheet.

NOT TAKEN: (a) Serialising by convention - "remember not to edit during a
visual run" is the judgement version, and R132's own history says the
judgement version is the one that fails. (b) Having the script refuse to run
on a dirty tree. Every increment here runs on a dirty tree by construction;
the question is whether it CHANGES during the run, not whether it differs
from HEAD.

TOUCHES:   `web/scripts/visual.mjs` if taken.

## PARK-16 - the Playwright webServer timeout went from 240 s to 600 s  [FW28, 2026-09-24]

**The question.** `pnpm test:e2e` and `pnpm test:visual` both start a server
with `node scripts/copy-fonts.mjs && next build && next start`, and Playwright
gives that 240 seconds to answer. During FW28's increment 6 it stopped being
enough: twice in the host suite and once inside the visual container.

**Measured, so the cause is not a guess.** The build SUCCEEDS - run by hand
with the same environment it exits 0 and prints the route table. It is slow.
The same evening, `pnpm install` inside the visual container took **24 m 54 s**,
and a `pnpm install` inside `docker build` had already needed
`--network-concurrency=4` because sixteen parallel registry fetches were each
taking 40-50 s. Docker Desktop's engine had also failed with a bus error under
disk pressure and needed a WSL restart and a 27,85 GB build-cache prune.

**The option taken: raise the tolerance to 600 s.** It weakens no assertion.
Every spec still runs; every baseline is still compared at zero tolerance
(R114). What changed is how long the harness waits for a server to EXIST
before giving up - a tolerance, not a threshold, and not a diff.

**The option NOT taken: let the visual container reuse a host build.** It
would be faster and it would cost R98, which says a baseline is valid only
from an ISOLATED build. The isolation is the reason a baseline means anything;
trading it for a few minutes is the wrong direction on the suite whose whole
job is to certify that nothing changed.

**The cost of being wrong.** A genuinely hung server now takes ten minutes to
report instead of four. That is the entire downside, and it is paid only when
something is already broken.

**To reverse:** one line in `web/playwright.config.ts`. If the machine and the
link recover, 240 s is the better number because a hung server reports sooner.

## PARK-17 - the threshold rail's tick labels collide at 200% text scale  [AN3, 2026-09-27]

**RULED (AN4 relay increment 0, 2026-09-27): FIXED, R271.** The tick and rate
labels are measured with `TextMeasurer` and the rail's VERTICAL stack is rebuilt
from the measured line box (`ThresholdRail.withTextScaledVertical`), so the rail
grows its own height to fit at any `fontScale` rather than capping the glyphs -
which would defeat the setting R16 serves, the option this entry recorded as NOT
taken. `railGeometry` (AC2's 33-case proof) is untouched: only the vertical
coordinates are rebuilt, every horizontal field is the pure function's. Proven
by the 200% emulator screenshot, not the geometry test (which passed before the
fix too).

**The question.** AN3 increment 6's AC3 instrument (a real device, not a
Paparazzi baseline) captured `dev/GalleryScreen.kt` at the emulator's default
`font_scale`, then at `2.0` (R16's Android clause). At 2.0 every rail state
showed its own caption's last line overlapping the rail's own inline percent
label, and the two tick labels ("40 %", "49,9 %") sit close enough to the
track and to each other that the enlarged glyphs touch it and, in one state,
each other.

**Measured, not assumed.** `design/rail/ThresholdRail.kt` draws its tick
labels with `drawText` onto a `Canvas` at X positions `RailGeometry.kt`
computes in dp, independent of `LocalDensity.current.fontScale`. The
SURROUNDING layout (`Spacing.space20` between a caption and its rail) is
also fixed dp. Compose's `sp`-sized canvas text DOES grow with `fontScale`;
the positions it is drawn at do not - so at 2x scale the same label occupies
roughly twice the width at the same anchor point, and collides with whatever
is next to it.

**The option taken: ship as observed, described in REPORT-AN3.txt, not
redesigned here.** This is a component-shape question (does a dense,
Canvas-drawn rail cap its own internal font scale the way a calendar cell
might; does it reflow the two labels vertically past some scale threshold;
does it grow the rail's own height to make room) with no existing brief in
DESIGN-SYSTEM.md to resolve it, and R156's boundary names exactly this shape
as parkable ("a component shape") while reserving "stops the task" for
permanent things (a slug, a migration) this is not.

**The option NOT taken: clamp `fontScale` inside `ThresholdRail` to 1.0 for
its own canvas text.** Tempting, and NOT taken, because it would silently
defeat the one setting (R16's Android clause) large-text users rely on for
exactly this content - the fix would read as solving the finding by hiding
it from the one instrument built to surface it.

**The cost of being wrong (i.e., of leaving this parked).** A user who has
set 200% system text - genuinely more likely among AN3's own audience than
average, given who needs a document this precise read aloud or magnified -
sees an illegible rail. Nothing else in the gallery showed this: ZoneBadge,
RateDisplay, MetricTile and the Formatters section all reflowed cleanly at
2x, described in the same report.

**To reverse:** a real fix to `ThresholdRail.kt`'s label placement, scoped
and tested on its own - AC2's own geometry proof (railGeometry, the 33-case
RailGeometryTest.kt) must not regress while this is addressed, which is
reason enough it is a task of its own rather than a same-session patch.

## PARK-18 - DayCell and DayKindLegend become illegible at 200% text scale  [AN3, 2026-09-27]

**RULED (AN4 relay increment 0, 2026-09-27): SPLIT, R271.** The two halves this
entry recorded together get different homes, as the entry itself anticipated.
The LEGEND half is FIXED here: `DayKindLegend` is now a `FlowRow`, so whole
entries wrap onto the next line instead of one character per line (the
`@ExperimentalLayoutApi` opt-in is authorised by the relay naming FlowRow; the
R261 tension is recorded in REPORT-AN4.txt). The DAY-CELL half is NOT this
task's: at high font scale the calendar renders as a LIST (one row per day -
date, kind in words, quality, provenance), which lands at **AN10** with the
calendar, where the font-scale threshold is measured on a device rather than
guessed. Recorded for AN10; not built here.

**The question.** The same AC3 instrument, same 2.0 `font_scale`, on
`design/DayCell.kt`'s five-cell row and `design/Legend.kt` immediately below
it (`dev/GalleryComponentSections.kt`'s `dayCellSection()`). Every cell's
date, kind letter and country dot overlap into an unreadable stack ("3" and
"S" fuse; "14" and "M" read as "M4"), and the legend's last entry ("A
Absence") wraps one character per line, cascading eight lines down the
right edge of the screen.

**Measured, not assumed.** `DayCell` is `Modifier.size(Spacing.space40)` -
a FIXED 40 dp box, by design (DESIGN-SYSTEM.md's calendar grid needs a
whole month of these on one screen at once, which a scale-with-font cell
could not do and still fit). The date (`FrontierType.caption`), the kind
letter (`FrontierType.micro`) and the dot all keep their assigned corner
inside that fixed box; at 2x scale the TEXT grows, the BOX does not, and
the four corners' content overlaps. `DayKindLegend` lays its four
kind-plus-word pairs in one `Row`, each wrapped in its own
`Row(Modifier.padding(end = Spacing.space12))` with no `FlowRow` and no
minimum width; at 2x scale the first three entries consume enough of the
available width that the fourth's `Text` is handed a near-zero remaining
width and wraps character-by-character, which is Compose's ordinary
behaviour for a `Text` with plenty of vertical room and almost none
horizontal.

**The option taken: ship as observed, described in REPORT-AN3.txt.** Same
reasoning as PARK-17, and the same R156 boundary ("a component shape"):
whether a calendar grid gets a distinct high-text-scale presentation (a
list instead of a grid; a cap on the SPECIFIC internal glyphs' own scale,
which Android supports via a locally-overridden `fontScale` and is a real,
legitimate accessibility pattern for dense grids elsewhere in the platform;
a taller cell above some scale threshold) is a product decision this task
was not asked to make and SPEC/DESIGN-SYSTEM.md do not yet answer.

**The option NOT taken: switch `DayKindLegend` to a `FlowRow` today.** This
one alone looks mechanical, and very nearly was fixed inline - but the two
findings share one root cause (fixed-dp layout meeting scaled-up text) and
a fix to the legend alone would leave the report describing one arm of the
same defect as closed and the other as open, which reads as more settled
than it is. Recorded together; whichever task takes PARK-17 should take
this alongside it.

**The cost of being wrong.** Worse than PARK-17's: not a collision but a
genuinely unreadable calendar and a legend that cannot be read at all past
its first three words, for exactly the users R16 exists to serve.

**To reverse:** a real fix to `DayCell.kt` and `Legend.kt`, scoped and
tested on its own, once the product question above is answered - not a
same-session patch.

## PARK-19 - `design/Tokens.kt` gained a `Breakpoints` token without asking first  [AN3, 2026-09-27]

**RULED (AN4 relay increment 0, 2026-09-27): RATIFIED, R272.** `Breakpoints` is
a fourth token category and stays in `design/Tokens.kt` as shipped; it is now
documented in DESIGN-SYSTEM.md section 1 ("ANDROID BREAKPOINTS"), closing the
SPEC 20 ask-first item this entry flagged. The precedent named in the ruling is
R68 (a breakpoint is a legitimate token) and R77 (a token whose value already
appears in a brief - here R127's 320 dp - needs no separate value ruling).

**The question.** AN3 increment 6's gallery needed a 320 dp width constant
(already used, as a bare literal, by AN3 increment 3's own
`ThresholdRailScreenshotTest.kt`) and `FencesTest.kt`'s no-raw-`.dp`-literal
fence - correctly extended to scan `dev/` this same increment - refused the
bare `320.dp`. The fix promoted it to `design/Tokens.kt` as
`Breakpoints.minSupportedWidth`. CLAUDE.md's SPEC 20 names "adding a token
outside DESIGN-SYSTEM.md" as an ASK-FIRST item, and this shipped without
one - found only in this task's own close-out, re-reading the increment
against SPEC 20 rather than assumed clean because the gate was green.

**Why it happened anyway.** Under R241 ("run the whole task, only
REPORT-AN3.txt committed and pushed ends the session") an ask-first item
with no reply available reads as exactly the ambiguity R156 exists for:
conservative, reversible, park it, continue - and a breakpoint constant
holding a value ALREADY live in a committed test file is about as
conservative as a new token gets. That is the justification for shipping
it, not a reason it should have skipped the flag.

**The option taken: the token exists, named for what it is (a viewport
width, explicitly distinguished in its own doc comment from the Radius/
Spacing scale), and this entry is the ask that should have preceded it.**

**The option NOT taken: a second `320.dp` literal duplicating the one
already in `ThresholdRailScreenshotTest.kt`**, which is the state the fence
was written to refuse, or an `@Suppress` on the fence, which would have
hidden a real duplication rather than resolved it.

**The cost of being wrong.** Low, and asymmetric: DESIGN-SYSTEM.md gains an
undocumented category by omission rather than by a wrong VALUE - 320 dp is
not in dispute, only whether a fourth token family belongs beside Radius,
Spacing and Elevation, or whether a breakpoint constant belongs somewhere
else entirely (a test-only fixture, since today's only two call sites are
a screenshot test and a dev-only gallery, with no production screen using
it yet).

**To reverse:** delete `Breakpoints` from `Tokens.kt`, inline `320.dp` back
into an `@Suppress`-annotated exemption list in `FencesTest.kt` (naming
`GalleryRailSection.kt` and `ThresholdRailScreenshotTest.kt` explicitly, so
the exemption cannot silently grow), or fold the constant into
`ThresholdRailScreenshotTest.kt`'s own file and have `dev/` depend on the
test source set - each is reversible without a migration.

## PARK-20 - uploading a PDF to compare its fingerprint, as an idea  [FW-VERIFY, 2026-10-06]

**The question.** The issuance record (R329) stores the SHA-256 of every
produced file. A natural next feature is a public form where somebody uploads a
PDF and the service recomputes its hash and says whether it matches the record
for that code - turning "this document is unaltered" from a claim the scanner
trusts into one a holder can check byte for byte.

**The option taken: not built, parked as an idea.** FW-VERIFY's OUT OF SCOPE
list names it explicitly ("Uploading a PDF to compare its fingerprint - park it
as an idea"). The verification page the task does build (R330) already confirms
what the server issued - the name, the figures, the period, the date, the
version - which answers the three risks the task exists to answer (an edited
PDF, a shared account, a name changed after the fact). The upload-and-compare
step is a strengthening, not a gap.

**What it would add, and what it would cost.** It catches the one case the
field-comparison does not: a PDF edited to keep the same figures but altered
elsewhere (a logo, a footnote, a different person's annex). Against that it adds
an upload endpoint - a new attack surface that accepts arbitrary files - plus
the question of what to do with the uploaded bytes (held? discarded? scanned?),
which is a privacy decision this task should not make unasked.

**To build later:** a POST route that accepts a file, streams it through
SHA-256 without storing it, looks the digest up against IssuanceRecord.sha256,
and reports match / no-match / unknown - with the same rate limit and neutral
answers the verification page already uses. Reversible: nothing shipped depends
on its absence.

## PARK-21 - on-call periods are not missions, and the product has no notion of them  [REG-APPLY, 2026-10-11]

QUESTION:  The accord amiable of 29 April 2026, clause 2 (now a verified row in
`docs/regulatory-sources.md`, source A), says on-call periods (astreinte) are
NOT temporary missions unless they give rise to an effective intervention of the
employee in their state of residence. The engine and the calculator have no
concept of an on-call period, so a frontalier with on-call time has no guidance
on whether any of it counts.

TAKEN:     Recorded, not built. The rule is now in the register (source A,
clause 2) and nothing in the product asserts or computes it. No engine change,
no new input, no copy stating a rule the product cannot apply. Reversible: a
future guide sentence (R146 case (a), the row now exists) or an on-call input
can be added without moving any slug or anchor.

NOT TAKEN: (a) An on-call input on the calculator - a UX and engine-adjacent
change beyond this task, which is copy/register only. (b) A guide sentence
stating the rule - deferrable now that the row exists, and a guide surface for
it is a separate editorial choice.

TOUCHES:   Later, a guide or a calculator field. The source row already exists
(source A, clause 2).

## PARK-22 - several employers each need their own tally, and there is one holder  [REG-APPLY, 2026-10-11]

QUESTION:  Source C (AFC Geneve, now a verified row) says that with several
employers you declare to the AFC *"le taux de teletravail correspondant aux
jours travailles pour votre entreprise uniquement"* - each employer's days
separately. The product models one holder with one set of days and has no
employer field, so a frontalier with two Swiss employers cannot keep two
tallies.

TAKEN:     Recorded, not built. The fact is in the register (source C). No
schema or engine change, and no copy promising a feature. Reversible: an
employer field is additive to the record model.

NOT TAKEN: Adding an employer dimension to the data model now - a Prisma schema
change, which is an ask-first item and well beyond a copy/register task.

TOUCHES:   Later, the record schema, the aggregation and the UI. The source row
already exists (source C).

## PARK-23 - a residence change mid-year needs two attestations, and the product has one period  [REG-APPLY, 2026-10-11]

QUESTION:  Source C says a change of residence during the year means *"deux
attestations-quittances au titre de l'annee : une concernant chaque periode de
residence."* The product has no concept of a mid-year residence change; a user
who moves has no guidance on splitting their year.

TAKEN:     Recorded, not built. The fact is in the register (source C). No
engine or schema change, no copy asserting the split. Reversible.

NOT TAKEN: Modelling split residence periods now - a dossier and aggregation
change beyond this task.

TOUCHES:   Later, the dossier and aggregation. The source row already exists
(source C).

## PARK-24 - the LAMal/URSSAF comparator, reopened on a new footing (reopens PARK-4)  [REG-APPLY, 2026-10-11]

QUESTION:  PARK-4 refused the LAMal/CMU comparator (R157 option 3) for two
reasons: the premium data could not be licensed (opendata.swiss returned 403 so
the reuse terms could not be read), and the irrevocable / three-month warning
had no verified row. Both premises have moved. The droit d'option facts are now
verified rows (D1-D10, CLEISS, corroborated by ameli this session), and the
Geneva LAMal premium table is located and dated (source D: ge.ch, document of
26.09.2025, franchise CHF 300 adult / CHF 0 child, year 2026).

TAKEN:     Still not built, but the new footing is recorded for a future pass.
Source D's premiums are NOT republished (R146): its reuse terms must be read
from ge.ch first, and the French side's URSSAF CMU figures must be
primary-verified before any row. The comparator stays `planned`. Reversible at
zero cost - nothing was built.

NOT TAKEN: (a) Republishing source D's premium figures now - R146 forbids it
until the reuse terms are read. (b) Computing the French side from the secondary
URSSAF figures seen this session (hellofrontalier, alptis, an Assemblee question)
- R146 forbids a row on secondary sources. (c) Treating PARK-4 as closed - the
blockers moved but are not gone, so PARK-4 stays and this reopens it rather than
superseding it.

TOUCHES:   As PARK-4's TOUCHES, plus: reading ge.ch's reuse terms for source D,
and primary-verifying URSSAF, before either side gets a row.

## PARKAN-1 - the OS App Link verification is not, and cannot be, tested here  [AN4, 2026-09-28]

QUESTION:  AC1/AC2 ask the callback to work end to end, but an Android App Link
opens the app only after the OS has VERIFIED the domain against
`https://monreleve.ch/.well-known/assetlinks.json` - and `monreleve.ch` does not
resolve (FW29 Checkpoint C). So "tap the link in the email, the app opens" cannot
be proven in this task, only the app's handling once the intent arrives.

TAKEN:     The two claims are stated SEPARATELY (relay's own instruction). The
app's HANDLING of the callback is proven by firing the intent directly at
`CallbackActivity` with `adb am start` - MALFORMED (foreign host, intent-security)
and MISMATCH (valid link for an unrequested account, login-CSRF) seen in this
increment; SIGNED and INVALID_LINK in increment 6's loop against `pnpm dev`. The
OS's verification is NOT claimed. The manifest carries `android:autoVerify="true"`
so verification happens the day the domain does, with no app change. Reversible:
nothing is faked, so nothing must be un-faked.

NOT TAKEN: Faking a resolving domain or a served `assetlinks.json`. That would be
a false claim that the App Link is verified - the exact overstatement this product
refuses, on the one path whose failure ("the link opens a browser sometimes") is
farthest from its cause.

TOUCHES:   nothing in the app. The intent-filter shape is the frozen contract
(R195) and is correct; only the world outside the repo is missing.

NEEDS:     (1) `monreleve.ch` resolving and serving `/.well-known/assetlinks.json`
with `package_name` `ch.monreleve.app` and the SHA-256 fingerprints - INCLUDING
Google's Play App Signing key if Play re-signs the upload (PARK4-2 /
docs/api-v1.md 4: a statement naming only the upload key verifies for nobody and
fails silently and intermittently). (2) FW22's assetlinks route configured - it
404s until `ANDROID_PACKAGE_NAME` and `ANDROID_SHA256_CERT_FINGERPRINTS` are set
(R205). Until both, the link opens a browser, not the app.

## PARKAN-2 - sign-out does not clear the local store  [AN5, 2026-09-28]

QUESTION:  AN5's Room store keys entries on `(dayDate, portion)` with NO `userId`
column, on a single-user-device assumption. Sign-out (AN4's SessionManager.signOut)
clears the tokens but NOT the Room database. On a shared device or an account
switch, one person's fiscal record would remain for the next.

TAKEN:     The single-user assumption, stated in EntryEntity's own header. AN5's
walkthrough is one user on one device, which the assumption covers.

NOT TAKEN: A `userId` column or a sign-out-clears-Room step, neither of which AN5's
increments call for. Building either now is speculative.

TOUCHES:   nothing yet. Adding `userId` later changes the schema and the unique key
- which is exactly the migration the exported schema and MigrationTestHelper harness
exist to make safe (R187). That is the point of shipping the harness at version 1.

NEEDS:     an operator decision on whether the device is ever multi-user / account-
switching. If yes: sign-out clears Room, and the schema gains `userId` via a proven
migration. If no: this stays closed.

## PARKAN-3 - offline record-then-edit coalesces to one CREATED event  [AN5, 2026-09-28]

QUESTION:  AC2 recorded a day then edited it while offline (HOME then CH, one
(dayDate,portion)). The queue coalesced them into a SINGLE pending mutation, so the
server wrote one row and one CREATED EntryEvent carrying CH - never a
CREATED(HOME)+MODIFIED(CH) pair. Verified in the container DB: 4 rows, 4 CREATED
events, count 1 per day, the edit's value won. Is a single CREATED event the
DESIRED product semantics, or should the intermediate offline value be recorded?

TAKEN:     Coalescing. It is correct queue behaviour - no lost edit (CH won), no
duplicate, one event per wire mutation - and it is what makes the offline queue
emit at most one mutation per day (the ordering evidence, docs/api-v1.md 6.4).

NOT TAKEN: Emitting both the record and the edit as two mutations. That would put
two mutations for one day in a batch, which the server refuses (the reserved
`conflict`, 409), and would reopen the out-of-order reversion 6.4 describes.

TOUCHES:   nothing to change. The EntryEvent trail records mutations that REACHED
the server, not keystrokes made offline; whether it SHOULD record the latter is the
question.

NEEDS:     an operator ruling on whether offline intermediate values must appear in
the trail. If yes, the model changes (a local append-only log beside the coalesced
state); if no, this stays closed.

## PARKAN-4 - a 400 marks the whole batch FAILED, not per-item  [AN5, 2026-09-28]

QUESTION:  When the server refuses a batch as a client defect (400/409/413),
SyncEngine marks the WHOLE batch FAILED rather than parsing `issues[]` to fail only
the offending item(s). Safe (a FAILED row leaves the queue, so it is never retried -
R198) and never reached in AC1-AC3 (the recorder builds valid payloads), but a
good row batched with a bad one is stranded until re-recorded.

TAKEN:     Whole-batch FAILED. It guarantees no infinite retry of a rejected
payload, which is the load-bearing property, and it is simple.

NOT TAKEN: Parsing `issues[]` (each path is `entries.<i>`) to FAIL only the named
items and leave the rest PENDING for the next batch. It is more code for a path the
client should never take, since it builds valid payloads.

TOUCHES:   SyncEngine.handleOk / markFailed only.

NEEDS:     an operator decision on whether per-item recovery is wanted. Until then,
a 400 is loud (a visible FAILED state) and terminal, which the relay asked for.

---

Note on numbering: parking.md's persisted PARKAN sequence ends at PARKAN-4;
AN5b and AN5c referenced PARKAN-16/17/18 in their reports (16 and 17 opened and
closed in-session by R285/R286; 18 recorded in REPORT-AN5c.txt) but did not
append them here. Rather than reuse those numbers, AN10 numbers after the highest
referenced (PARKAN-18), leaving the gap visible. The AN5c persistence gap is
NOTICED BUT NOT TOUCHING for AN10 (C4).

## PARKAN-19 - the calendar ships no cantonal holidays table  [AN10, 2026-09-29]

QUESTION:  SPEC 11.3 and FD6 style cantonal holidays as display-only (no quality
bar, never "missing"), from a bundled dated table; todo.md's AN10 verification asks
for a GE/VD holiday table spot-checked against an official list, with the file
header citing it. Sourcing an official cantonal holiday list unattended, and
shipping it inside the APK, risks publishing a wrong holiday as fact.

TAKEN:     No holidays table. A public holiday that is a past weekday with no entry
reads honestly as « Non renseigné » (it genuinely is not recorded); a person who was
off records it as « Absence - jour ferie », which shows « A ». Reversible: adding
assets/holidays.json later needs no migration, no published correction, no release
that undoes anything - the calendar simply stops marking those days missing. Claims
less (no unsourced holiday assertion in the shipped app).

NOT TAKEN: Bundling a GE/VD holidays.json now. It would suppress the « missing » bar
on holidays, but a wrong or unsourced date is a false claim inside the APK, which the
boundary forbids parking past.

TOUCHES:   a new assets/holidays.json (sourced + header-cited), CalendarModel's
quality mapping (a holiday weekday -> NONE, not MISSING), the month summary's
non-renseigne count, and the calendrierMonth baseline. No wire or schema change.

NEEDS:     an official GE and VD holiday list for the tax year, and the operator's
sign-off on the source, before the table can ship (Checkpoint-A-style).

## PARKAN-20 - the mixed half-day cell shows the morning kind  [AN10, 2026-09-29]

QUESTION:  With HALF_DAY granularity a day can hold an AM row and a PM row of
different kinds and different sync states, but one grid cell shows one letter, one
bar and one corner mark. SPEC and FD6 are silent on how to collapse two half-days
into one cell.

TAKEN:     The cell shows the MORNING portion's kind (deterministic by portion
order) and the LEAST-settled quality (PENDING over LATE over ON_TIME); the edit
sheet always shows both portions in full, so no truth is lost - the cell is a
summary, the sheet is the record. Reversible: it is a pure-function display choice
(CalendarModel.cellOf), no migration, no contract.

NOT TAKEN: A split cell (two half-height bars, or two letters). More cell geometry
for an opt-in granularity most users will not choose, and it fights the 40 dp cell
at any text scale.

TOUCHES:   CalendarModel.cellOf and its test; the calendrier baselines if a mixed
half-day is added to a fixture.

NEEDS:     an operator preference on whether a half-day pair should render split in
the cell rather than summarised.

## PARKAN-21 - the bottom nav uses core Material icons, not lucide  [AN10, 2026-09-29]

QUESTION:  FD6 draws the bottom navigation with lucide `sun` (Aujourd'hui) and
`calendar` (Calendrier); the Compose Material CORE icon set (bundled with material3,
no new dependency) has `DateRange` but no `sun`, and the lucide/material-extended
sets are separate dependencies. Adding a runtime dependency unattended is an
ask-first boundary item.

TAKEN:     Core icons stand in by role - Home for Aujourd'hui, DateRange for
Calendrier - exactly the ZoneBadge precedent (core CheckCircle/Warning/Clear stand
in for lucide glyphs). No new dependency. Reversible: swapping to lucide/extended
later is an icon-reference change, no contract, no migration.

NOT TAKEN: Adding androidx material-icons-extended (or a lucide port) for the exact
glyphs. It is a runtime dependency this night does not add blind, and it matters
more when AN11's `file-text` (Releve) lands, since core has no file glyph either.

TOUCHES:   ui/shell/AppBottomBar.kt (the two icon references); AN11/AN12 when they
add their nav items and may need the extended set for `file-text`/`settings`.

NEEDS:     an operator decision on adding an icon dependency, ideally when AN11's
Releve tab forces the `file-text` question.

---

## THE NUMBERING, AND WHY THERE IS A GAP  [appended 2026-09-29]

Two series share this file, and three Android sessions used them
inconsistently. None of the numbers below is changed, because reports
cite every one of them (R162's rule: the thing that is cited keeps its
name).

| Series | Holds | Runs |
|---|---|---|
| `PARK-<n>` | web and deployment decisions | 1–19 |
| `PARKAN-<n>` | Android decisions | 1–4, 16–21 |

**PARK-17, PARK-18 and PARK-19 are Android entries filed in the web
series by AN3.** They keep those numbers because REPORT-AN3.txt cites
them. They are closed — see the ledger at the end of this file.

**PARKAN-5 to PARKAN-15 were never assigned.** That is a gap in the
numbering, not a set of missing entries. Nothing cites them.

**PARKAN-16, 17 and 18 were cited in REPORT-AN5b.txt and REPORT-AN5c.txt
but never written here.** A report that cites an entry this file does not
contain cannot be followed up, so they are backfilled below under the
numbers the reports use.

**From now on:** Android decisions are `PARKAN-<n>` only, starting at
**PARKAN-24**. Web and deployment decisions continue at **PARK-20**.

**What would have caught this — R294.** A test that scans every
`REPORT-*.txt` for `PARK-<n>` and `PARKAN-<n>` and fails if any cited id
has no entry in this file. The reports and the register describe the
same thing from two sides, and nothing checked the space between them
(R175). The scope is derived from the reports on disk, never listed.

## PARKAN-16 - the 56 dp primary button  [AN5b, 2026-09-28 — backfilled 2026-09-29]

QUESTION:  SPEC 11.2 specifies 56 dp large buttons; 56 was not in the
spacing token set, and adding a sizing token was an ask-first item.

TAKEN:     The record buttons used the 48 dp touch-target token, which
meets the Android minimum, pending a sizing-token decision.

STATUS:    CLOSED by R285 — 56 dp added as a port of R62's size family,
cited to SPEC 11.2. Implemented in AN5c increment 3 per its prompt;
confirm against REPORT-AN5c.txt.

## PARKAN-17 - the offline banner  [AN5b, 2026-09-28 — backfilled 2026-09-29]

QUESTION:  SPEC 11.2 mentions an offline banner, and no connectivity
source was wired.

TAKEN:     Offline was represented by the persistent pending line, which
is what being offline produces: unsynced rows.

STATUS:    CLOSED by R286 — no offline banner, because the app is
offline-first and a network banner worries people about something that
does not affect their record. The pending line instead escalates as the
oldest unsynced day nears the late threshold, which comes from one value
shared with the server. Implemented in AN5c increments 2–3 per its
prompt; confirm against REPORT-AN5c.txt.

## PARKAN-18 - the escalation look-ahead window  [AN5c, 2026-09-28 — transcribed for AN10b 2026-09-29]

Transcribed for AN10b (R294) from REPORT-AN5c.txt's PARKED section, verbatim
where the report states it. The source report defines it as:

QUESTION:  R286 says the pending line escalates "before" the threshold is
crossed but does not set how far ahead APPROACHING begins.

TAKEN:     two days (WARN_WINDOW_DAYS = 2L in AujourdhuiController) -- a small
look-ahead that warns before the crossing without alarming early, the
conservative choice (claims less). Reversible: a client-only warning constant,
no migration, no contract.

NOT TAKEN: a wider window (more warning, more noise).

NEEDS:     an operator preference on how many days' warning is wanted.

## PARKAN-22 - SUPERSEDES PARKAN-20: a split half-day must show as split  [ruling R292, 2026-09-29]

PARKAN-20 showed a half-day pair as the morning's kind. **That is
reversed.** A cell must never show less than the record: a day that was
Suisse in the morning and Domicile in the afternoon, shown as Suisse,
misstates the day. The exact visual form is a design choice, but the cell
must show that the day was split, and TalkBack must read both halves.

TOUCHES:   DayCell, CalendarModel's cell mapping, the calendrier baselines
(regenerated with this reason, R135).

## PARKAN-23 - SUPERSEDES PARKAN-21: Lucide icons, imported as vector drawables  [ruling R293, 2026-09-29]

PARKAN-21 used core Material icons in the bottom navigation. **That is
reversed, without adding a dependency.** Lucide's SVGs are ISC-licensed:
the handful the app needs — `sun`, `calendar`, `file-text`, `settings` —
are converted to Android vector drawables and committed, so there is no
runtime dependency (R136) and the design system's icon set is honoured.
Their ISC attribution goes on AN12's licences screen, beside the polygon's
ODbL.

TOUCHES:   ui/shell/AppBottomBar.kt, a new drawable per icon, ZoneBadge's
stand-in glyphs if Lucide equivalents exist, AN12's licences screen.

## PARKAN-24 - the split half-day cell's exact form  [AN10b, 2026-09-29]

QUESTION:  PARKAN-22 / R292 require a split half-day to show as split with TalkBack
naming both halves, but leave the exact visual form a design choice. Several small
choices had to be made without the operator: the same-kind pair, the lone half, the
dot, the bar.

TAKEN:     A split renders only when the day's two half-day portions have DIFFERENT
kinds: the cell then shows BOTH letters at the bottom-left (morning then afternoon),
keeps ONE country dot (the morning kind's) and ONE quality bar (the least-settled
portion - the AN10 collapse PARKAN-22 did NOT reverse). A same-kind pair keeps one
letter (already accurate, not "less"); a lone half (only AM or only PM) shows its one
kind, unchanged - outside the ruling. TalkBack reads « matin <kind>, apres-midi
<kind> », and the 200 % list names both kind words. Reversible: a pure display choice
(CalendarModel.cellOf + DayCell), no migration, no contract.

NOT TAKEN: splitting the dot or the bar too (two dots, two half-bars); rendering a
split on ANY two half-rows including same-kind (visual noise for no gained truth); a
distinct split glyph. Each is a same-file change to cellOf / DayCell.

TOUCHES:   CalendarModel.cellOf, DayCell (KindMarkers), DayCellCopy, CalendarList,
and the dayCellSplit / calendrierMonth / calendrierListLarge baselines.

NEEDS:     an operator preference on whether a same-kind pair or a lone half should
also render differently, and whether the dot or bar should split too.

## PARKAN-25 - only a 400 is isolated item by item; 409 and 413 stay whole-batch  [AN10b, 2026-09-29]

QUESTION:  R296 says a 400 batch is retried item by item, once. PARKAN-4 had grouped
400 / 409 / 413 as client defects that failed the whole batch. R296 names only the
400; what of 409 and 413?

TAKEN:     Only a 400 isolates. A 409 (conflict) and a 413 (payload too large) stay
whole-batch FAILED, unchanged. Isolating a 409 would re-send each conflicting mutation
on its own and replay the out-of-order hazard docs/api-v1.md 6.4 guards against; a 413
is unreachable under the batch and note caps the parity test pins. This is the
conservative reading of R296 (which names the 400). Reversible: SyncEngine.handleOk /
isolate only, no contract, no migration.

NOT TAKEN: isolating 409 / 413 too. It would need a per-item conflict story for 409
and gains nothing for 413 while the caps hold.

TOUCHES:   SyncEngine.handleOk / isolate and SyncEngineTest.

NEEDS:     an operator decision if per-item recovery is ever wanted for 409 / 413.

## PARKAN-26 - the releve shows only the current tax year; no year selector  [AN11, 2026-09-29]

QUESTION:  FD7 section 1 draws a year-selector chip (a pill « 2027 » with a chevron) beside
the title, so a person could open a past year's releve. GET /api/v1/dossier already accepts
?year= and refuses a future_year (docs section 8.3). Should the app ship the year selector, or
show only the current tax year?

TAKEN:     Only the current tax year is shown - taxYear is Year.now(Europe/Paris) in the
composition root, and the releve fetches that one year. No selector chip. This is the
conservative option: the releve is always the in-progress current year (which is why the
provisional banner is unconditional), and the product never advertises a view it has not built
(R282/R85). Reversible: a client-only addition - a chip that calls the existing dossierFetch(year)
seam with a chosen year - needing no migration, no contract change, no published anchor.

NOT TAKEN: the FD7 year selector. It would need a year-picker component, a rule for which years
are offered (activity start .. current, never a future year), and the empty-record and offline
states re-checked per year. A pure UI addition when it is wanted.

TOUCHES:   ui/screens/releve/ReleveHeader.kt (the title row), MainActivity/MainGraph (a chosen
year instead of the fixed taxYear), ReleveController (refetch on year change), and new baselines.

NEEDS:     an operator decision on whether past-year viewing is wanted, and if so which years the
selector offers.

## PARKAN-27 - sign-out shows a confirmation naming the unsynced loss  [AN12, 2026-09-29]

QUESTION:  R295 makes sign-out wipe Room, destroying days recorded but not yet synced - they never reached
the server and cannot be recovered. The AN12 prompt rules on the DELETE confirmation (R289) but is silent on
a sign-out warning. Should sign-out warn before it wipes?

TAKEN:     Sign-out shows a confirmation naming how many recorded days are unsynced, in words, before it
wipes Room - R289's rationale extended to sign-out. Conservative and reversible: a silent wipe of unsynced
days contradicts the product's core claim (an audit-defensible record), and the warning claims nothing that
could be wrong and can be removed in one edit.

NOT TAKEN: a silent sign-out. It loses unsynced days with no notice - the exact loss R289's confirmation
exists to prevent, one action over.

TOUCHES:   ParametresController.requestSignOut/confirmSignOut, SignOutPrompt, ui SignOutDialog,
ParametresCopy.unsyncedWarning, ParametresAccountTest.

NEEDS:     operator confirmation that the sign-out warning is wanted, or a ruling to drop it.

## PARKAN-28 - sign-out keeps the calculation settings  [AN12, 2026-09-29]

QUESTION:  R295 enumerates what sign-out clears - Room entries, the mutation queue, the cached releve, the
tokens - but NOT the calculation settings. Should sign-out also clear the settings so an account switch on a
shared device cannot inherit them?

TAKEN:     Sign-out KEEPS the settings. R295's enumeration does not include them, and keeping them lets a
re-sign-in land on a computable Aujourd'hui without re-onboarding (increment 5's walkthrough does exactly
this). Deletion DOES clear them (a first-run state). Reversible: adding settingsStore.clear() to
clearForSignOut is one line, no migration.

NOT TAKEN: clearing settings on sign-out too - a cleaner account switch, but it diverges from R295's
enumeration and from the prompt's "sign in again, record a day" narrative, and forces re-onboarding.

TOUCHES:   DeviceLocalStore.clearForSignOut (add settingsStore.clear()), LocalStoreTest's "settings kept"
assertion, MainActivity's start destination after re-auth.

NEEDS:     an operator decision on whether the device is ever multi-user / account-switching - the reopened
half of PARKAN-2.

## PARKAN-29 - the licences screen is hand-authored, not a generated inventory  [AN12, 2026-09-29]

QUESTION:  The licences screen credits the bundled polygon (ODbL) and the open-source components. A complete
per-library licence inventory is normally produced by a plugin. Should the app ship one?

TAKEN:     A hand-authored screen - the ODbL block (from the recorded source) plus the major components
(Jetpack Compose, AndroidX including Room and WorkManager, Kotlin, kotlinx.coroutines) under Apache 2.0. An
OSS-licences plugin (play-services-oss-licenses / licensee) is a new runtime/build dependency, which is R156
stop-boundary territory. Reversible: adding a plugin later regenerates a complete list without touching the
ODbL block.

NOT TAKEN: a generated inventory. It adds a dependency and a build step for a completeness the manual product
does not yet need.

TOUCHES:   LicencesCopy, LicencesScreen, app/build.gradle.kts (if a plugin is added).

NEEDS:     an operator decision on whether an exhaustive generated licence list is required for the Play
release (AN14).

## PARKAN-30 - openLegal is unguarded against a missing browser  [AN12, 2026-09-29]

QUESTION:  The A propos legal rows call startActivity(ACTION_VIEW http...) with no try/catch. On a device
with no http handler this throws ActivityNotFoundException and crashes the app. The walkthrough's emulator
image HAD a browser, so it opened /confidentialite cleanly and did not throw - the crash did not manifest.

TAKEN:     Left unguarded for now, and parked. The crash is an edge case (essentially every real Android
device has a browser), the walkthrough proved the happy path, and a guard needs a toast + copy + an
UNREACHABLE census entry for a case that did not occur. Conservative: adding scope late for a non-manifesting
edge is the change to defer, not rush.

NOT TAKEN: a try/catch around startActivity showing a toast ("aucun navigateur installe"). It is the correct
robustness fix and small, but it expands the copy surface for an unreachable path.

TOUCHES:   MainActivity.openLegal, a new toast string in ParametresCopy, CopyReachabilityTest UNREACHABLE.

NEEDS:     an operator decision (or a follow-up, naturally AN14's Play-release hardening) on guarding the
legal-link intent.

## PARKAN-31 - the TRUE release build has never been exercised E2E against a real server  [AN-AUDIT, 2026-09-30]

QUESTION:  AC1 asks for the release variant driven to a screen that decodes a server response. The shipping
release build cannot be driven as-is: it is unsigned (no release key, R250), denies cleartext, and points at
https://monreleve.ch, which does not resolve. So what actually exercises the release CODE, and what would
exercise the shipping ARTIFACT end to end?

TAKEN:     Exercised the release CONFIGURATION via a committed `audit` build type (build.gradle.kts): release
build type inheriting minify-off/non-debuggable/proguard-files via initWith, overriding only the debug
signature and a cleartext-to-10.0.2.2 local API URL, and reusing src/debug (injection + seeder). Drove it
against the local container: GET /api/v1/me decoded, the MAIN shell rendered ("Bonjour Camille", the recorder,
the Releve/Calendrier tabs), onboarding routed on a canton-null account, the sign-out dialog rendered. Because
isMinifyEnabled=false (the AN14 deferral), the release bytecode EQUALS debug's - proven by class names present
unobfuscated in the release dex (calc/EntryEntity/SyncEngine/detection) and no mapping.txt - so the audit
drive exercises the same code the release ships. The TRUE release APK (unsigned) was ALSO built (7.01 MB,
under the 12 MB budget), debug-signed as a copy, installed and launched: it renders the Connexion screen with
no crash. Reversible: the audit variant is committed TEST TOOLING (like the seeder); deleting it changes
nothing that ships, and the release guards (checkReleaseCleartext/checkReleaseNoDebugInjection) read the
release variant and stay green - the audit variant does not weaken them.

NOT TAKEN: driving the TRUE release APK end to end against a real server over HTTPS via the real magic-link ->
App Link callback. Impossible at Checkpoint F: no release signing key (R250), monreleve.ch does not resolve,
no assetlinks.json fingerprints (PARKAN-1), and R8 is off so there is no minified/obfuscated build to test at
all. The classic R8 failure modes (a renamed serialised field, a stripped reflective lookup, a shrunk Room or
Compose class) cannot be checked until minification is turned on.

TOUCHES:   app/build.gradle.kts (the audit build type; release when AN14 sets isMinifyEnabled=true +
proguard-rules.pro), src/release/res/xml/network_security_config.xml, the App Link callback and assetlinks.

NEEDS:     from AN14 and the operator: (1) R8 enabled - isMinifyEnabled=true with real keep rules for the
serialised /v1 payloads, Room entities, the engine and Compose; (2) a resolving monreleve.ch serving
/.well-known/assetlinks.json with the release key's fingerprints (PARKAN-1); (3) the release signing key.
Then re-run this drive against the TRUE release APK signed with the release key, over HTTPS, through the real
magic-link -> App Link callback, and read the R8 mapping for anything kept that should not have been.

## PARKAN-32 - where the location permission lives until detection ships  [AN-FIX, 2026-10-01]

QUESTION:  R304 removes ACCESS_FINE_LOCATION from the RELEASE build and says it "moves to the build AN6b's
testers install". That field-test build does not exist yet - AN6 defines its mechanism, distribution and
signing (todo.md AN6 stage 2: the manual-mode build distributed to 20-30 frontaliers for two weeks with
detection running silently). So where does the permission live NOW, so the release has none but the
detection-capable builds keep it?

TAKEN:     ACCESS_FINE_LOCATION moved to src/debug/AndroidManifest.xml. The debug and audit variants merge
that fragment (the audit variant already reuses src/debug), so they keep the permission; the release variant
does not include src/debug, so the BUILT release APK declares no location permission (proven from the APK by
checkReleaseNoLocationPermission with aapt2, AC2). The detection code and the bundled border polygon STAY in
src/main (dormant, R304). Reversible: it is one <uses-permission> line in a source set; when AN6 defines the
field-test build it relocates there with the data-safety-form entry, changing nothing that the release ships.

NOT TAKEN: creating a dedicated `measurement`/`fieldTest` build type now (initWith release for real HTTPS,
its own manifest carrying the permission, its own signing). That is AN6's call - it owns the mechanism and the
distribution - and a new build type adds signing and gate surface this task does not need. Switching to it
later costs a build type and a source set, no change to the release or to the F4 work.

TOUCHES:   android/app/src/main/AndroidManifest.xml (permission removed), src/debug/AndroidManifest.xml
(permission added), app/build.gradle.kts (checkReleaseNoLocationPermission, wired into :app:gate).

NEEDS:     from AN6 and the operator: the field-test build's definition (build type, server, signing), and the
Play data-safety-form entry declaring location as accessed-on-device / not-collected / not-transmitted, to be
added the task detection ships - not before, so the manifest never claims a feature the build does not expose.

## PARKAN-33 - compileSdk stays 35 while targetSdk is 36  [AN14a, 2026-10-01]

QUESTION:  Google Play requires new apps and app updates to target API 36 (Android 16) - verified from
Google's own page (developer.android.com/google/play/requirements/target-sdk, fetched 2026-10-01, effective
2026-08-31), and the AN14a prompt directs setting targetSdk. AGP normally wants compileSdk >= targetSdk, so
targetSdk 36 would pull compileSdk to 36 - but paparazzi 1.3.5 cannot render API 36 (its layoutlib cannot
match API 36 - cashapp/paparazzi#1877), which reds verifyPaparazziDebug. So what compileSdk ships with
targetSdk 36 without a dependency upgrade mid-task?

TAKEN:     targetSdk 36 + compileSdk 35 - the documented workaround. It builds clean on AGP 8.10.1 (no error,
no warning), keeps paparazzi 1.3.5 green, and the BUILT release APK declares targetSdkVersion 36 (verified by
aapt2 dump badging). targetSdk 36 is what Play enforces at upload; compileSdk is the SDK surface compiled
against, and this app uses no API-36 symbol. Reversible until the first upload (AN14b): it is two numbers in
build.gradle.kts.

NOT TAKEN: compileSdk 36 with a paparazzi UPGRADE (to a version whose layoutlib supports API 36) plus a
visual-baseline regeneration (R135/R207). That is a dependency change (R156/"Ask first") and a change to the
visual record, out of AN14a's scope, and risky to do without the emulator to re-verify behaviour. Also not
taken: keeping targetSdk 35, which Play would reject at upload. Switching to the compileSdk-36 path later costs
the paparazzi version bump in libs.versions.toml and a reason-stated baseline regeneration - no change to the
app's code.

TOUCHES:   android/app/build.gradle.kts (compileSdk, targetSdk), android/gradle/libs.versions.toml (the
paparazzi version, when upgraded), and the paparazzi snapshot baselines (regenerated when compileSdk moves to 36).

NEEDS:     AN14b to upgrade paparazzi to a version with an API-36 layoutlib, set compileSdk 36 to align with
targetSdk 36 (Google's recommended compileSdk == targetSdk), and regenerate the baselines with a stated reason -
before or at the first Play upload. The API 35 -> 36 runtime behaviour changes are OWED an emulator pass
(RAM-blocked this session; edge-to-edge was already handled from AN1's targetSdk 35).

## PARKAN-34 - the app crashes on launch on API < 34 (LocalDate.ofInstant, no core-library desugaring)  [AN14a, 2026-10-02]

QUESTION:  minSdk is 26, but the app calls LocalDate.ofInstant(Instant, ZoneId) - a java.time method Android
added to the PLATFORM only at API 34 (Android 14). On any device below 34 the method does not exist, so the
first Compose composition that computes "today" throws NoSuchMethodError and the shell dies on launch. AN14a's
device drive found it on a PHYSICAL Galaxy S9 (SM-G960F, API 29): the MINIFIED audit build and the UNMINIFIED
debug build crash IDENTICALLY. How is it fixed, and why did every gate miss it?

EVIDENCE (AN14a increment 6, on-device 2026-10-02): launching MainActivity on the minified audit APK ->
"java.lang.NoSuchMethodError: No static method ofInstant(Ljava/time/Instant;Ljava/time/ZoneId;)Ljava/time/
LocalDate; in class Ljava/time/LocalDate; ... (declaration of 'java.time.LocalDate' appears in
/apex/com.android.runtime/javalib/core-oj.jar)" - the DEVICE's platform LocalDate, not an app-dex class, lacks
the method. The same launch on the UNMINIFIED debug APK on the same device throws the IDENTICAL error, which
PROVES it is NOT an R8/minification break (R8 does not rename or remove platform classes/methods). The only
call site is android/app/src/main/kotlin/ch/monreleve/app/data/local/CalendarDay.kt:31 (todayInParis); a source
scan of src/main found NO other API-34 java.time method (OffsetDateTime.now, Clock.systemDefaultZone, ChronoUnit,
YearMonth, Year, DayOfWeek, DateTimeFormatter.ofPattern are all API 26). R307's wire drive
(dev.WireDumpActivity) does NOT hit this path and PASSED on-device.

WHY EVERY GATE MISSED IT: the JVM unit tests and paparazzi run on the HOST JDK, where LocalDate.ofInstant exists
(Java 9+), so they never see the API-level gap; the :app:gate runs ktlint + detekt but NOT Android Lint, whose
NewApi check flags exactly "API-34 method, minSdk 26, no desugaring" at build time; and every prior on-device
drive ran on an API-34+ emulator, where the method exists natively. So the defect was invisible to the whole
pipeline until a real sub-34 device ran it.

NOT TAKEN (this session, deliberately): no production source was changed. AN14a increment 6 is a narrow
finalization ("not new scope"); the fix needs its own test-first mechanism (a source fence, an instrumented
sub-34 test, or Android Lint on the gate - all new discipline a finalization is not sanctioned to create), and
the general fix (desugaring) is an ask-first dependency (R156 / SPEC 20) in a session told not to ask. Reported,
not hidden; left for a dedicated task.

CANDIDATE FIXES (named, not applied): (a) the narrowest, behaviour-preserving call-site change -
LocalDate.ofInstant(clock.instant(), PARIS) is exactly clock.instant().atZone(PARIS).toLocalDate(), which uses
only API-26 methods - plus a source fence forbidding the API-34 java.time methods so the next one cannot ship;
OR (b) core-library desugaring (coreLibraryDesugaringEnabled = true + the desugar_jdk_libs dependency), which
backports the whole newer java.time surface and is the general fix - a dependency addition (ASK FIRST). EITHER
way, add Android Lint (lintDebug / the NewApi check) to :app:gate so the class is caught at build time, not on a
user's phone.

TOUCHES:   android/app/src/main/kotlin/ch/monreleve/app/data/local/CalendarDay.kt (the call site);
android/app/build.gradle.kts (compileOptions desugaring + the dependency, if (b); and a lint task on the gate);
a new fence test, if (a).

NEEDS:     an operator ruling on (a) vs (b) - a call-site fix + fence is a normal task; desugaring is ask-first -
and the lint-on-gate addition, before any build is shipped to a device below API 34. Until then the shipping
release crashes on launch for every user on API 26-33.

RESOLUTION (CLOSED):  DEVICE-LOOP took option (a) in commit 712fccd - the call site is now
clock.instant().atZone(PARIS).toLocalDate() (behaviourally equal; CalendarDayTest unchanged) plus
ApiLevelFenceTest (the curated JVM regression guard: RED on the live instance, GREEN after). AN-STATE increment
0 (R308, commit 51ab6a6) added the lint-on-gate half: Android Lint's NewApi check is now a permanent :app:gate
step (lintDebug, scoped to NewApi via lint{}), proven by planting LocalDate.ofInstant in src/main and watching
the gate red naming the file, then reverting. Both halves landed; no sub-34 boot crash of this class can ship.

## PARKAN-35 - the API-26 emulator state-matrix (S2) is owed  [AN-STATE, 2026-10-02]

QUESTION:  R310's DONE matrix asks the state-preservation matrix to run on the physical phone (S1) AND on an
API-26 emulator (S2, R309 - the oldest API the app claims). S1 ran fully on the physical Galaxy S9 (API 29).
S2 did not. What is left, and is it risky?

EVIDENCE (AN-STATE, 2026-10-02): at the attempt, free RAM was 1571 MB of 16195 MB (Android Studio open); the
API-26 emulator needs ~4 GB, so booting it would thrash - the prompt's explicit "do NOT do RAM heroics" case.
Beyond RAM, the SDK has no cmdline-tools (sdkmanager/avdmanager absent), no android-26 system image (only
android-36 and android-37.0 are installed), and no AVD. So S2 needs the operator to free RAM AND three downloads
plus an AVD create - not something to force at this RAM.

NOT TAKEN: no emulator was created or booted. Marked OWED rather than thrashing, per the prompt's stated
acceptable clean boundary (S1-on-the-phone + S2-owed). LOW RISK: the DEVICE-LOOP crash class is closed
(PARKAN-34) and R308 now fails :app:gate on any platform member used above minSdk 26, so a sub-34 boot crash
cannot ship; the physical phone is API 29 (also < 34) and passed S1 across all four triggers.

TOUCHES:   nothing in the repo - it is a device/SDK resource block. The resume recipe lives in
C:/Users/KAMXKAM/.claude/jobs/176996e5/tmp/an-state-handoff-1.txt (out of repo-root scope).

NEEDS:     the operator to close Android Studio (free >= 4 GB), install cmdline-tools + the android-26
google_apis image, create an AVD, then run StatePreservationInstrumentedTest + android/scripts/an-state-matrix.mjs
on the emulator. On success, tick S2 in REPORT-AN-STATE.txt.

## PARKAN-36 - a daily LOCAL notification for the proposal is a separate decision  [AN-AUTO, 2026-10-02]

QUESTION:  SPEC 13.3 describes the daily reminder as carrying the detected proposal (« Journee detectee :
Domicile. Confirmer ? ») with confirm/correct actions. Automatic detection now exists (opt-in, beta), so the
proposal could be surfaced in a daily LOCAL notification (no server, no FCM) in addition to the Aujourd'hui
card. Should it be, and when?

EVIDENCE: the AN-AUTO relay places this OUT OF SCOPE explicitly: "A daily LOCAL notification for the proposal:
a LOCAL notification needs no server, but it is a separate decision - park it with a PARKAN entry." The FCM
reminder (SPEC 13.3) is server-scheduled and belongs to the reminder feature, which this task did not build
(R282's reminder rows are still absent; ParametresR282Test still forbids « rappel »/« notification »). A local
notification is a distinct UX decision (a compliance tool that nags gets uninstalled, SPEC 13.3) and touches a
POST_NOTIFICATIONS runtime permission (API 33+), which is its own Play/UX consideration.

NOT TAKEN: no notification channel, no POST_NOTIFICATIONS permission, no local scheduler was added. The
proposal is surfaced only on Aujourd'hui (the owed incr-5 UI). Parked, not owed: this is a deliberate scope
decision by the relay, not an unfinished item.

TOUCHES:   nothing. If adopted later: a notification channel, POST_NOTIFICATIONS (API 33+), a WorkManager
end-of-window trigger reading the day's DetectionOutcome, and confirm/correct actions - with the no-nag rule.

NEEDS:     an operator decision on whether the beta surfaces a daily local notification at all, and its copy.

## PARKAN-37 - /confidentialite still says "cumul de minutes"  [AN-NEXT-2, 2026-10-04]

QUESTION:  the automatic-mode item in web/lib/fr/confidentialite.ts still reads « Seul un cumul de minutes par
journee est conserve » - the pre-R320 minutes model. Detection now keeps four discrete checks, not a minute
tally. When is this corrected?

EVIDENCE: AN-NEXT-2 (R325) corrected only the determination claim (the Wi-Fi/cell determination clause) and
left this verbatim rather than half-fixing an R320-era relic under an R325 task (NOTICED BUT NOT TOUCHING).

NOT TAKEN: no edit to the "cumul de minutes" wording. Out of R325's scope; left verbatim.

TOUCHES:   web/lib/fr/confidentialite.ts and the /confidentialite baseline; belongs with an R320 copy sweep
across the privacy surfaces (confidentialite, application, the disclosure).

NEEDS:     an R320 copy sweep that restates the detection model (four checks, no minutes) consistently.

## PARKAN-38 - "the privacy map" has no named artefact  [AN-NEXT-2, 2026-10-04]

QUESTION:  the AN-NEXT-2 task prompt named "the privacy map" as a third R325 surface, but no file, component or
doc in the repo carries that name (it appears only in relay/AN-NEXT-2.txt). Which surface was meant?

EVIDENCE: read conservatively as the PUBLIC map of what the app does with position - the /application « Ce que
l'application ne fera pas » refusals (web/lib/fr/application.ts) - and corrected there (over-disclosing beats
under-disclosing).

NOT TAKEN: no other surface was changed under this name.

TOUCHES:   web/lib/fr/application.ts (done); any other surface the operator may have meant.

NEEDS:     the operator to confirm the /application refusals was the intended third surface, or name another.

## PARKAN-39 - Aujourd'hui sections C/E/F need a controller projection, which is the stop-and-ask line  [AN-HOME, 2026-10-04]

QUESTION:  AN-HOME's sections C (« A traiter »: unrecorded past working days, days waiting to send, the R286
late warning), E (« Cette semaine »: Monday-Friday DayCells + legend, tap opens the calendar) and F (« Ce
mois »: recorded days by kind) each need data the Aujourd'hui UI does not have today - past-unrecorded days,
the week's cells, the month's counts - which only the AujourdhuiController can derive from the entries it
already loads (repository.observeAll). Surfacing them is a NON-UI change (the controller lives in aujourdhui/,
has behaviour tests), and the AN-HOME relay's hard-boundary proof is "no test outside the UI layer and its
baselines is modified; every existing behaviour test passes unchanged ... if a non-UI change is needed for the
design, STOP, record it, and ask an advisor whether it is truly presentation-only". Is a READ-ONLY controller
projection of already-held entries (no write, no sync, no schema, no engine, no detection, no /v1, no other
screen) "presentation-only" and therefore in-bounds, or does it cross the boundary?

EVIDENCE: the advisor was unreachable all session (orchestrator directive: it has stalled), so the decision
could not be taken with it. R156 fail-closed: everything that needs NO controller change (sections 1, A, B,
D - the operator's MAIN request included) was built, gated, pushed and driven on the phone; C/E/F were NOT
started, to avoid autonomously adding controller behaviour the relay says to ask about first.

NOT TAKEN: no controller field, no new AujourdhuiState data, no navigate-to-Calendrier lambda, no C/E/F UI.

TOUCHES (when ruled in-bounds): AujourdhuiController.emitState + AujourdhuiState (3 read-only projections),
a new JVM test file (NOT a change to AujourdhuiControllerTest - additive, keeps existing tests unchanged),
CalendarModel.kt (widen cellOf/qualityOf visibility or add a public wrapper - the reusable pure mappers are
there), AujourdhuiScreen.kt (3 sections), MainActivity.kt (one defaulted onNavigateToCalendrier = { tab =
AppTab.CALENDRIER } at the single call site), and the aujourdhui baselines. The full map is in REPORT-AN-HOME.txt.

NEEDS:     an advisor/operator ruling that a read-only Aujourd'hui-controller projection of already-held data
is presentation-only (the relay's section 2 says these sections use "data the app already holds"); then the
handoff in REPORT-AN-HOME.txt builds C/E/F and the branch merges.

RESOLVED (AN-HOME C/E/F, R328): the operator ruled it IS presentation - a read-only projection of entries the
app already holds, built from CalendarModel's EXISTING pure mappers, with no write (D16 intact), no engine, no
/v1, no schema and no detection change. Sections C (A traiter), E (Cette semaine) and F (Ce mois) were built
in AujourdhuiController.emitState as read-only projections; the ONE CONDITION (R328, FW12's defect) is met by
sourcing every count from CalendarModel.buildMonthView (one way of counting), proven by AujourdhuiSectionsTest
asserting the home's projections equal CalendarModel's own output. Every test outside ui/ passes UNCHANGED
(additive state fields + an additive MonthSummary.absent, both defaulted). Driven on the SM-G960F and merged to
main. The heading stays so the report's citation resolves (RegisterCoverageTest).

## PARKAN-40 - the stray left-edge line is the Samsung Edge-panel handle, not an app card border  [AN-CAL2, 2026-10-05]

QUESTION:  AN-CAL2 defect 3 - the operator's screenshot showed "a stray vertical line on the left edge beside
the counts: a card's border drawn partly off-screen", at the same position on Parametres too, hypothesised to
"live in the shared app frame". Is it an app defect to fix in the shared frame?

EVIDENCE: it is NOT an app element. Proven on the SM-G960F three ways: (a) the line sits at the IDENTICAL
content-independent position on Aujourd'hui, Calendrier AND Parametres - an app card would sit at a different
y on each screen; (b) a uiautomator dump of the app window has NO node with a left bound < 30 px in that band
(all app content is inside the 20 dp screen padding - the Explorer's source audit confirmed no shared bordered
card, no negative offset, no x<0 content); (c) the device has an active Samsung Edge panel - `settings get
system cocktail_bar_enabled_cocktails` = AppsEdgePanelProvider, and `edge_handler_position_percent` = 76.91441,
i.e. 0.769 x 2220 = 1707 px, exactly where the line's bottom sits. It is the Edge-panel HANDLE, a SystemUI
overlay drawn over every app at a user-configured position.

TAKEN (R156, advisor stalled): no app-code change - there is nothing in the app frame to fix; the app's shared
frame is correct. The finding is recorded; the overlay is the device's Edge panel. Moving the handle position
and restarting SystemUI were used only to diagnose (settings restored).

NOT TAKEN: inventing an app layout change that removes nothing (the hypothesised off-screen card does not
exist), or disabling the device's Edge panel from app code (impossible - it is a system overlay).

NEEDS: operator awareness that the screenshot artifact is the device's Samsung Edge panel; to get clean app
screenshots, disable the Edge panel in the device's own settings (Settings > Display > Edge panels). No app
change is owed. The heading stays so the report's citation resolves (RegisterCoverageTest).

## PARKAN-41 - the « Non renseigne » counts tile wraps to two lines; an abbreviation is an operator copy call  [AN-CAL2, 2026-10-05]

QUESTION:  AN-CAL2 defect 1 asked for five equal counts tiles with "labels short enough not to wrap at default
size". Four labels (Suisse, Domicile, Mission, Absence) are single words that fit; « Non renseigne » is 13
characters and cannot fit one line in a fifth of a 320-360 dp row at a legible size (measured on the S9 - it
wraps to two lines). Abbreviating it (« Non rens. », « Manquant », ...) is a COPY change, a product decision.

EVIDENCE: the operator's ACTUAL defect was "its number sits lower and further right than the others" - a
MISALIGNMENT. Fixed by reserving two label lines on every tile (minLines = maxLines = 2), so every number sits
at one baseline whatever the label's length; « Non renseigne » wraps cleanly to two centred lines with its
number aligned. Seen on the device (cal-01) and in the calendrierMonth baseline. The deeper goal (alignment)
is met; the literal remedy (a one-line label) is physically impossible for this word without a copy change.

TAKEN (R156, advisor stalled): keep the full accented « Non renseigne » (R155), reserve two lines so the
numbers align. The word is not abbreviated without authority (it has one home, CalendarCopy.NON_RENSEIGNE,
shared with the quality legend - R206; abbreviating would fork it).

NOT TAKEN: an abbreviated tile label (a new string, a second home for the concept, or a forked legend word).

NEEDS: an operator copy decision IF a one-line tile is wanted - a shorter word for this tile alone, which
would then be the tile's own copy. Reversible (SummaryTile label + CalendarCopy). The heading stays so the
report's citation resolves (RegisterCoverageTest).

## PARKAN-42 - the mockups' light brand-tint surface has no token  [AN-ONBOARD, 2026-10-06]

QUESTION: the approved onboarding mockups paint the small round icon badges (and the selected
choice-card fill) in #EAF0F7 — a very light tint of the brand Deep Alpine Blue. DESIGN-SYSTEM.md §1
has no "brand soft" token: the colour family is canvas / surface / text / border / brand (one solid)
/ the France & Switzerland soft pairs / the four status soft pairs. Adding a tenth surface colour is a
token addition, which SPEC §20 names an ask-first item.

TAKEN (R156, advisor stalled all session): render the tint as `LightColors.brand.copy(alpha = …)`
rather than inventing a hex or a token. The colour is DERIVED from the one brand token, so it moves
with it and introduces no new value to maintain; the alpha is a rendering modifier on a token, not a
second colour definition. The alpha literal lives at the component, the way an elevation or a divider
opacity would.

NOT TAKEN: a new `brandSoft` / `surfaceBrand` colour token (would need a value ruling and a place in
§1), and a raw #EAF0F7 (forbidden — tokens only).

NEEDS: an operator/design ruling IF a named brand-tint surface token is wanted (then every badge and
selected card references it and the alpha goes away). Reversible: it is one derived expression per use
site. The heading stays so the report's citation resolves (RegisterCoverageTest, R327).

CLOSED (R337, AN-ONBOARD-2): the named token is wanted. `LightColors.brandSoft` is now defined once in
design/Tokens.kt as `brand.copy(alpha = 0.08f)` - DERIVED from the one brand token, not a new hue (R9) -
and recorded in DESIGN-SYSTEM.md section 1. Every use site (the onboarding icon badge, the selected
choice card and the beta badge) references it; the open-coded alpha is gone. Fence 9 (FencesTest) fails
on `brand.copy(alpha=…)` anywhere but Tokens.kt - its first run caught the live BrandCircle instance
(R178), and a planted violation was verified to fire and reverted (R180). Pixel-neutral (brandSoft is the
same value BrandCircle was), so no baseline moved for R337.

## PARKAN-43 - AN-ONBOARD-2 device walkthrough deferred (phone disconnected)  [AN-ONBOARD-2, 2026-10-06]

QUESTION: AN-ONBOARD-2's prompt section 4 asks for an on-device walkthrough on the Galaxy S9 (API 29):
a fresh install through all eight onboarding steps; an account with no name asked only the name then
Aujourd'hui with a PDF that generates; an account with no granularity asked only that; a complete
account straight to Aujourd'hui; state kept across rotation and a background kill; default and 200 %.

TAKEN: DEFERRED. The S9 dropped off USB after a thermal event before the session and did not return, so
the physical-device drive could not run. Everything that does not need the device WAS done: the Paparazzi
baselines (per-screen, default + 200 %, incl. the new granularity screen) and the JVM suites that drive
the completeness, the plan, the subset run, the prefill and the granularity write end to end over fakes.

NOT TAKEN: faking or claiming the walkthrough (R334: a report states only what has happened).

TOUCHES: nothing in the tree - this is an on-device verification, not code. To run on reconnect: against
pnpm dev, the four flows above + rotation + background kill (R310) + 200 %.

NEEDS: the physical S9 reconnected (or an API-29 emulator with the state-preservation harness).

## PARKAN-44 - stripComments strips block comments before line comments (fence helper blind spot)  [AN-ONBOARD-2, 2026-10-06]

QUESTION: FencesTest.stripComments removes block comments (`/* ... */`) BEFORE line comments (`// ...`).
A `//` line that contains `/*` - e.g. OnboardingKit.kt's header "design/onboarding/*.dc.html" - is then
misread as the start of a block comment, and everything up to the next `*/` is deleted from the scanned
text. Any fenced pattern sitting in that swallowed span is invisible to every fence (all nine share this
helper).

TAKEN: left as-is for this task and RECORDED. It surfaced when R337's R180 plant, first placed at line 47
of OnboardingKit.kt (inside the swallowed span), produced a passing fence - a false negative R180's
"verify the plant landed where intended" caught (a node reproduction showed the plant absent from the
stripped text). The plant was re-placed after the last `*/`, fired RED, and was reverted. Fence 9 is
sound for every realistic placement (the live BrandCircle instance proved it, R178).

NOT TAKEN: reordering stripComments to strip line comments first (the fix). It changes the scan behaviour
of ALL nine fences, which is out of R337's scope and risks turning an unrelated fence red or green in the
same commit.

TOUCHES: android/app/src/test/.../fences/FencesTest.kt (the shared stripComments helper) and, potentially,
every fence's result. A follow-up task should reorder the two passes and re-run all fences.

NEEDS: a small dedicated task to reorder stripComments and confirm every fence stays correct.

## PARKAN-45 - the manual-mode evening notification's periodic trigger (a reminder-time scheduler)  [AN-NOTIF, 2026-10-06]

QUESTION: R339's evening notification now ASKS in manual mode (EveningNotice.Manual), but nothing FIRES it
automatically in manual mode. R323's only trigger is the auto-mode SamplingWorker post-window wake, which does
not run in manual mode, so a manual user would see the notification only via the debug trigger until a periodic
scheduler exists.

TAKEN (AN-NOTIF, R156, approved by the orchestrator): built the manual-mode CONTENT + DECISION + RECEIVER (all
gate-verified on the JVM) and PARKED the automatic manual-mode trigger. The auto-mode trigger
(SamplingWorker -> maybeNotifyEvening) is untouched and still fires the Proposed/NotSure notices.

NOT TAKEN: a WorkManager periodic job around a reminder time. It needs (a) a reminder-TIME setting, which does
not exist - SPEC 13.3 names reminderTime but Settings.kt ignores it, and there is no picker in
onboarding/Parametres; (b) the periodic enqueue/cancel wiring on the evening-notification opt-in and on mode
change; (c) on-device verification (the phone pass is separate, PARKAN-46).

TOUCHES: a new reminder-time setting (onboarding/Parametres + a store), a WorkManager periodic request, the
opt-in/mode-change wiring. maybeNotifyEvening already handles the Manual notice when called.

NEEDS: an operator decision on the reminder TIME (a fixed default - e.g. end of the working day - or a
user-chosen time), then a dedicated task to build and device-verify the scheduler.

## PARKAN-46 - the AN-NOTIF on-device walkthrough (section 5)  [AN-NOTIF, 2026-10-06]

QUESTION: the prompt's section 5 drives the notification on the S9 against the dev server - record from the
shade in manual and automatic modes, read the rows back from Room, airplane-mode sync, every state at default
and 200%. This session was CODE-ONLY (the operator runs a separate consolidated phone pass).

TAKEN: deferred to the operator's phone pass. The debug trigger (EveningNotifyActivity, debug-only, proven
absent from the release APK by checkReleaseNoDevComponent) runs the real maybeNotifyEvening path on demand. All
correctness is gate-verified on the JVM (EveningTapTest's section-3 cases, the decision, the lock-screen source
assertions).

NOT TAKEN: the on-device drive itself (no device work this session, by the operator's instruction).

TOUCHES: nothing in code - a device drive plus screenshots.

NEEDS: the phone pass to drive manual (En Suisse from the shade, read the row back: one entry, its own
clientMutationId, the account tag, provenance MANUAL; Autre... lands on today; record in-app first and see the
notification cancelled), automatic (Confirmer -> DETECTED_CONFIRMED; the other side -> DETECTED_CORRECTED +
detectedKind; a not-sure day), and airplane-mode (recorded, then synced later), each at default size and 200%.

## PARKAN-47 - the AN-NOTIF dumpsys lock-screen verification  [AN-NOTIF, 2026-10-06]

QUESTION: the prompt's section 3/5 asks that the lock-screen protections be confirmed on-device via
`adb shell dumpsys notification` - that the posted notification is VIS=PRIVATE with a publicVersion carrying NO
actions, and that each recording action carries the authentication-required flag (Android 12+/API 31+).

TAKEN: the CODE-side half is done (EveningNotifierLockScreenTest asserts, from EveningNotifier.kt: the public
version has no addAction and is VISIBILITY_PUBLIC; every recording action setAuthenticationRequired(true);
recording buttons are immutable broadcasts). The dumpsys half is deferred to the phone pass.

NOT TAKEN: the dumpsys drive. The S9 is API 29 (< 31), where setAuthenticationRequired is a no-op; the flag
matters on a 31+ device, so a meaningful dumpsys confirmation of the unlock gate needs a 31+ device.

TOUCHES: nothing in code - a device drive.

NEEDS: on a 31+ device, trigger the notification, `adb shell dumpsys notification`, and confirm VIS=PRIVATE +
publicVersion with no actions + the action authentication-required flag. PLUS the operator's two-line manual
check: set a PIN, confirm the lock screen shows only "Mon Releve / Une journee a enregistrer" with no buttons,
remove the PIN.

## PARKAN-48 - the employer's name is not stored, so the releve cannot print it  [SEED-RELEVE, 2026-10-06]

QUESTION: reading the releve against an accountant's list (SEED-RELEVE item 10), the document says it
is the person's OWN record (footer.declaration: « Document etabli sur la base des declarations de
l'utilisateur ... »), but it never names the EMPLOYER whose annual declaration is the authoritative
one. The employer's name is not a column on User (SPEC 8) - nothing in the data model holds it.

TAKEN (R156, no advisor this session by operator instruction; the SEED-RELEVE prompt explicitly directs
parking this): leave it out. The prompt's own words: "The employer's name, in particular, is not stored:
park it, do not add a field." The releve is a justificatif of the person's own days; the employer files
the official declaration separately, and this document does not claim to be that.

NOT TAKEN: adding an `employer` field to User + the onboarding/settings flow + the /v1 /me contract +
the releve header + the PDF + baselines. A schema change (SPEC 20 ask-first) for a field no engine
figure uses.

NEEDS: an operator decision on whether the releve should name the employer (and, if so, whether the
document should also state in words that the employer's annual declaration is the official one - item
10's second half is implicit today). Reversible: it is additive. The heading stays so the report's
citation resolves (RegisterCoverageTest, R327). (Renumbered from PARKAN-43 on the SEED-RELEVE rebase
onto main, where PARKAN-43 is AN-ONBOARD-2's device walkthrough.)

## PARKAN-49 - the releve does not print how many mission days were counted toward the rate  [SEED-RELEVE, 2026-10-06]

QUESTION: reading the releve against the accountant's list (SEED-RELEVE item 5), the document shows
mission days France and third-state SEPARATELY (the monthly table's Mission FR / Mission tiers columns,
and the annex's per-day Nature), and the total Missions tile. It does NOT show how many of them were
CREDITED against the ceiling (at most 10) - `creditedMissionDays`. On Camille's under-ceiling year all
seven count; on Alex's over-ceiling year the regime is lost and zero count - a fact an accountant reading
item 5 would want stated, not inferred.

TAKEN (R156, no advisor this session by operator instruction): leave it out this task.
`creditedMissionDays` is on the engine `TeleworkResult` (`result`), which the PDF route HAS but does not
render, and which is deliberately ABSENT from the /v1 wire (DOSSIER_RESPONSE_FIELDS omits `result` -
R206/SPEC 14), so the Android screen cannot show it at all. Surfacing it is not pure presentation of a
figure the payload already carries (the prompt's bar for adding) - the screen needs a new wire field.

NOT TAKEN: adding `creditedMissionDays` (and perhaps `regimeApplies`) as ADDITIVE /v1 fields (R217 permits
this under the SPEC 14 freeze), then rendering a "dont X imputees au plafond" line on the screen and the
PDF, with copy in lib/fr + fr/ and new baselines. A focused follow-up, not a seed-task change.

NEEDS: an operator decision on surfacing the mission-credit detail; and the same for item 3's standalone
telework-only rate (telework / jours ouvres), which IS derivable from the two tiles the payload carries
and so is pure presentation - addable without a new field if wanted. Reversible: both additive.
(Renumbered from PARKAN-44 on the SEED-RELEVE rebase onto main, where PARKAN-44 is AN-ONBOARD-2's
stripComments blind spot.)

## PARK4-2 - a Digital Asset Links statement listing only a debug/upload key verifies nothing for a Play install  [formalised by DOMAIN, 2026-10-06]

FORMALISED HERE because docs/domain-checklist.md (section 4) cites PARK4-2 and it
had no heading of its own - until now it was only cross-referenced (PARKAN-1's
NEEDS at line ~1056, docs/api-v1.md section 4, and the assetlinks route comment
"Parked as PARK4-2"). The id and its content are not new; the heading is.

CAVEAT: Google Play re-signs an uploaded app with its OWN app-signing key, so the
certificate that actually signs the installed APK is NOT the upload/release key and
is NOT the debug key. /.well-known/assetlinks.json must therefore list, in
ANDROID_SHA256_CERT_FINGERPRINTS:
  - the debug key, for sideloaded debug builds against this origin (its SHA-256 is
    in the checklist), AND at the Play release (AN14b):
  - the release UPLOAD key (what the AAB is signed with), AND
  - Google Play's APP-SIGNING key (Play Console -> App integrity -> App signing key
    certificate -> SHA-256).
A statement naming only one of these verifies for nobody who installs from Play,
and the symptom ("the link opens a browser sometimes") is as far from the cause as
a symptom gets (R205). The assetlinks route (app/.well-known/assetlinks.json) only
validates SHAPE - uppercase colon-separated SHA-256, a valid package name, never an
empty list; it cannot validate that the RIGHT keys were supplied, which is this
operator judgement.

NEEDS: at AN14b, append the release upload key and Play's app-signing key SHA-256 to
ANDROID_SHA256_CERT_FINGERPRINTS. Until then only sideloaded debug installs verify.

## PARKAN-50 - the Aujourd'hui greeting is hard-coded "Bonjour Camille"  [device-walkthroughs, 2026-10-11]

QUESTION: the Aujourd'hui header greets every signed-in account with the SAME name.
On the device-walkthroughs fresh-onboarding flow the holder name was set to
"Walkthrough" (confirmed: the DB row wt-fresh has name "Walkthrough", and the
onboarding "Tout est pret" summary showed "Titulaire: Walkthrough"), yet Aujourd'hui
greeted "Bonjour Camille". The cause is in the code, not the data.

TAKEN: RECORDED, not fixed (this is a verification pass - no product code change,
R334). Fr.kt line 12 is `const val GREETING = "Bonjour Camille"`, and
AujourdhuiScreen.kt line 127 renders it verbatim (`Text(text = Fr.GREETING, ...)`).
The greeting is a fixed placeholder that never read the holder name; every account
sees "Bonjour Camille". It escaped notice because the only account whose AUJOURD'HUI
was screenshotted previously (SEED-RELEVE) was Camille, for whom the hard-coded name
is coincidentally correct.

NOT TAKEN: wiring the greeting to the real holder name (from GET /api/v1/me's `name`,
which Aujourd'hui/the releve already read) and rendering "Bonjour <prenom>" - a small
UI change with a copy constant that must interpolate the name (R153/R181: name the
rule's INPUT, do not hard-code a value), its own JVM/Paparazzi coverage, and a
baseline regeneration. A focused follow-up, not a verification-pass change.

NEEDS: an operator decision on the greeting copy (does it use the first name only, or
the full holder name; and the empty-name fallback), then a dedicated task. Reversible:
additive to the copy + the Aujourd'hui state.

RESOLVED (fix-greeting, 2026-10-11, commit a99915a, pending merge to main): Fr.GREETING
is gone; `Fr.greeting(holderName: String?)` greets the holder's FIRST name (Settings.name,
the onboarding titulaire) and falls back to « Bonjour » alone for a not-yet-named account
(the AN-ONBOARD-2 partial case). AujourdhuiState carries `holderName`, set by the controller
from `settings?.name`, read by the Header - the name is interpolated DATA, never a hard-coded
person (R153/R181; Fence 4 keeps the literal in fr/). COPY DECISION (taken under R156, the
advisor stalled all session): FIRST name - the historical « Bonjour Camille » is the first
name of « Camille Martin », so the first name preserves that render; fallback « Bonjour »
alone. Test-first: GreetingTest RED (unresolved reference, 7 cases) -> GREEN; `:app:gate`
green incl. verifyPaparazziDebug; ZERO baselines regenerated (the screenshot host wires the
historical titulaire « Camille Martin » so the greeting render is byte-identical, R207).

## STATUS LEDGER  [appended 2026-09-29]

One line per Android-era entry, so the state of each is visible without
reading every section. Entries are not edited; this ledger is.

| Entry | State | By |
|---|---|---|
| PARK-17 — rail tick labels at 200 % | **closed** | R271, AN4 increment 0 |
| PARK-18 — DayCell and legend at 200 % | **closed** | R271 — legend in AN4, calendar list in AN10 |
| PARK-19 — Breakpoints token | **closed, ratified** | R272 |
| PARKAN-1 — OS App Link verification | **open** | needs the domain and fingerprints |
| PARKAN-2 — sign-out and the local store | **reversed** | R295: sign-out clears the local store; lands in AN12 |
| PARKAN-3 — offline record-then-edit coalesces | **closed, ratified** | R275 |
| PARKAN-4 — a 400 fails the whole batch | **amended, done** | R296: a multi-item 400 is isolated item by item, once - LANDED in AN10b increment 5, not AN11 (the AN10b prompt placed it there and is the task authority; this line's earlier "AN11 increment 0" was stale, R273) |
| PARKAN-16 — the 56 dp button | **closed** | R285 |
| PARKAN-17 — the offline banner | **closed** | R286 |
| PARKAN-18 — the escalation look-ahead window | **open, transcribed** | AN10b R294 from REPORT-AN5c.txt; 2-day window shipped (R286), awaits operator preference |
| PARKAN-19 — no cantonal holidays table | **closed, ratified** | SPEC 7.2: holidays are absorbed into the 240-day basis; no verified source exists, so R146 means it is not written |
| PARKAN-20 — split half-day shown as morning | **reversed** | PARKAN-22, R292 |
| PARKAN-21 — core Material icons | **reversed** | PARKAN-23, R293 |
| PARKAN-22 — split half-day shown as split | **done** | R292, AN10b increment 3 |
| PARKAN-23 — Lucide vector drawables | **done** | R293, AN10b increment 4 |
| PARKAN-24 — split cell's exact form | **open** | AN10b; conservative form shipped, awaits operator preference |
| PARKAN-25 — only 400 isolates (not 409/413) | **open** | AN10b; conservative reading of R296 |
| PARKAN-27 — sign-out warns of unsynced loss | **confirmed** | R297 (AN-AUDIT incr 0): the sign-out warning is wanted; kept |
| PARKAN-28 — sign-out keeps the settings | **reversed** | R297 (AN-AUDIT incr 0): sign-out clears the settings too; a re-sign-in restores them from GET /api/v1/me before the onboarding decision |
| PARKAN-29 — licences screen is hand-authored | **closed** | R298 (AN-AUDIT incr 0): the list stays hand-written; a gate check (checkLicences) derives the release runtime deps from the build and fails on any not attributed - no plugin, no dependency. First run found guava/annotations/jspecify bundled but uncredited (R178); added |
| PARKAN-30 — openLegal unguarded vs no browser | **closed** | R299 (AN-AUDIT incr 0): openLegal catches ActivityNotFoundException and shows the link's address (openLegalLink seam, LegalLinkTest); no crash on a browserless device |
| PARKAN-31 — TRUE release never exercised E2E | **open, FURTHER NARROWED** | AN-AUDIT incr 2 + AN14a + device-walkthroughs (2026-10-11, WT4). FIRST MINIFIED BUILD vs the REAL SERVER: `:app:assembleRelease` (R8 on, 33 MB mapping.txt, dex carries https://monreleve.ch as the sole API base + current AN-NOTIF code) was debug-signed and installed on the S9; it LAUNCHED with no crash, reached the Connexion EMAIL screen, and on "Recevoir mon lien" made a real request to https://monreleve.ch, getting a NAMED REFUSAL "Une erreur s'est produite. Reessayez." - the production DB is DOWN (curl confirms POST /api/v1/auth/magic-link and /api/v1/auth/code both 500 on a real payload), so sign-in fails at the request step and the CODE screen is not reached. Still owed (AN14b): the TRUE release signed with the RELEASE upload key + Play app-signing key vs a resolving /.well-known/assetlinks.json (PARK4-2), and the full magic-link -> App Link callback once the production DB is restored |
| PARKAN-34 — crashes on launch on API < 34 | **closed** | AN14a incr 6 found it (on-device): LocalDate.ofInstant (API 34+) at CalendarDay.kt:31 with no core-library desugaring threw NoSuchMethodError on launch on API 26-33; minified AND unminified crashed identically (NOT R8). CLOSED in two commits: DEVICE-LOOP 712fccd took the narrow call-site fix (clock.instant().atZone(PARIS).toLocalDate(), behaviourally equal, CalendarDayTest unchanged) + ApiLevelFenceTest (the curated JVM regression guard, RED on the live instance then GREEN). AN-STATE increment 0 (R308) closed the remaining recommendation - Android Lint's NewApi check is now a permanent :app:gate step (lintDebug, scoped to NewApi via lint{}), the exhaustive partner the fence cannot be. Verified end to end: a planted LocalDate.ofInstant in src/main reds the gate naming the file (R180), reverted |
| PARKAN-32 — where the location permission lives | **closed, REVERSED** | AN-AUTO (R316, reverses R304): detection ships (opt-in, beta), so ACCESS_FINE_LOCATION + ACCESS_BACKGROUND_LOCATION returned to src/main (every variant); src/debug no longer declares FINE. checkReleaseNoLocationPermission became checkReleaseLocationPermissions, asserting the built release APK declares EXACTLY {FINE, BACKGROUND} and nothing more (both directions, R196). The data-safety-form entry stays Case 1 local-only (exempt) while D18 holds; the Play background-location declaration + demo video are AN14b's (docs/play-background-location.md) |
| PARKAN-33 — compileSdk stays 35 while targetSdk is 36 | **open, NEEDS** | AN14a incr 5: Play requires new apps/updates to target API 36 (Google docs, fetched 2026-10-01, effective 2026-08-31), and the prompt directs setting it - done (the built release APK declares targetSdkVersion 36). compileSdk 36 would align them (Google's recommended compileSdk==targetSdk), but paparazzi 1.3.5 cannot render API 36 (cashapp/paparazzi#1877), so compileSdk 36 needs a paparazzi version upgrade + a visual-baseline regeneration (R135/R207) - a dependency change out of AN14a's scope. Conservative/reversible choice: targetSdk 36 + compileSdk 35, the documented workaround (built clean on AGP 8.10.1, no AGP error, paparazzi green). AN14b aligns compileSdk to 36 with the paparazzi upgrade before the first upload; reversible until then. The API 35->36 runtime behaviour changes are OWED an emulator pass (RAM-blocked) |
| PARKAN-35 — S2 API-26 emulator matrix owed | **open, OWED** | AN-STATE (R310/R309): the state-preservation matrix (S1) ran fully on the physical phone (SM-G960F, API 29); the API-26 emulator half (S2) is OWED. Blocked by 1571 MB free RAM (emulator needs ~4 GB - the prompt's "no RAM heroics" case), no cmdline-tools, no android-26 system image (only android-36/37 installed), no AVD. LOW RISK: the DEVICE-LOOP crash class is closed and R308 now runs NewApi lint in :app:gate, so no API>26 call can ship; the phone (also <34) passed S1. Resume recipe in C:/Users/KAMXKAM/.claude/jobs/176996e5/tmp/an-state-handoff-1.txt: free RAM, install cmdline-tools + system-images;android-26;google_apis;x86, create an AVD, then run the StatePreservationInstrumentedTest suite + the an-state-matrix.mjs triggers on it |
| PARKAN-36 — daily LOCAL notification for the proposal | **BUILT, pending operator veto** | AN-NEXT (R323): built to the rules - one LOCAL evening notification (no server/FCM), OPT-IN and OFF by default, separate from the detection toggle; at most one per working day after the day concludes, only if no entry yet, never on a non-working day, only in auto mode; lock screen shows only that a proposal waits (VISIBILITY_PRIVATE + public version), unlocked names the side; a not-sure day gets the same single notification; tapping opens Aujourd'hui, records nothing (D16). POST_NOTIFICATIONS asked only on enable (API 33+). Decision unit-tested (EveningNotificationDecisionTest, test-first), full path in :app:gate. The relay says the operator MAY VETO; built until then. Still needs the operator's ratification (and of the "requires auto mode" reading) |
| PARKAN-37 — /confidentialite still says "cumul de minutes" | **open, OUT OF SCOPE** | AN-NEXT-2 (R325, NOTICED BUT NOT TOUCHING): the automatic-mode item in web/lib/fr/confidentialite.ts still reads « Seul un cumul de minutes par journée est conservé » - the pre-R320 minutes model (detection now keeps four discrete checks, no minutes). R325 corrected only the determination claim (the Wi-Fi/cell clause) and left this verbatim rather than half-fixing an R320-era relic under an R325 task. Belongs with an R320 copy sweep across the privacy surfaces |
| PARKAN-38 — "the privacy map" has no named artefact | **open, interpreted** | AN-NEXT-2 (R325): the task prompt names "the privacy map" as a third R325 surface, but no file/component/doc in the repo carries that name (it appears only in relay/AN-NEXT-2.txt). Read conservatively as the PUBLIC map of what the app does with position - the /application « Ce que l'application ne fera pas » refusals (web/lib/fr/application.ts) - and corrected there (over-disclosing beats under-disclosing). If the operator meant another surface, name it |
| PARKAN-39 — Aujourd'hui sections C/E/F need a controller projection | **closed, RESOLVED** | AN-HOME C/E/F (R328): the operator ruled a READ-ONLY projection of already-held entries, built from CalendarModel's existing pure mappers, IS presentation (no write, no engine, no /v1, no schema, no detection). Built in AujourdhuiController; C/E/F shipped with the one-way-of-counting test (AujourdhuiSectionsTest) proving the home and the calendar count one way; every non-ui test passes unchanged; driven on the S9; merged to main. See the heading above + REPORT-AN-HOME.txt |
| PARKAN-40 — the stray left-edge line is the Samsung Edge panel, not an app card | **closed, finding** | AN-CAL2 defect 3: proven on the SM-G960F to be the SystemUI Edge-panel handle (same position on 3 screens; no app node at x<30 in that band; `cocktail_bar_enabled_cocktails`=AppsEdgePanelProvider, `edge_handler_position_percent`=76.9≈1707 px = the line). No app-code fix; to clear the screenshot artifact, disable the device's Edge panel. Awaits operator awareness |
| PARKAN-41 — « Non renseigne » counts tile wraps to two lines | **open, conservative** | AN-CAL2 defect 1: 13 chars cannot fit one line in a fifth of a 320-360 dp row at a legible size. Kept the full accented word (R155/R206) and reserved two label lines (minLines=2) so every number aligns - the operator's real defect (misalignment) is fixed. An abbreviated one-line tile label is an operator copy decision; reversible |
| PARKAN-42 — the mockups' light brand-tint surface has no token | **closed** | R337 (AN-ONBOARD-2): the named token is wanted. `LightColors.brandSoft` = `brand.copy(alpha=0.08f)`, defined once in Tokens.kt (DERIVED, not a new hue, R9), recorded in DESIGN-SYSTEM §1; every use site references it and Fence 9 forbids the open-coded form elsewhere (RED on the live BrandCircle instance, R178; planted + reverted, R180). Pixel-neutral - no baseline moved |
| PARKAN-43 — AN-ONBOARD-2 device walkthrough deferred | **closed, device-verified** | device-walkthroughs (2026-10-11, REPORT-WALKTHROUGHS.txt WT1): ran on the S9 (API 29). Fresh full 8 steps incl. the new granularity step 5; missing-name account asked ONLY the name (Etape 1 sur 1) then Aujourd'hui + a generating PDF (178 KB); complete account straight to Aujourd'hui; R310 state kept across rotation AND a background kill (am kill, pidof empty, restored to step 3 with name preserved); 200 % reflows. FINDINGS: the Aujourd'hui greeting is hard-coded "Bonjour Camille" (PARKAN-50); "missing only granularity/method/rate" is NOT reproducible on the real server (R196 constraints reject those rows - proven by 3 probes), so those completeness branches stay JVM-only |
| PARKAN-44 — stripComments strips block before line comments (fence helper blind spot) | **open, recorded** | AN-ONBOARD-2: FencesTest.stripComments removes `/* */` before `// `, so a `//` line containing `/*` (OnboardingKit.kt's "onboarding/*.dc.html") is misread as a block comment and the text to the next `*/` is dropped from the scan - all nine fences share it. Surfaced by R337's R180 plant landing in a swallowed span (a false-negative R180 caught). Fence 9 is sound for realistic placements (R178). Fix (deferred, out of R337's scope): strip line comments first, re-run all fences |
| PARKAN-45 — manual-mode evening notification periodic trigger | **open, approved** | AN-NOTIF (R339): the manual-mode notification's CONTENT + DECISION + RECEIVER are built and gate-verified, but its automatic firing in manual mode is parked - it needs a reminder-TIME setting (SPEC 13.3's reminderTime is unbuilt), a WorkManager periodic job, and device verification. The auto-mode trigger (SamplingWorker) is untouched. Needs the operator's reminder-time decision, then a scheduler task |
| PARKAN-46 — AN-NOTIF on-device walkthrough (section 5) | **largely closed, device-verified** | device-walkthroughs (2026-10-11, REPORT-WALKTHROUGHS.txt WT3): on the S9 (date moved to weekdays since today is Sunday, a non-working day): MANUAL mode end to end - notification (3 buttons) -> En Suisse with the app closed -> confirmation "Enregistre pour le 09.10.2026" -> row read back (clientMutationId a98429d2..., provenance MANUAL, account tag 6b42a805...); "Autre..." lands on today; record-in-app cancels the notification; AUTO NotSure notice; OFFLINE record + deferred sync (clientMutationId 10fd1223..., CH MANUAL synced on reconnect). REMAINING: the AUTO HIGH-proposal path (Confirmer->DETECTED_CONFIRMED, other side->DETECTED_CORRECTED) is NOT reproducible on-device (needs a seeded HIGH detection tally; no on-device sqlite; JVM-covered by EveningTapTest), and a dedicated 200% notification capture (OS-rendered chrome) |
| PARKAN-47 — AN-NOTIF dumpsys lock-screen verification | **done for API 29; 31+ flag + PIN check remain** | device-walkthroughs (2026-10-11, WT3): `adb shell dumpsys notification` on the posted notification confirmed id=1001, vis=PRIVATE, a SEPARATE publicVersion with vis=PUBLIC and NO actions (= "Mon Releve / Une journee a enregistrer."), the two recording buttons as immutable broadcasts + Autre/body as startActivity. The per-action setAuthenticationRequired is a NO-OP on API 29 so the S9 cannot show the unlock-gate flag in dumpsys - that needs a 31+ device (JVM-asserted meanwhile, EveningNotifierLockScreenTest). The operator's two-line manual PIN check is written in the report (NOT performed - no PIN set/cleared, R334 hard boundary). Minor: the channel's own mLockscreenVisibility read -1000/NO_OVERRIDE (pre-existing channel); the per-notification vis=PRIVATE governs and is set |
| PARKAN-50 — Aujourd'hui greeting hard-coded "Bonjour Camille" | **resolved, pending merge** | fix-greeting (2026-10-11, commit a99915a, REPORT-FIX-GREETING.txt): Fr.GREETING replaced by `Fr.greeting(holderName)` greeting the holder's FIRST name (Settings.name) with a « Bonjour » fallback for a not-yet-named account; AujourdhuiState.holderName wired controller->Header (R153/R181, Fence 4). Copy decision under R156 (advisor stalled): first name + « Bonjour » fallback. Test-first GreetingTest RED->GREEN (7 cases); `:app:gate` green incl. verifyPaparazziDebug; zero baselines regenerated (host wires « Camille Martin » -> byte-identical render, R207). Originally found by device-walkthroughs (2026-10-11): wt-fresh name "Walkthrough" in the DB but Aujourd'hui greeted "Camille" |

## THE LETTER SERIES, AND WHY IT IS BACK-FILLED HERE  [appended 2026-10-20, FW-PARK-IDS]

The register's citation check - `web/scripts/register-coverage.mjs`, run by
`gate:clone` and by `RegisterCoverageTest` - held the pattern
`/\bPARKAN?-\d+\b/g`. `PARKAN?` is the five letters `PARKA` followed by an
optional `N`, so what it actually matched was `PARKAN-<n>` and `PARKA-<n>`.
It never matched `PARK-<n>` and it never matched a LETTERED id. Thirty-nine
ids were being checked, every one of them `PARKAN-<n>`; the whole `PARK-<n>`
series and every `PARK-<letter><n>` were invisible to it.

Twenty-eight lettered ids were cited by reports on `main` with no entry here.
They are back-filled below, each naming the report that raised it and its
state as the record shows it - never a closure the record does not show
(R444). The text is DERIVED from the raising report rather than re-decided
here (R181): this section transcribes a register, it does not take decisions
for the tasks that wrote them.

HOW A BACK-FILLED ENTRY IS SHAPED. The four-field house format above
(QUESTION / TAKEN / NOT TAKEN / TOUCHES) is for an entry written by the task
that took the decision. A back-fill is not that, and pretending otherwise
would mean inventing a QUESTION nobody asked. So each carries:

    RAISED BY:  the report that wrote it, and every other report citing it.
    WHAT IT IS: the finding, derived from the raising report.
    STATE:      OPEN, or CLOSED with what closed it, or RECORDED DECISION
                for an entry whose raising report wrote it as a decision with
                its reason and left nothing owed.

WHERE THEY SIT. Appended-newest-last yields here to one thing the operator
asked for explicitly: a branch adding entries at the end of this file was
pushed and awaiting review while this section was written, so this block is
inserted ABOVE the KMP-2b entries rather than after them, where the two
additions would collide. Every entry carries its own date, so the chronology
is still readable.

THE LETTER SERIES HAS NO ALLOCATION AUTHORITY, AND IT HAS ALREADY COLLIDED
TWICE. `PARK-F1`, `PARK-F2` and `PARK-F3` were each used by TWO tasks for
different findings (FW-FOLLOWUP on 15.10.2026, FW-FUTURE-DAY on 19.10.2026);
`PARK-P1` and `PARK-P2` are FW-PRISMA-GENERATE's, and a branch awaiting
review uses the same two ids for different findings again. A colliding id is
R162's defect one register over: each report is internally consistent and the
citation resolves to the wrong decision. The collisions are recorded in the
entries themselves and parked as PARK-26; nothing is renamed here, because
renaming an id would edit reports this task has no licence to touch.


## PARK-A1 - the two library deprecations in app/ (LocalLifecycleOwner, Criteria)  [AN-ACCOUNT-TAG, 2026-10-20 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-AN-ACCOUNT-TAG.txt. Also cited by REPORT-AN-ANSWER-ICON.txt
and REPORT-KMP-2b.txt.

WHAT IT IS: Two deprecated APIs remain in `android/app/` - LocalLifecycleOwner
and Criteria. Both fixes are dependency moves (lifecycle-runtime-compose for
the first), which AN-ACCOUNT-TAG's boundary forbade. The raising report states
it as carried forward from KMP-UP's PARK-U2, so this id and PARK-U2 are ONE
finding recorded twice rather than two findings.

STATE:      OPEN. REPORT-KMP-2b.txt's PARKED list, the most recent citation,
records "PARK-U2 / PARK-A1 the two library deprecations in app/ ... Both are
dependency moves; unchanged in count and in text". KMP-UP's Q2 asks whether
they are worth their own small task; no report records an answer.


## PARK-A2 - R425's Log.e branch is unexercised by the unit tests  [AN-ACCOUNT-TAG, 2026-10-20 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-AN-ACCOUNT-TAG.txt. Also cited by REPORT-KMP-2b.txt.

WHAT IT IS: R425's canary throws under `check()` in debug because
BuildConfig.DEBUG is true there, so the release path - one logging line - is
never reached by a JVM unit test. Exercising it would need a release-variant
test for no additional guarantee. Recorded by its raising report so the
omission reads as a decision rather than an oversight.

STATE:      OPEN. AN-ACCOUNT-TAG's Q2 asks whether a release-variant test is
wanted; no report records an answer, and REPORT-KMP-2b.txt still lists it
among the entries open from earlier tasks.


## PARK-F1 - TWO FINDINGS SHARE THIS ID  [FW-FOLLOWUP 2026-10-15 and FW-FUTURE-DAY 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-FOLLOWUP.txt AND REPORT-FW-FUTURE-DAY.txt, for different
findings. Both are on `main`. See PARK-26 for the collision itself.

WHAT IT IS (a), FW-FOLLOWUP: the code screen's footer offers "Rien recu ?
Renvoyer un code". That control makes the same promise the two sentences
R376 corrected had just stopped making - once the per-address budget is spent
a resent code is refused on arrival. R376 named exactly two strings and this
is a third surface, so it was not touched; R267 says a finding that names a
second site is not closed until that site is checked.

WHAT IT IS (b), FW-FUTURE-DAY: the dossier route's `future_year`. One line
plus a test, the same class R410-R413 closed for the day route.

STATE (a): OPEN. FW-FOLLOWUP's Q1 asks for the ruling; no report answers it.
STATE (b): OPEN. FW-FUTURE-DAY's Q1 asks whether to fold it into another task;
no report answers it.


## PARK-F2 - TWO FINDINGS SHARE THIS ID  [FW-FOLLOWUP 2026-10-15 and FW-FUTURE-DAY 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-FOLLOWUP.txt AND REPORT-FW-FUTURE-DAY.txt, for different
findings. See PARK-26.

WHAT IT IS (a), FW-FOLLOWUP: a pointer, not a finding of its own - it carries
FW-REDIRECT's PARK-R1 forward, "out of scope here and still open".

WHAT IT IS (b), FW-FUTURE-DAY: the future-dated-rows question for production.
The query that answers it is written out in R413.

STATE (a): OPEN, as PARK-R1.
STATE (b): OPEN. No report records the query having been run against
production.


## PARK-F3 - TWO FINDINGS SHARE THIS ID  [FW-FOLLOWUP 2026-10-15 and FW-FUTURE-DAY 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-FOLLOWUP.txt AND REPORT-FW-FUTURE-DAY.txt, for different
findings. See PARK-26.

WHAT IT IS (a), FW-FOLLOWUP: NOTHING GUARDS THE .gitignore CLASS that task
fixed. A pattern that silently swallows new source files fails in the one
direction no test looks - the file is absent, so there is nothing to assert
about it. The guard would check that no path under a tracked source root is
ignored; it was not written there because it is a new mechanism rather than
one of that task's four items.

WHAT IT IS (b), FW-FUTURE-DAY: the "not after today" rule is enforced in the
route only, not in the database. R196 says an invariant SPEC states about the
data is enforced where the database can express it, so the rule survives a
writer that does not know it exists - and this product already has other
writers. A PostgreSQL CHECK constraint cannot express it, because "today" is
not immutable, so it would need a trigger.

STATE (a): OPEN. No report records the guard having been written.
STATE (b): OPEN. FW-FUTURE-DAY's Q2 asks whether a trigger is wanted; no
report answers it.


## PARK-G1 - gate:clone is unaffected by the clean-tree guard, by design  [FW-GATE-CLEAN, 2026-10-14 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-GATE-CLEAN.txt.

WHAT IT IS: `pnpm gate:clone` clones HEAD, so it never reads the working tree
and the clean-tree guard that task built does not apply to it. It already
prints the dirty paths when there are any. Its raising report recorded this
so the omission would read as a decision rather than as a gap.

STATE:      RECORDED DECISION. Its raising report states "No change needed".
No later report revisits it.


## PARK-I1 - the icon stroke width is 2, and DESIGN-SYSTEM says 1.75  [AN-ANSWER-ICON, 2026-10-20 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-AN-ANSWER-ICON.txt.

WHAT IT IS: DESIGN-SYSTEM section 1 and R430 both say "1.75 px stroke". All 23
drawables in `res/drawable` carry Lucide's published strokeWidth 2 on a
24-unit viewport, which renders 1.67 dp at the 20 dp icon size and 2 dp at
Material's 24 dp default. The five icons that task added MATCH THE OTHER 23 -
making five differ from eighteen would be a worse state than the discrepancy,
and changing all 23 is a design-system change the task was not asked for.

STATE:      OPEN. A design-system decision; no report records one.


## PARK-I2 - recordPaparazziDebug is not byte-idempotent for one baseline  [AN-ANSWER-ICON, 2026-10-20 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-AN-ANSWER-ICON.txt.

WHAT IT IS: `recordPaparazziDebug` re-encodes
`signin_SignInScreensScreenshotTest_codeWrong.png` to a different byte length
(68178 -> 64762) from a pixel-identical image, while `verifyPaparazziDebug`
passes on the committed one. Exactly one file of 119 behaves this way. The
re-encode was reverted there; the next session that records will meet it
again.

STATE:      OPEN. No report records a cause or a fix.


## PARK-I3 - dark mode for the answered card is not captured  [AN-ANSWER-ICON, 2026-10-20 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-AN-ANSWER-ICON.txt.

WHAT IT IS: R433 asked for a dark capture of the answered card. FrontierTheme
has no dark path at all, by DESIGN-SYSTEM section 2's own override, so there
is nothing to photograph. When dark ships, the answered card is one of the
first surfaces to capture.

STATE:      OPEN. AN-ANSWER-ICON's Q5 asks the operator about dark mode; no
report answers it.


## PARK-I4 - DESIGN-SYSTEM.md's ANDROID SIZES paragraph under-reports the Size object  [AN-ANSWER-ICON, 2026-10-20 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-AN-ANSWER-ICON.txt.

WHAT IT IS: that paragraph names `Size.buttonLarge` (R285) but not `Size.rule`
(added by AN-HOME) or `Size.icon` (added by AN-ANSWER-ICON). Both are PORTS of
values section 1 already states, so no value is unrecorded - but the paragraph
now under-reports what the Android `Size` object holds. Not edited there:
DESIGN-SYSTEM.md is a spec file and that task's boundaries were tight.

STATE:      OPEN. No report records the paragraph having been brought up to
date.


## PARK-I5 - the kind glyph does not grow with the font scale  [AN-ANSWER-ICON, 2026-10-20 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-AN-ANSWER-ICON.txt.

WHAT IT IS: at fontScale 2 the glyph stays at `Size.icon` (20 dp) while the
words double, so it reads small beside them - visible in
`aujourdhuiHalfDayCompleteLarge`. R430 names "the `icon` size token (20)", so
20 dp fixed is what was built. Scaling it with the font scale is a design
decision.

STATE:      OPEN. AN-ANSWER-ICON's Q4 asks it; no report answers it.


## PARK-K1 - the Kotlin 2.1 toolchain move  [KMP-2, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-2.txt. Also cited by REPORT-KMP-2b.txt.

WHAT IT IS: KMP-2 could not take the Kotlin toolchain past 2.0.21, and
everything else in that task sat behind the move.

STATE:      CLOSED by KMP-UP. REPORT-KMP-UP.txt records kotlin 2.0.21 ->
2.1.10 and ksp 2.0.21-1.0.28 -> 2.1.10-1.0.31 in force, with the migration
matrix re-run on the S9 on the new compiler. REPORT-KMP-2b.txt names it among
the entries "CLOSED BEFORE THIS SESSION RESUMED ... PARK-K1 (the Kotlin
toolchain, closed by KMP-UP)".


## PARK-K2 - R392's merge and cleanup scripting is still unscripted  [KMP-2, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-2.txt, inherited from KMP-1b. Also cited by
REPORT-KMP-2b.txt.

WHAT IT IS: R392 requires a merge/cleanup script that refuses - non-zero,
naming the reason - on a foreign session lock or a dirty tree, with a test for
each refusal. CLAUDE.md states the same thing as a standing PARKED item:
until it is scripted, the ownership rule "has the same standing as R334 did
before R349 gave it a directory: true, written down, and enforced by nobody".

STATE:      OPEN. REPORT-KMP-2b.txt lists it as "still unscripted".


## PARK-K3 - EntryAggregation.kt and the duplicate EntryKind/Portion enums  [KMP-2, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-2.txt. Also cited by REPORT-KMP-2b.txt.

WHAT IT IS: the collapse R394 defers - `EntryAggregation.kt` and the duplicate
`EntryKind` / `Portion` enums across modules. The mapping is listed under that
report's EACH MOVE section.

STATE:      OPEN. REPORT-KMP-2b.txt lists it among the entries open from
earlier tasks, unchanged by the database move.


## PARK-K4 - the KGP/AGP compatibility warning  [KMP-2, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-2.txt. Also cited by REPORT-KMP-UP.txt and
REPORT-KMP-2b.txt.

WHAT IT IS: "The applied Android Gradle Plugin version (8.10.1) is higher than
the maximum known to the Kotlin Gradle Plugin." KMP-2 recorded it because it
was ALREADY LIVE before any bump, so a later reader would not read it as
something the bump had caused.

STATE:      CLOSED by KMP-UP. REPORT-KMP-UP.txt measures it "present once on
2.0.21 and ABSENT on 2.1.10: KGP 2.1.10 knows about AGP 8.10.1", and states
"ONE THING KMP-2b INHERITS THAT IS NEW: PARK-K4 is closed."


## PARK-K5 - cmdline-tools are not installed  [KMP-2, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-2.txt, carried from the stop report's P3. Also cited by
REPORT-KMP-2b.txt.

WHAT IT IS: an operator click in Android Studio's SDK Manager. Not needed
while the S9 is attached, still worth having for unattended device work -
PARKAN-35's owed API-26 emulator pass names it among its blockers.

STATE:      OPEN. REPORT-KMP-2b.txt lists it as open.


## PARK-K6 - a back-dated entry never reached the server  [KMP-2, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-2.txt. Also cited by REPORT-KMP-UP.txt,
REPORT-AN-ACCOUNT-TAG.txt and REPORT-KMP-2b.txt.

WHAT IT IS: the 16 October morning was recorded on the device and visibly
selected in its sheet, and was NOT in the server database - checked again
after the drive ended, so a fact rather than "it had not synced yet when I
looked". It had roughly fifteen minutes with a reachable server while three
same-day entries each posted within seconds. Its raising report was explicit
that this was not a diagnosis.

STATE:      CLOSED 2026-10-20 by AN-ACCOUNT-TAG (REPORT-AN-ACCOUNT-TAG.txt,
merged as f319e0b). The back-dating was never the distinguishing feature: the
row was written in the same app session as a sign-in, and the repository held
the account as a string read once when the screen was built - by the screen
that also hosts sign-in, so the value it read was null. The row was tagged
UNOWNED and R303 then held it: never sent, never shown. REPORT-KMP-2.txt
carries the closure note, including what it rests on - the 16 October row
itself is gone, so the closure rests on the mechanism reproducing the symptom
exactly on the same phone and on the fixed build posting the same sequence on
the first attempt.


## PARK-K7 - the generated Prisma client goes stale silently  [KMP-2, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-2.txt. Also cited by REPORT-KMP-2b.txt.

WHAT IT IS: on a long-lived checkout the generated client falls behind a merge
and produces a 500 whose message names a Prisma model as `undefined` - which
reads like a schema or migration problem and is neither. `gate:clone` catches
it on any commit touching `web/`; nothing catches it for someone merely
RUNNING the dev server after a merge.

STATE:      OPEN, and NARROWED. FW-PRISMA-GENERATE gave `dev` and `test:db` a
`pnpm db:generate` step, which closes the two commands that cost KMP-2 roughly
twenty minutes; `build` was deliberately NOT given the same chain (PARK-P2).
REPORT-KMP-2b.txt, written after that merge, still lists PARK-K7 among the
entries open from earlier tasks, so it is recorded here as open rather than
closed (R444).


## PARK-P1 - the selector gap, handed to FW-SELECTOR-PACKAGE  [FW-PRISMA-GENERATE, 2026-10-18 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-PRISMA-GENERATE.txt.

THIS ID IS CONTESTED. A branch awaiting the operator's review uses `PARK-P1`
for a different finding of its own. See PARK-26.

WHAT IT IS: a commit that changed what `pnpm test:db` RUNS did not select
`test:db`, because `web/package.json` appeared zero times in
`scripts/gate-selection.mjs`. That task raised it as its own task rather than
widening its scope, with the two candidate shapes and the trap in the cleverer
one, and flagged `pnpm-lock.yaml` for the same question (R267).

STATE:      OPEN AS THE RECORD STANDS. The task it hands off to ran and is on
`main`: REPORT-FW-SELECTOR-PACKAGE.txt records `web/package.json` now mapping
to every suite, plus six more root configs classified. That report does NOT
name PARK-P1, so no report closes this id, and R444 forbids inventing the
closure. Whether the hand-off counts as the closure is the operator's call.

CONTEST RESOLVED, 2026-10-20. The operator ruled that the BRANCH's ids move,
not this one: AN-POLISH renamed its three entries to PARK-L1, PARK-L2 and
PARK-L3 before merging, so PARK-P1 is FW-PRISMA-GENERATE's alone. The "THIS ID
IS CONTESTED" note above records the state that produced PARK-26, not the state
today, and is left standing rather than rewritten - it is somebody else's entry
and the history is the point (R334).


## PARK-P2 - `build` was not given the db:generate chain, and that is a decision  [FW-PRISMA-GENERATE, 2026-10-18 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-PRISMA-GENERATE.txt.

THIS ID IS CONTESTED. A branch awaiting the operator's review uses `PARK-P2`
for a different finding of its own. See PARK-26.

WHAT IT IS: `dev` and `test:db` chain `pnpm db:generate`; `build` does not.
The image runs `pnpm install` - and therefore postinstall's generate - before
it builds, so `build` already has a fresh client by construction. Adding the
step would be a second mechanism for a guarantee that already holds, and the
one place it would matter (a local `pnpm build` after a merge) is covered by
`dev` being the command people run first.

STATE:      RECORDED DECISION. Its raising report wrote it "so the omission
reads as a decision rather than an oversight". No later report revisits it.

CONTEST RESOLVED, 2026-10-20. The operator ruled that the BRANCH's ids move,
not this one: AN-POLISH renamed its three entries to PARK-L1, PARK-L2 and
PARK-L3 before merging, so PARK-P2 is FW-PRISMA-GENERATE's alone. The "THIS ID
IS CONTESTED" note above records the state that produced PARK-26, not the state
today, and is left standing rather than rewritten - it is somebody else's entry
and the history is the point (R334).


## PARK-R1 - the PDF route builds an absolute URL from the request origin  [FW-REDIRECT, 2026-10-15 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-REDIRECT.txt. Also cited by REPORT-FW-FOLLOWUP.txt (as
its own PARK-F2).

WHAT IT IS: `app/api/v1/export/pdf/route.ts:170` builds an absolute URL from
the request origin for Chromium to navigate to. Safe today - loopback, same
container, never leaves it - and not fixable by R364's relative form, because
a navigation needs an absolute URL. It breaks if PDF rendering is ever moved
to its own container or behind a network hop. The durable answer is an
explicit loopback origin or a configured internal base, not the request's own
view of itself.

STATE:      OPEN. FW-REDIRECT's Q1 asks whether it is worth a follow-up now;
REPORT-FW-FOLLOWUP.txt records it as "still open".


## PARK-R2 - no e2e spec exercises the CONFIRMED or OK states against the image  [FW-REDIRECT, 2026-10-15 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-REDIRECT.txt.

WHAT IT IS: the e2e suite cannot seed a database, so no spec drives those
states against the built image. FW-REDIRECT covered them by the container run
and by the db tests instead. Giving the e2e suite credentials is a decision
with a wider blast radius than that task.

STATE:      OPEN. FW-REDIRECT's Q2 asks it; no report answers it.


## PARK-S1 - scripts/** is not mapped in the selector, and that is not a hole  [FW-SELECTOR-PACKAGE, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-SELECTOR-PACKAGE.txt.

WHAT IT IS: a change to `scripts/gate-selection.mjs` selects the base chain
only, and that task's own change was an instance. Its raising report argues it
is not a hole "and the reason is worth stating so nobody closes it twice": the
selector's correctness is asserted by 412 tests under `tests/unit/meta/`,
which run in `test` - which IS the base chain. The coverage is real; it
arrives by a different route. The entry names its own trigger: "if a script is
ever added that no unit test exercises, that is when this becomes a gap".

STATE:      RECORDED DECISION, with a stated trigger. FW-PARK-IDS changed
`scripts/register-coverage.mjs` and added
`tests/unit/meta/register-coverage.test.ts`, so the entry's condition holds
for that script too.


## PARK-S2 - pnpm-workspace.yaml and tsconfig.json were mapped to every suite on judgement  [FW-SELECTOR-PACKAGE, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-SELECTOR-PACKAGE.txt.

WHAT IT IS: R414-R416 named two files; that task mapped two more to
EVERY_SUITE on its own judgement, and flagged it here because it is judgement
rather than instruction.

STATE:      OPEN. FW-SELECTOR-PACKAGE's Q1 asks the operator to ratify or
narrow it; no report answers it.


## PARK-S3 - test:container:e2e is RED on main  [FW-SELECTOR-PACKAGE, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-FW-SELECTOR-PACKAGE.txt.

WHAT IT IS: `e2e/home.spec.ts:166` asserts the `/api/ready` database check
reports `ok: null` "when the process is not marked as serving" - true on the
host, false in the container, where it IS serving. One spec is run unchanged
in both contexts. Three mechanisms could have caught it and none was
exercising the suite: `gate:changed` could not select it until that commit,
`gate:clone` does not list it, and CI was skipping. THE FIX IS NOT A SELECTOR
QUESTION: either the spec learns which context it is in, or `/api/ready` is
asserted differently per context, and both are decisions about what readiness
MEANS - R353 to R355's territory.

STATE:      OPEN. No report records the suite green since.


## PARK-U1 - R407's screen-by-screen audit comparison  [KMP-UP, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-UP.txt. Also cited by REPORT-KMP-2b.txt.

WHAT IT IS: R407 asked for a screen-by-screen comparison on the AUDIT build -
sign in by code, record a day, sync, open the Releve and the forecast. KMP-UP
did a launch-and-render check instead and said so plainly.

STATE:      CLOSED by KMP-2b. REPORT-KMP-2b.txt carries a section headed
"PARK-U1 - CLOSED" and records a drive strictly larger than the one asked for,
across a database move rather than a compiler change.


## PARK-U2 - the two library deprecations in app/  [KMP-UP, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-UP.txt. Also cited by REPORT-AN-ACCOUNT-TAG.txt,
REPORT-AN-ANSWER-ICON.txt and REPORT-KMP-2b.txt.

WHAT IT IS: LocalLifecycleOwner and Criteria. Both fixes are dependency moves,
which KMP-UP's boundary forbade; unchanged in count and in text across the
compiler bump. This is the SAME finding as PARK-A1, recorded twice under two
ids by two tasks - cross-referenced rather than merged, because neither report
is wrong about itself.

STATE:      OPEN. KMP-UP's Q2 asks whether it is worth its own small task; no
report answers it, and REPORT-KMP-2b.txt still lists it as open.


## PARK-U3 - PARK-K6 sharpened: the entry is absent from the device too  [KMP-UP, 2026-10-19 - back-filled FW-PARK-IDS 2026-10-20]

RAISED BY:  REPORT-KMP-UP.txt. Also cited by REPORT-KMP-2.txt and
REPORT-KMP-2b.txt.

WHAT IT IS: PARK-K6's back-dated entry is absent from the DEVICE as well as
from the server. Observation, not diagnosis - and the sharpening was the
useful part, because "absent from the server" admits a sync explanation and
"absent from the device too" does not.

STATE:      CLOSED 2026-10-20 with PARK-K6, same cause: the row was tagged
UNOWNED at the write, so R303 held it - never sent, never shown, gone at the
next launch, which is precisely the device absence recorded here. See
REPORT-AN-ACCOUNT-TAG.txt; fixed in f319e0b. The closure note is written into
REPORT-KMP-UP.txt's own PARKED list.


## PARK-25 - an id with a word after its number is deliberately not matched  [FW-PARK-IDS, 2026-10-20]

QUESTION:  The census that produced the widened pattern found one id that does
not fit the series: `PARK-FW34-LAUNCH`, cited by REPORT-FW34.txt and
REPORT-FW34-PAGE.txt for a launch-news email list. The prompt's suggested
pattern `/\bPARK(?:AN)?-[A-Z]*\d+\b/g` matches `PARK-FW34` out of it - the
hyphen that follows is a word boundary - and would then report a cited id that
does not exist anywhere. The census also found six TASK-LOCAL series that are
registers of their own and not this one: PARK4-<n> (Phase4parking.md, already
excluded by the old pattern and still excluded), PARK5-<n>, PARK5b-<n>,
PARK26-<n>, PARK27-<n>, PARK30-<n> and PARK31-<n>.

TAKEN:     The pattern is `/\bPARK(?:AN)?-[A-Z]?\d+\b/g` - exactly ONE optional
letter, which is what every real lettered id in the census uses. That matches
the whole namespace this register owns and nothing else: `PARK-FW34-LAUNCH`
produces no match at all rather than a truncated one, and the task-local
series stay excluded. Reversible: the pattern is one line with a test beside
it naming every shape it must and must not match.

NOT TAKEN: Matching `PARK-FW34-LAUNCH` in full and back-filling an entry for
it. That would widen the pattern past the series this register numbers, and
the entry would be written from outside by a task that did not take the
decision. Also not taken: adopting the task-local series into this register -
seventy-odd entries written by other tasks, which is the opposite of what
R444's back-fill is for.

TOUCHES:   `web/scripts/register-coverage.mjs` (the CITATION constant and the
heading matcher), `web/tests/unit/meta/register-coverage.test.ts`, and - if
the decision reverses - `parking.md` for whatever entries the wider pattern
then demands.


## PARK-26 - the letter series has no allocation authority, and nothing forbids a duplicate heading  [FW-PARK-IDS, 2026-10-20]

QUESTION:  `PARK-<letter><n>` ids are allocated by each task for itself, with
nothing recording which letters are taken. Two collisions already exist.
`PARK-F1`, `PARK-F2` and `PARK-F3` are used by FW-FOLLOWUP and by
FW-FUTURE-DAY for six different findings; `PARK-P1` and `PARK-P2` are
FW-PRISMA-GENERATE's, and a branch awaiting the operator's review uses the
same two ids for findings of its own. The register's coverage check cannot see
either: it asks whether a heading EXISTS, so one heading satisfies two
unrelated citations, and two headings with the same id satisfy it just as
well.

TAKEN:     Recorded, not resolved. The colliding ids are back-filled as single
entries whose bodies carry BOTH findings, each with its raising report and its
own state, and each says that the id is shared. A reader following any of the
six citations lands somewhere real and is told immediately that the id is not
unique. Reversible: if the operator reallocates, the entries split and the
reports that cite them are edited by whoever owns them.

NOT TAKEN: Renaming one series, which is the fix R162 points at. It would mean
editing reports on `main` that this task has no licence to touch, and it would
change citations in a branch awaiting review. Also not taken: a guard failing
on a duplicate `## PARK-<id> -` heading. It is the right guard and it is the
wrong week - the pending branch will produce exactly that duplicate on merge,
so adding the guard now would red `main` at the moment of a merge the operator
has already approved. It wants its own task, after the operator has decided
which series moves.

TOUCHES:   `parking.md` (the five contested entries and this one), the reports
that cite them if an id is ever reallocated, and
`web/scripts/register-coverage.mjs` if the duplicate-heading guard is wanted.

RESOLVED IN PART, 2026-10-20. The operator decided which series moves:
AN-POLISH's. Its three entries are PARK-L1/L2/L3 as of that branch, so the
PARK-P collision this entry names is gone, and the duplicate-heading guard this
entry judged "the right guard and the wrong week" shipped with it and is green
on the merged tree. PARK-F1/F2/F3 are UNCHANGED and still shared - they are
duplicate CITATIONS, not duplicate headings, so SHARED_IDS is inert today and
is not a precedent for keeping a duplicate.

## PARK-27 - gate:clone sweeps leaked CLONES and not leaked DATABASES  [FW-PARK-IDS, 2026-10-20]

QUESTION:  R266 established that gate:clone's cleanup can fail - `process.exit()`
does not unwind to a pending `finally`, and on this machine three independently
tested kill mechanisms bypassed a correctly registered signal handler - and the
answer was a sweep: any leftover `monreleve-clone-*` temp DIRECTORY older than
four hours is removed at the start of the next run, with the count and the
reclaimed size reported. gate:clone also creates a scratch DATABASE, named
`monreleve_gate_clone_<sha8>`, and drops it in the same cleanup path. Nothing
sweeps that side. FW-PARK-IDS measured the consequence rather than predicting
it: checking that THIS task's scratch database had been dropped turned up
`monreleve_gate_clone_668c9b34`, left by an earlier run, beside the dev database.

TAKEN:     Recorded, not built, and explicitly NOT urgent. The leak costs disk
on one developer machine and nothing else: a scratch database is created from
empty, migrated by the run that owns it, and never read by anything but that
run. No product behaviour depends on its absence. The operator dropped the
strays by hand after confirming none was the dev or a configured test database
and that nothing was connected; the dev database `frontalier` is intact at 6
users and 16 entries. Reversible by construction - the entry describes a sweep
that has not been written.

NOT TAKEN: Writing the sweep inside this task. It is a change to the PUSH gate,
made from a task whose subject is a document register, and the shape it should
take is already decided by R266's directory sweep rather than needing invention
here: match the prefix, compare an age, report the count and the reclaimed size.
What it costs to do later is one function in `scripts/gate-clone.mjs` and a test
for each refusal.

A SWEEP MUST MATCH THE PREFIX, NEVER "SCRATCH-LOOKING". This is the part that
would be got wrong by anyone generalising from the three databases found:

    monreleve_gate_clone_668c9b34   a LEAK. gate:clone's own, orphaned.
    monreleve_an5b_live             not this session's; origin not established
                                    here, so not assumed.
    monreleve_fw30                  NOT A LEAK. It is a deliberate fixture,
                                    built by scripts/fw30-dataset.mjs, which is
                                    deterministic and recreates it exactly.

A sweep keyed on "anything that looks like a scratch database" would delete the
third, and the symptom - a dataset that silently rebuilds itself and is
therefore never noticed as missing - is exactly the kind that costs a day when
it finally matters. So: the `monreleve_gate_clone_` prefix, nothing wider, and
the four-hour floor R266 already argues for, because a still-running legitimate
gate:clone must never be mistaken for an abandoned one.

TOUCHES:   `web/scripts/gate-clone.mjs` (the sweep and its report line), a test
per refusal, and nothing else. No product code, no schema, no migration.

## PARK-B1 - CalendarDay.kt stays in :app, although R394 names it among what moves  [KMP-2b, 2026-10-20]

QUESTION:  R394's list of what moves to :shared includes CalendarDay. It is not
platform-free: it imports java.time.Clock, OffsetDateTime, ZoneId and
DateTimeFormatter, and the commonMain fence and the metadata compilation both
refuse those. Moving it means rewriting todayInParis and deviceClaimNow onto
kotlinx-datetime.

TAKEN:     Left in :app and recorded here. Nothing that DID move depends on it -
the entities, the DAOs and the database compile in commonMain without it - so
parking it costs the database move nothing.

NOT TAKEN: Rewriting it now. deviceClaimNow produces clientClaimedAt, a WIRE
value whose format is pinned by a fixed pattern
("yyyy-MM-dd'T'HH:mm:ss.SSSxxx") precisely because OffsetDateTime.toString()
and ISO_OFFSET_DATE_TIME both omit a zero seconds field, which the server's zod
.datetime({ offset: true }) then rejects. KMP-2's hard boundary is that the wire
bytes do not change, and todayInParis decides which DAY a record lands on. Both
are reachable with kotlinx-datetime, and neither is a change to make inside a
task whose subject is the database and whose evidence is an upgrade-in-place on
one phone. R156: conservative, reversible, parked.

COST OF REVERSING: one file, its tests, and a device check that the day boundary
and clientClaimedAt are unchanged - the shape KMP-0's R374 already ran once.


## PARK-B2 - EntryRepository and RhythmRepository stay in :app  [KMP-2b, 2026-10-20]

QUESTION:  R394 says the repositories move "IF they reach nothing beyond the
moved database and pure shared code; if one holds a store, the session or a clock
source from :app, separate it the KMP-0 way (R372) or leave it and PARK it".

TAKEN:     Both parked, decided from their imports rather than from preference.
  EntryRepository    android.util.Log, ch.monreleve.app.BuildConfig,
                     java.time.Clock, java.util.UUID. It holds a clock source AND
                     R425's BuildConfig canary (AN-ACCOUNT-TAG), which is an
                     :app-variant fact by construction.
  RhythmRepository   java.time.DayOfWeek - the same clock-adjacent dependency one
                     step smaller.

NOT TAKEN: Separating them the KMP-0 way now. R394 offers that or the park; the
park is the option that claims less in a task whose one irreversible artefact is
the database file. Doing it would also mean deciding where R425's canary lives,
which is AN-ACCOUNT-TAG's design and not this task's to move.

COST OF REVERSING: two files plus a seam for the clock and the canary. KMP-3
already owns the stores and the sync engine, so it is the natural place.


## PARK-B3 - :app keeps the KSP plugin and room-compiler with nothing to process  [KMP-2b, 2026-10-20]

QUESTION:  After the move :app declares no @Entity, no @Dao and no @Database, so
Room's compiler has nothing to do there. Its room.schemaLocation argument was
removed - it named a directory nothing writes any more, and a stale instruction
reads as a current one (R181) - but the plugin and the compiler dependency stay.

TAKEN:     Left in place. They cost a no-op task each and removing them is a
build change with no evidence behind it in a task whose gate is already proving
something else. Recorded so the next reader sees a decision rather than an
oversight.

NOT TAKEN: Removing `alias(libs.plugins.ksp)` and `ksp(libs.androidx.room.compiler)`
from :app. That is the tidy answer and it is also the one that, if it is wrong,
is wrong at the next person's expense rather than at this task's.

COST OF REVERSING: two lines and a gate run.

CLOSED BY AN-POLISH (R439), 2026-10-20. The operator answered KMP-2b Q2: remove
them. The evidence KMP-2b did not have is a comment-blind scan for Room
annotations over EVERY :app source set - ZERO - with the SAME scan over
shared/src finding 27, so the scanner works and the absence is real rather than
a scan pointed at nothing (R133/R154). Both lines are gone, the full :app:gate
ran --rerun-tasks on the removal and went from 229 actionable tasks to 225 -
the four KSP tasks, measured rather than predicted.


## PARK-B4 - MigrationSqlVerbatimTest stays in :app's JVM suite  [KMP-2b, 2026-10-20]

QUESTION:  KMP-2's Q2 asked whether the verbatim-SQL test should move to :shared
with the migrations. No operator answer is recorded.

TAKEN:     It stays in :app's JVM test source set while the MIGRATIONS live in
:shared - which is KMP-2's own reading, and the arrangement that makes the git
diff of migration-sql.txt the proof. The test needs java.lang.reflect.Proxy to
stand in for SQLiteStatement's twenty members, and commonTest cannot have it.

NOT TAKEN: Moving it and hand-writing the double. Twenty TODO() bodies against an
interface we do not own is the maintenance R206 warns about, and the fixture - the
thing that actually proves the SQL - is unaffected by where the test runs from.

COST OF REVERSING: the test file and a hand-written SQLiteStatement fake.


## PARK-L1 - dark mode is still after launch  [AN-POLISH, 2026-10-20]

The AN-POLISH series uses PARK-L<n>. It is the INTERNAL register's letter series
for this task, in the convention KMP-2b (PARK-B*) and AN-ANSWER-ICON (PARK-I*)
set; it is NOT the published `P<n>` register in web/lib/content/provisional.ts,
which R162 keeps in its own namespace. The `PARK-` prefix is what separates
them, and that distinction is stated here rather than left to be inferred.

QUESTION:  AN-ANSWER-ICON's Q5 and PARK-I3. R433 asked for a dark capture of the
answered card; FrontierTheme has no dark path at all, by DESIGN-SYSTEM section
2's own override ("light ships first"), so a night capture would photograph the
light theme and certify nothing. Is dark still "after launch", or does it get a
task?

TAKEN:     Still after launch. The operator answered Q5 explicitly - park it,
nothing built - and AN-POLISH built nothing for dark mode. The three surfaces
this task touched (the half-day card, the answer line's two glyph rows, the
sign-out dialogs) are all light-theme only, like every other surface.

NOT TAKEN: Opening a dark-mode task now, or adding a dark Paparazzi
configuration against a theme that has no dark path (which would produce
light-theme images under dark names - worse than no capture at all).

COST OF REVERSING: a dark colour set in Tokens.kt, a dark branch in
FrontierTheme, and a dark baseline per surface. When dark ships, the ANSWERED
CARD is one of the first to photograph: it now carries two tinted glyph rows
(kind in textPrimary, status in textSecondary or error), and those tints are
exactly what a dark palette has to re-decide.


## PARK-L2 - the status glyph centres against a wrapped status line  [AN-POLISH, 2026-10-20]

QUESTION:  R435 put a glyph beside the sync line, and R436 made it scale with
the font. Where the status WRAPS - "Enregistré sur le téléphone, en attente
d'envoi" takes two lines at default size and three at 200 % - the Row centres
the glyph vertically, so the clock sits beside the SECOND line rather than the
first. Should the answer line's glyph rows align to the TOP of their text
instead?

TAKEN:     Left centred. R435 and R436 are about the glyph's presence and its
size; alignment is a third decision, and changing it would move every
default-scale baseline the status row appears in - fifteen of them - for a
change neither ruling asked for. Visible in
aujourdhuiHalfDayCompleteLarge.png and in the device capture of the pending
state (both looked at, both legible).

NOT TAKEN: Alignment.Top on AnswerStatusLine's Row, and on AnswerKindLine's for
consistency. It reads better on a wrapped line and is a one-word change.

COST OF REVERSING: one argument, plus re-recording the baselines where the
status or the kind label wraps.


## PARK-L3 - no local server refusal is reachable from an unmodified client  [AN-POLISH, 2026-10-20]

QUESTION:  R441 asked for the sync glyph in each state on the device, including
"refused if a local server refusal can be produced without changing the server -
otherwise say so". Can one be?

TAKEN:     Say so. It cannot, and this is the measurement rather than an
assumption. The local server's refusals on /api/v1/entries are
coordinates_refused (D18 fences the client from ever sending a coordinate),
malformed_body / invalid_payload (the client builds the payload from typed
Kotlin), payload_too_large (the engine batches under the server's own limit) and
future_day. Only future_day is reachable in principle - and the DevRecorder's
"Jour suivant" CLAMPS at today, so the app cannot offer a future day either; and
even if it could, the refused row would be TOMORROW'S, while the glyph under
test renders on the Aujourd'hui card for TODAY.

The refused state is covered twice instead: AnswerStatusInstrumentedTest asserts
ic_triangle_alert ON THE DEVICE for a hosted failed state, and
aujourdhuiSyncFailed.png is its baseline. What is NOT claimed is a real server
refusal observed end to end on the phone.

NOT TAKEN: Changing the server, the client, or the device clock to manufacture
one. All three are forbidden by this task's boundaries, and the last would make
every recording fail by design rather than by refusal.

COST OF REVERSING: a debug-only "send a payload the server will refuse" seam, or
a server test fixture. Neither is this task's to add.

## PARK-D1 - LocalEntryRepository stays in :app, and the cost of moving it is measured

KMP-2b handed KMP-3 "PARK-B2, the two repositories ... the clock seam and R425's
BuildConfig canary are its call", and KMP-3's own R446 expected both to MOVE. The verdict
from the source is that LocalEntryRepository stays, with the price written down rather
than left as a shrug.

WHAT IT WOULD TAKE. Five platform touchpoints, each needing a seam: `android.util.Log`
(R425's release branch), `BuildConfig.DEBUG` (R425's debug `check`), `java.time.Clock`,
`java.util.UUID`, and `deviceClaimNow` - which lives in CalendarDay.kt and IS PARK-B1,
explicitly out of KMP-3's scope. A moved repository cannot call it, so the clock seam is
forced rather than optional: `claimNow: () -> String` replacing `clock: Clock`.

WHAT THAT COSTS, counted rather than estimated: `LocalEntryRepository(dao, clock)` is
constructed POSITIONALLY at three production sites and in 14 test files. Changing the
second parameter's type edits all of them - including AccountScopeTest and
EntryRepositoryTest, which are the very files R450 and R452 want running UNEDITED across
the move. Paying that to port a class whose own task does not need it (KMP-3's WHY is the
session, the sync and the dossier) is the trade this entry declines.

THE DESIGN, so the next task does not rediscover it: `claimNow: () -> String` and
`isDebugBuild: Boolean = true` (defaulted so existing constructions stay unedited), a
`Logger` seam for the release branch, and `newMutationId` losing only its default. Doing it
at the same time as PARK-B1 is cheaper than doing it twice.

REVERSING IT is a constructor change plus a mechanical edit of 17 call sites; nothing about
the row, the queue or the wire is involved.

## PARK-D2 - LocalRhythmRepository stays in :app, blocked by PARK-K3

Expected to move with PARK-B2 and cannot, for a reason that is not about the clock:
`WeeklyRhythm.toEntryKindMap()` calls `RhythmKind.toEntryKind().toShared()`, and `toShared`
is declared in :app's data/local/EntryAggregation.kt - which is PARK-K3, the duplicate
EntryKind/Portion enums, explicitly out of scope for KMP-3 ("Collapsing the KMP-0 duplicate
enums (PARK it for a tidy task)").

So the rhythm repository moves when PARK-K3 is collapsed, and not before. Its OTHER
platform dependency, `java.time.DayOfWeek`, is not an obstacle: it is already on R384's
inventory as a site relying on the 0.6.x JVM typealias, so moving it would shift one entry
from the :app half of that list to the :shared half and add no new reliance.

## PARK-D3 - the /api/v1/me codec stays org.json in :app

R448 permits a moved store's org.json encode/decode to become kotlinx.serialization under
KMP-1's one Json configuration "only if the goldens prove the bytes read back identically".
For `mePatchBody` / `parseMeSettings` / `parseMeView` the goldens cannot, and the reason is
structural rather than a missing fixture.

KMP-1's Json OMITS nulls - correct for the entries wire. `mePatchBody` needs the opposite
for TWO fields in the same body: `exactTotalWorkDays` and `activityStartDate` are sent as
JSON null ON PURPOSE, because null is how the simplified basis and the whole-year case are
STATED, and omitting either leaves a stale server value standing. In that same body `name`,
`loggingMode` and `detectionConsent` must be OMITTED when absent, because /me's schema
refuses a null name outright. One Json configuration cannot express both, and there is no
/me wire golden that would have caught the difference - a silent wire change is what the
hard boundary forbids.

These three functions are now :app/settings/MeWire.kt. Settings, MeView and the
completeness rules they operate on are all in :shared, so iOS implements three small
encoding functions rather than re-deriving the vocabulary. Reversing this needs either a
second Json configuration or per-field explicit nulls, and a /me golden first.

## PARK-D4 - KMP-3's pinning tests live in :app's JVM suite, not commonTest

R450 and R451 ask for the behaviour to be pinned first on the current code and then for
"the same tests, unedited" to run on the moved code. The second half is satisfied exactly -
:app depends on :shared, so every one of those files now exercises commonMain with not a
character changed. What is NOT satisfied is R450's parenthetical "moved unchanged to
commonTest ... where possible", and the reason is that it is not possible for any of them
without an edit or a dependency:

  - SessionManagerTest, DossierApiTest, MeSettingsTest and SignOutSyncFirstTest are Kotest
    FunSpecs. Kotest is not a commonTest framework here; porting is a structural rewrite,
    not an import swap, and KMP-1b's accepted "unedited" deviation was explicitly limited
    to import swaps and throw lines with no assertion touched.
  - SyncEngineTest builds its scripted server responses with org.json.
  - AccountScopeTest and EntryRepositoryTest use java.time and java.util.UUID.
  - BatchLimitParityTest reads web/lib/entries/schema.ts off the filesystem.
  - This task's own three new tests are JUnit4, because `kotlin-test` is NOT on :app's test
    classpath and adding it is a dependency change on SPEC 20's Ask-first list.

The cheap unlock is `testImplementation(libs.kotlin.test)` on :app - the same catalog entry
and version :shared already uses, test scope only. With it, a test can be written in
kotlin.test, pinned against :app code, and later moved to commonTest by `git mv` alone.
Recorded as a question rather than taken.
