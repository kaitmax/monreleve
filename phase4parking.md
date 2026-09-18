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
## P4-2 - CI cannot run: GitHub Actions billing [FW21, 2026-09-18]

**HIT AT:** FW21 increment 6, verifying CI on the pushed increments.

**THE BLOCKER.** Every job on the last four FW21 commits reports:

> The job was not started because recent account payments have failed or
> your spending limit needs to be increased. Please check the 'Billing &
> plans' section in your settings

The jobs have `steps=0` and complete in 2-4 seconds. Nothing executed.
This is an account state, not a code defect, and it is not something this
session can fix — it needs the account owner in GitHub billing settings.

**WHAT IS ACTUALLY KNOWN ABOUT CI.** Run 35320869948, on increment 1
(`6705d3b`), started before the limit was reached and **the four jobs that
executed all passed**:

| job | result |
|---|---|
| `web` (includes `db:deploy`, `test:db`, `build`, `test:e2e`, `size`) | passed, 8m9s |
| `format parity (compile)` | passed, 40s |
| `rail visual baselines` | passed, 3m22s |
| `runtime guard (R81)` | passed, 1m52s |

Its two `format parity (node 22 / node 24)` matrix jobs are the first two
that hit the billing wall — `steps=0`, same annotation.

So the FW21 schema, its first migration and the updated table census are
CI-proven on a real PostgreSQL service container. Increments 2 to 5 are
**not**: `3481026`, `7454a9f`, `e8d9600` and `9628cc7` have never had a job
start.

**TAKEN:** every increment gated locally with `pnpm gate:changed`
(typecheck, lint, test, build, test:db — 169 db tests at increment 6), and
`pnpm gate:clean` run once per R139 since the schema and generated client
changed. That last one covers the specific failure CI would otherwise be
the first to see: a Prisma client that exists on this machine and not on a
fresh install.

**NOT TAKEN:**
(a) Claiming CI green. It is not, and four of the five commits have no
    evidence either way.
(b) Disabling or narrowing jobs to get a green tick. The tick would mean
    less than the red one does.
(c) Re-running the failed runs. They fail identically until billing is
    resolved; `gh run rerun` would only add noise.

**WHAT UNBLOCKS IT:** the account owner raises the spending limit or
settles the payment, then `gh run rerun 35325037923` (or any push)
exercises increments 2-5. **The first thing to read is the `web` job's
`pnpm test:db` step** — it is the one carrying FW21's new work, and
`fw14-era-migration.test.ts` needs `CREATE DATABASE`, which the postgres
image's `POSTGRES_USER` has and a hardened role would not.

**RISK IF WRONG:** moderate and bounded. The database suites passed
locally against the same PostgreSQL 16 major version CI uses, and
increment 1 proved the service-container path works. The untested
difference is privilege and environment, not logic.

---
