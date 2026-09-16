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
