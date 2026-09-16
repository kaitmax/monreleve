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
