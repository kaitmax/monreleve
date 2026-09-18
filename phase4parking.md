# phase4parking.md

Blockers and bottlenecks met during the backend phase (FW21 onward),
recorded rather than stopped for. Same discipline as `parking.md`: each
entry says what was hit, what was done anyway, what was NOT done, and what
would unblock it.

`parking.md` holds decisions taken with alternatives recorded. This file
holds things that could not be finished, and why.

---

## P4-1 - Auth.js tables written from documentation [FW21, CLOSED FW22 increment 1]

**STATUS: CLOSED. The transcription was correct.** The adapter is installed,
and every method FW22 will use has been called against the real tables -
see the bottom of this entry for what was proven and how.

---

### The original entry, kept as written


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

### CLOSING P4-1 [FW22 increment 1, 2026-09-18]

**THE ANSWER: FW21's transcription was right.** `@auth/prisma-adapter`
2.11.3 is installed, and `tests/db/auth-adapter.test.ts` calls every method
FW22's flow uses against the real PostgreSQL — `createUser`, `getUser`,
`getUserByEmail`, `updateUser`, `linkAccount`, `getUserByAccount`,
`createSession`, `getSessionAndUser`, `deleteSession`,
`createVerificationToken`, `useVerificationToken`. Eight tests, all green,
no migration needed.

**`User` HAS NO `image` COLUMN AND THE ADAPTER DOES NOT NEED ONE.** That was
the specific worry FW21 recorded. The adapter's `AdapterUser` type carries
`image`; nothing in SPEC §8 displays an avatar; R187 says an unused column is
a promise to a client that will eventually read it. Every test above passes
with the column absent, so the omission was correct and stays.

**I OVERCLAIMED THE TYPE-LEVEL PROOF AND CORRECTED IT.** The first draft of
that test file asserted that `PrismaAdapter(prisma)` typechecking would catch
a missing column "without a database". It would not. The adapter ships
compiled JS plus a `.d.ts`, so TypeScript never re-checks its body against our
client: `prisma.account.create(...)` inside the package was checked when the
package was built, against a generic client. Our client satisfies the
signature because it *is* a `PrismaClient` — whether it has an `account` model
is not a question the signature asks. **A schema missing `Account` entirely
would compile and fail at the first sign-in.** The runtime tests are therefore
the whole of the answer, and the comment now says so. An assertion that sounds
stronger than it is, is the argument R185 forbids wearing a type annotation.

**PROVEN LOAD-BEARING BY TWO ABLATIONS**, because eight tests passing on their
first run is evidence of nothing (R133):

| ablation | result |
|---|---|
| tables absent (a pre-FW21, FW14-era database) | all 8 fail, `The table public.User does not exist` |
| one column dropped (`VerificationToken.expires`) | exactly 1 fails, the 7 others still pass |

The second is the one that matters: it shows *column-level* sensitivity, which
is what P4-1 was actually about, since FW21 transcribed columns from a
document.

**NEEDS:** nothing further.

---

## PARK4-1 - seven OAuth columns on Account that this product may never write [FW22, 2026-09-18]

**QUESTION:** `Account` carries `refresh_token`, `access_token`, `expires_at`,
`token_type`, `scope`, `id_token` and `session_state`, all nullable, all
transcribed from the adapter's published schema in FW21. This product is
passwordless by magic link (D6, D23) and has no OAuth provider, so the email
flow writes `type`, `provider`, `providerAccountId` and `userId` and leaves
all seven null. R187 says an unused column is a promise to a client that will
eventually read it.

**TAKEN:** left in place, untouched. They are part of the adapter's contract
rather than fields this product invented, and the adapter — not our code —
decides what it writes when a provider is added. Removing them would be a
migration that makes adding any OAuth provider a second migration, and R187's
concern is about columns an API client might read, which these are not: they
are internal to Auth.js and no `/api/v1` response will ever carry them.

**NOT TAKEN:** dropping the seven. Cheap now (the table is empty), and it
would have to be undone the first time an OAuth provider is considered.

**TOUCHES:** `prisma/schema.prisma`, one migration,
`tests/db/auth-adapter.test.ts`.

**NEEDS:** a ruling only if the answer is "this product will never support
OAuth". If that is certain, say so and they go; if it is merely true today,
they stay.

---
## PARK4-2 - assetlinks.json has no fingerprints until AN14 [FW22, 2026-09-18]

**QUESTION:** `/.well-known/assetlinks.json` is what makes the sign-in link an
Android App Link — without it, tapping the link opens a browser instead of the
app. It needs the application's package name and the SHA-256 fingerprints of
the certificates it is signed with. Neither exists: there is no `android/`
directory in this repository and no signed build until AN14.

**TAKEN:** the route is built and reads `ANDROID_PACKAGE_NAME` and
`ANDROID_SHA256_CERT_FINGERPRINTS` from the environment. **With them unset it
returns 404, never an empty statement list.** That distinction is the entry:
`[]` is not "we have not said yet", it is a complete published statement that
*no* application is associated with this domain — which Android reads, caches
and acts on. Serving it while the values are merely unknown publishes
something false in the one file whose whole purpose is to be believed. A 404
says what is true: there is no statement here.

It is R160's reviewer chip in a JSON file — *en attente* rather than a name
implying a review nobody did — and the same rule as never claiming more than
the record supports.

Malformed values are refused the same way, with a log line. A fingerprint with
a typo produces a file that is syntactically valid and verifies against
nothing, and the symptom ("the link opens a browser sometimes") is about as
far from the cause as a symptom gets.

**NOT TAKEN:**
(a) A placeholder fingerprint. It would publish a false statement and would
    verify against nothing, which is the failure above with extra steps.
(b) Omitting the route until AN14. The seam is where the questions live, and
    building it now means the day those values exist the change is two
    environment variables and no code.

**TOUCHES:** nothing in code. Two environment variables in the deployment.

**NEEDS — from AN14, exactly:**
1. `ANDROID_PACKAGE_NAME` — the `applicationId` from the app's
   `build.gradle.kts`, e.g. `ch.monreleve.app`.
2. `ANDROID_SHA256_CERT_FINGERPRINTS` — comma-separated SHA-256 fingerprints,
   uppercase hex, colon-separated, from
   `keytool -list -v -keystore <release.jks> -alias <alias>`. **Both the
   release key and the Play App Signing key** if Play re-signs the upload —
   Google's key is the one that ships, and a statement naming only the upload
   key verifies for nobody. The debug key too, if App Links are to work on a
   development build.

Proven in both states by `tests/unit/pages/assetlinks.test.ts`: 404 unset,
404 malformed, and a statement matching the Digital Asset Links shape when the
variables are supplied.

---
