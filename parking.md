# parking.md

Open questions that did **not** stop a task, and the conservative option
taken instead. Ruling **R156**, created in FW18.

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
## P<n> - <one-line title>  [FW<task>, <date>]
QUESTION:  what was unclear, in two sentences.
TAKEN:     the conservative option, and why it is reversible.
NOT TAKEN: the alternative, and what it would cost to switch.
TOUCHES:   files, tests and baselines a switch would change.
```

---

## P1 - the employer attestation is described, never asserted  [FW18, 2026-09-16]

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

## P2 - droit-option-lamal-cmu is NOT published  [FW18, 2026-09-16]

SUPERSEDED BY P6 ON 16.09.2026. The article is published. This entry is kept
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

## P3 - the declaration guide carries no date, form or procedure  [FW18, 2026-09-16]

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
at all, as with P2 — unlike the droit d'option, this article has a real
subject that IS sourced (which number, from where, and why April is too
late), so it is not a thin page.

TOUCHES:   `web/content/guides/declaration-impots-frontalier.mdx` (one
section and the second FAQ answer), plus rows in
`docs/regulatory-sources.md` and `web/lib/content/sources.ts` if dates are
ever verified.

## P4 - the LAMal/CMU comparator is NOT published (R157 option 3)  [FW19, 2026-09-16]

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
   repeats it. FW18 parked the droit-option guide (P2) precisely because those
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

## P5 - the CLEISS URL is cited pending the operator's confirmation  [FW18b, 2026-09-16]

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

## P6 - the droit d'option guide is published, superseding P2  [FW18b, 2026-09-16]

QUESTION:  FW18 refused to write this article. Its two load-bearing facts —
the three-month window and the irrevocability of the choice — had no verified
row in `docs/regulatory-sources.md`, and SPEC 22 lists the three-month figure
among those "compiled from advisory and news sources". P2 recorded the refusal
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

NOT TAKEN: (a) Publishing it in FW18 with hedges, which is what P2 refused and
still refuses: a hedge on a three-month irrevocable deadline is worse than
silence, because a reader who acts on a hedged deadline has still missed it.
(b) Waiting for a second source to corroborate CLEISS. CLEISS is the body, not
a commentator on the body; a second source would be a page quoting it.

TOUCHES:   `web/content/guides/droit-option-lamal-cmu.mdx`, the pillar's
`related` and its forward link, `status: 'live'` in
`web/lib/content/routes.ts`, the sitemap census and the planned-route set in
`web/tests/unit/content/routes.test.ts`, the R119 exemption in
`web/tests/unit/pages/singletons.test.tsx`, and the guide baselines.

SUPERSEDES: P2. P2 stays in this file rather than being deleted — the refusal
was correct on the record as it stood, and a parking file that erases the
decisions that were later unblocked stops being a record of how the product
decides.

## P7 - the article does not link /calculateur-lamal-cmu  [FW18b, 2026-09-16]

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

## P8 - the reviewer field stays, and nothing renders it  [FW18b, 2026-09-16]

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
