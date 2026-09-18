# phase4parking.md

Blockers and bottlenecks met during the backend phase (FW21 onward),
recorded rather than stopped for. Same discipline as `parking.md`: each
entry says what was hit, what was done anyway, what was NOT done, and what
would unblock it.

`parking.md` holds decisions taken with alternatives recorded. This file
holds things that could not be finished, and why.

---

## P4-1 - Auth.js tables cannot be written "as its adapter requires" [FW21, 2026-09-18]

**HIT AT:** FW21 increment 1, which asks for "Auth.js tables as its adapter
requires".

**THE BOTTLENECK.** No Auth.js package is installed. `package.json` carries
no `next-auth`, no `@auth/core` and no `@auth/prisma-adapter` — the auth
task is FW22, and FW21 is the schema that precedes it.

So "as its adapter requires" cannot be *verified* in this task. It can only
be written from the adapter's documented Prisma schema, which is a stable
published contract but is not the installed artefact. That is precisely the
shape R185 names: a hand-written description of something authoritative,
with nothing asserting the two agree.

**AND INSTALLING IT IS ASK-FIRST.** SPEC §20 makes adding a dependency an
item that stops and asks. Installing `@auth/prisma-adapter` to read its
requirements would be adding a dependency in a task whose scope explicitly
excludes auth flows ("Auth flows - FW22", OUT OF SCOPE).

**TAKEN:** `Account`, `Session` and `VerificationToken` are written from the
Auth.js Prisma adapter's published schema, with every field justified by
name in REPORT-FW21.txt per R187. `User` gains no `image` column: the
adapter's `AdapterUser` carries one, nothing in SPEC 8 or in this product
displays an avatar, and R187 says an unused column is a promise to a client
that will eventually read it. If FW22's adapter turns out to require it, it
is one nullable column in a migration on a table that will still be empty.

**NOT TAKEN:**
(a) Installing the adapter to verify. Ask-first, and out of this task's
    scope.
(b) Omitting the tables entirely and leaving them to FW22. The prompt asks
    for them here, and a migration that adds auth tables later is a second
    migration on a live table for no gain.
(c) Guessing at fields beyond the published schema. Nothing speculative is
    in the file.

**WHAT UNBLOCKS IT:** FW22 installs the adapter. The first thing that task
should do is assert the shipped schema against the installed adapter's
requirements — the R185 mechanism, one layer over: generated or asserted,
never argued.

**RISK IF WRONG:** low and cheap. The tables are empty until FW22, so a
shape correction there is a migration against no rows.

---
## P4-2 - CI unavailable until 1 October: the Actions allowance [FW21, CLOSED FW22 increment 0]

**STATUS: CLOSED.** Not by CI returning, but by the claim it was making
moving somewhere it can be made. See R199, R200 and R201 in
`relay/CI-BUDGET-AMENDMENT.txt`.

**WHAT I RECORDED AT THE TIME, AND WHAT IT ACTUALLY WAS.** FW21 recorded
this as a *payment failure*, because that is what the annotation on every
refused job says:

> The job was not started because recent account payments have failed or
> your spending limit needs to be increased.

The cause was the **September 2026 included-minutes allowance being
exhausted** on a private repository. Nothing had failed to pay. GitHub
reports an exhausted allowance and a failed card in the same sentence,
and I copied the sentence into a parking entry as though it were a
diagnosis — so the entry told the operator to go and check their payment
method for a problem that was not there.

**THAT IS R181's DEFECT ON AN OPERATIONAL RECORD.** A transcription is
correct on the day it is written and misleading afterwards: the text was
quoted accurately and the *fact* was wrong, because the vendor's message
conflates two causes and nothing connected the entry to the thing it
described. A parking entry naming what must be SUPPLIED has the same duty
as published copy — the operator acts on it.

**WHAT IS TRUE.** The repository stays private. The allowance returns on
**1 October 2026** at 2 000 minutes a month.

**HOW IT IS CLOSED.**
- `pnpm gate:clone` (R199) now makes the clean-machine claim locally:
  a real `git clone` of HEAD, install from the lockfile, then typecheck,
  lint, test, build, size, and the database suites against a scratch
  database it creates and migrates itself. Steps that cannot run in a
  clone are named with their reason rather than omitted.
- R200 reworded R1 wherever it is still live: `CLAUDE.md`,
  `relay/PHASE-4-PROTOCOL.txt`, `relay/RUN-PHASE-4.txt`. Historical
  reports and spent prompts are left alone — they record what was true
  when they were written.
- R201's split is written into `.github/workflows/ci.yml` and DISABLED:
  every job is gated on the `CI_OCTOBER` repository variable, so the jobs
  skip at no cost and produce no red runs.

**NEEDS:** on **1 October 2026**, one action, touching no file:

    gh variable set CI_OCTOBER --body on

Then `web` runs on each push to main (~8 min, about one per task), and
the parity matrix, visual baselines and runtime guard become
`workflow_dispatch` only. The `web` job's first step prints the remaining
minutes to the run summary; **below 400, revert to gate:clone-only for
the rest of the month and record that here** rather than discovering it
the way this entry was discovered.

**WHAT IS KNOWINGLY LOST UNTIL THEN**, stated rather than left to lapse:
- the Node 22/24 parity matrix (R27) — run it manually once before FW29;
- the property that someone else could clone and build this. That matters
  at Checkpoint E, not now. `gate:clone` covers the mechanical half of it;
  what it cannot cover is a machine that is not this one.

---
