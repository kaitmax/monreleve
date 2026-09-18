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
