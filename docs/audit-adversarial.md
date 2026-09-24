# The adversarial audit — FW30

**What this asks, and how it differs from FW29.** The release audit asked *did we
do what we said*, against SPEC §21 and the standing rulings — criteria this
project chose for itself. This asks what **a hostile reviewer, a real attacker, a
real load, and a maintainer in two years** would find that our own criteria never
thought to ask about.

**R254 governs every line below.** An audit measures; it does not reason. *"We use
parameterised queries, so injection is handled"* is a belief, not a finding. Every
claim here is backed by something that was **run** — a request that was sent and
its response read, a query plan produced by `EXPLAIN ANALYZE`, a dataset generated
and timed, a mutation applied and a test observed to go red. Where nothing was
run, the section says **UNEXAMINED**, which is an honest and useful thing for a
report to say.

**R255 governs what happened next.** Findings are recorded and parked with their
severity, their evidence, and what it would take to close them. Nothing structural
was fixed. A session that starts fixing stops auditing.

---

## 0. The finding, first and in full

### F-WRITE — every transactional write fails in a production build

**Severity: CRITICAL.** Recording a day — the entire purpose of this product —
does not work when deployed.

**Evidence.** A fresh container, nothing else running, 7 of 100 database
connections in use, one request:

```
POST /api/v1/entries
{"entries":[{"dayDate":"2028-05-10","kind":"HOME",
             "clientMutationId":"fw30-single-write-proof"}]}

-> HTTP 500
   {"status":"error","code":"write_failed",
    "message":"Le service n'a pas pu enregistrer cet envoi.
               Rien n'a été modifié ; l'application réessaiera."}

rows written: 0
```

Not load. Not a race. Not intermittent. One request, idle machine. The container
log names it:

```
[entries] batch of 1 refused: write_failed
Transaction API error: Transaction not found. Transaction ID is invalid,
refers to an old closed transaction Prisma doesn't have information about
anymore, or was obtained before disconnecting.
```

**The mechanism, and it takes both halves.** In `web/lib/db/client.ts`:

```ts
function create(): PrismaClient {
  const client = globalForPrisma.frontalierPrisma
    ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.frontalierPrisma = client;      // ONLY off-production
  }

  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = create();                         // EVERY property access
    return Reflect.get(client, property, receiver) as unknown;
  },
});
```

1. `create()` memoises **only** when `NODE_ENV !== 'production'`, so in production
   every property access constructs a new `PrismaClient` around a new `PrismaPg`
   pool.
2. `Reflect.get(client, property, receiver)` passes **the Proxy** as the receiver,
   so a method called as `prisma.$transaction()` runs with `this` bound to the
   Proxy. Every `this.x` inside it is another Proxy get, and therefore another new
   client.

So `$transaction` opens a transaction on one client and resolves its own internals
against others. The transaction id it created is unknown to the client asked about
it. Either half alone would be survivable. Together they break every transaction.

**The application code is correct.** `lib/entries/write.ts:71` opens
`prisma.$transaction(async (tx) => …)` and uses `tx.entryEvent` inside, which is
exactly right. The fault is entirely in the client module.

**Proven at three independent levels.**

| Level | Method | Result |
|---|---|---|
| Code | read `lib/db/client.ts` | the Proxy, and the conditional memoisation |
| Module | drive `$transaction` directly | `NODE_ENV=test` **succeeds** `{a:199,b:3131}`; `NODE_ENV=production` **throws** *Transaction not found* |
| System | one `POST` to a production container | HTTP 500, zero rows |

A fourth, arriving from the other direction: the **same** write is HTTP 200
in-process under `NODE_ENV=test` (§4) and 500 against a production build.

**The second consequence — connections.** Measured by sampling
`pg_stat_activity` while driving a container with `curl` alone:

| State | Connections |
|---|---|
| baseline | 5 / 100 |
| after 10 authenticated reads | 45 / 100 |
| after 20 authenticated reads | 85 / 100 |
| after ~25 | `psql` itself could no longer connect |
| 15 s later | 1 / 100 |

About four new pools per request, never reused, released only by node-postgres's
~10 s `idleTimeoutMillis`. **A request carrying `Bearer <garbage>` also opens
pools on its way to its 401** — 50 such requests took the count from 3 to 53 — so
no account is needed. A request with *no* `Authorization` header short-circuits
and costs nothing (40 left the count at 1). The cheapest denial of service against
this product is about twenty-five HTTP requests carrying a made-up token.

**Why every guard this project owns is blind to it.**

| Guard | Why it cannot see this |
|---|---|
| unit and db tests | `NODE_ENV=test` → the guard memoises |
| `pnpm dev` | `NODE_ENV=development` → memoises |
| R176's walkthrough | runs against `pnpm dev` |
| `gate:changed` | never builds production and drives it |
| `gate:clone` | skips the container suites, and **says so** (R133) |
| CI's container job | **has never passed** — see F-CI |

R177 says a suite that only ever sees built output cannot tell you the development
path is broken. This is its exact inverse, and nobody had written that direction
down.

**And it is older and more structural than F-CI.** Reconciled against FW28 and
FW29, both of which record `test:container:e2e 270 + 9 HTTP passed` against a
production image:

- `grep entries/POST web/scripts/container-e2e.mjs` → **the harness never POSTs an
  entry.**
- `grep api/v1/entries web/e2e/` → **nothing.** The browser suite cannot reach it
  *by design*: D14 removed the signed-in web area, so the write path has exactly
  one intended caller — the Android client, which does not exist yet.
- The suites that do exercise it are `tests/db/entries-{route,write,read}` and
  `tests/unit/entries/schema`, all under `NODE_ENV=test`.
- `git log -- web/lib/db/client.ts` → `9c22ffd`, **2026-09-13**, *"FW14: build the
  Prisma client on first use, not on import"*.

**So a green container job would not have caught it either.** The reason this
shipped is that nothing anywhere exercises a production write, and that has been
true since 13 September.

**Why this was not the session's hard stop.** The prompt's absolute stop names
authentication bypass, cross-tenant data access, secret exposure and remote code
execution. This is none of them: nothing is read that should not be, nothing is
bypassed, nothing leaks. It is a total functional failure and a denial of service.
So the audit continued — and this is first and in full, which is the binding half
of that instruction.

**What it would take to close.**

1. Memoise the client unconditionally.
2. Return methods bound to the client, not the Proxy.
3. **A test that runs against a production build and asserts an entry is written
   and read back.** This is the part that matters — the edit without the test
   restores the exact condition that allowed this.
4. Fix F-CI so that test runs somewhere other than one person's machine.

---

## 1. Preconditions

| | |
|---|---|
| `gate:clone` | PASSED on `db10184`, a fresh clone of `origin/main` HEAD |
| ran | install, typecheck, lint, test, build, size, db:deploy, test:db |
| skipped, each named with its reason (R133) | test:e2e, test:visual, test:runtime, lighthouse, parity:check, test:container |
| R250 | no real credential sought or created, no third-party account, no traffic to any host but localhost |

---

## 2. The dataset

`web/scripts/fw30-dataset.mjs`, committed so every measurement here reproduces.
Every previous measurement in this project had been taken against a 261-row demo
year for one user — a screenshot, not a load.

| | |
|---|---|
| users | 200, each a consistent scenario (R197): six cantons, three employment rates, both denominators, both granularities, both logging modes |
| entries | 3 424 |
| entry events | 3 131 — one `CREATED` per entry plus `MODIFIED` on every fifth, so the trail is **longer** than the table |
| alert subscribers | 5 000, in four states: confirmed, unconfirmed fresh, unconfirmed >30 days, unsubscribed |
| ten-year user | 2 609 entries, 2016–2025 |
| half-day year | 522 rows |
| all-absent year | 261 — the zero-worked-days denominator |
| empty user | 0 entries, deliberately: the likeliest divide-by-zero |
| longest note | 10 003 characters, plus one carrying tab, CR, LF, NBSP, narrow NBSP, line separator and ZWSP |
| DST | both 2026 boundaries |

**A CHECK constraint refused the first version of this fixture.**
`Entry_detectedKind_when_detected` fired because the generator set a `DETECTED`
provenance with a null `detectedKind`. R196 argues the database enforces an
invariant *"so the rule survives a writer who does not know it exists"* — tonight
that writer was the auditor, and the database was the only thing that noticed.
A live instance, which R178 prefers to a planted one.

---

## 3. Security

### Authentication — 99 refusals, zero acceptances, four distinct names

Nine bad-credential classes against all eleven authenticated routes, the routes
**derived** from `app/api/**/route.ts` rather than listed (R246's lesson).

| Credential | Result on all 11 routes |
|---|---|
| no token at all | 401 `missing_token` |
| malformed — not a JWT | 401 `unknown_token` |
| malformed — empty bearer | 401 `malformed_authorization` |
| wrong scheme (`Basic`) | 401 `malformed_authorization` |
| token with no scheme | 401 `malformed_authorization` |
| a **refresh** token used as access | 401 `unknown_token` |
| token of a **deleted** account | 401 `unknown_token` |
| token of a **revoked** session | 401 `revoked_session` |
| token in a **cookie** | 401 `missing_token` |
| token in a **query parameter** | 401 `missing_token` |

The cookie and query-parameter rows are AC3's zero-cookie guarantee **measured**
rather than asserted: the product reads a credential from neither. Four names,
distinguishing the four cases a client acts on differently (R198).

**Control:** the same eleven routes with a good token are not all 401 — six 200s,
and every non-200 is explained individually. Without that line, every refusal
above would be satisfied by the routes simply being broken.

### Tenancy — no cross-tenant access, with a green control

User A's token against user B's identifiers, in the query, the body, the path and
as a duplicated parameter.

| Probe | Result |
|---|---|
| `GET /dossier?year=2025&userId=B` | 400 `unknown_parameter` |
| `GET /entries?year=2025&userId=B` | 400 `unknown_parameter` |
| `GET /export/csv?year=2025&userId=B` | 400 `unknown_parameter` |
| `GET /account/export?userId=B` | 400 `unknown_parameter` |
| `GET /dossier?year=2025&year=2026` (duplicated) | 400 `invalid_year` |
| B's entry id in a `POST /entries` body | 400 |
| B's `clientMutationId` reused | 400 |
| `PATCH /me` with `userId: B` in the body | 400 `invalid_body` |
| **CONTROL — A reads A's own dossier** | **200** |
| occurrences of B's id in A's dossier | **0** |

A **duplicated parameter is refused outright** rather than resolved first-wins or
last-wins, which is the strongest available answer to that probe.

*The first two runs of this probe ended with the control at 500 — F-POOL, from
fifteen sign-ins — and the fifth probe onward had been running without a session
at all. The control is what caught it. See §8.*

### Injection — refused, and what does land lands verbatim

Eighteen payloads against the entries write path. Type-confusion shapes — a Prisma
operator object where a string belongs, an array for a scalar, a scalar for an
array, `__proto__`, `constructor.prototype` — all **400**, the runtime prototype
verified unpolluted afterwards, and oversized bodies **413**. That is Zod
`.strict()` doing its job.

**The schema-valid half of that run proved nothing**, because F-WRITE returned 500
for every payload that reached the database — including the control. *Does
`' OR 1=1 --` land literally in the note column?* was never answered. Asked again
in-process through the **route handler** (R204) under `NODE_ENV=test`, then read
back from the database:

| Payload | HTTP | Stored | Verbatim |
|---|---|---|---|
| `' OR 1=1 --` | 200 | `' OR 1=1 --` | yes |
| `'; DROP TABLE "Entry"; --` | 200 | `'; DROP TABLE "Entry"; --` | yes |
| `' UNION SELECT * FROM "User" --` | 200 | identical | yes |
| `\' OR '1'='1` | 200 | identical | yes |
| `100% _wildcard_` | 200 | identical | yes |
| `café ‮ reversed` (RTL override) | 200 | identical | yes |

`"User"` 199 rows, `"Entry"` 3 430 rows — neither table dropped. Stored as data,
byte for byte, interpreted nowhere, including the `LIKE` wildcards and the
backslash, which are the two a hand-built query gets wrong. That is the positive
form (R133): not *the attack was refused* but *the input was kept exactly and did
nothing*.

### Headers — all six absent

| Header | Set anywhere? | What it would prevent |
|---|---|---|
| `Content-Security-Policy` | **no** | XSS. The product renders no user HTML and loads no third-party script, so this is defence in depth, not a live hole. |
| `X-Content-Type-Options` | **no** | MIME sniffing. The CSV and PDF downloads are the surface — a CSV sniffed as HTML. |
| `Referrer-Policy` | **no** | The calculator's URL carries the nine frozen fiscal params (SPEC §9.4). Modern browsers default to `strict-origin-when-cross-origin`, which strips them cross-origin; this makes it explicit rather than inherited. |
| `Permissions-Policy` | **no** | **The best fit for this product.** SPEC's central promise is that no coordinate is ever stored. `geolocation=()` would make that structural in the browser rather than a property of our code. |
| `Strict-Transport-Security` | **no** | Downgrade. Needs the real domain first. |
| `X-Frame-Options` / `frame-ancestors` | **no** | Clickjacking. |

Not added. The prompt is right that a CSP written without measurement breaks a
page and gets relaxed to nothing.

### Secrets — clean

| Surface | Result |
|---|---|
| client bundle (`.next/static`, 56 files) | no match for `AUTH_SECRET`, `RESEND_API`, `FCM_PRIVATE`, a PEM header, or a Resend key shape |
| server bundle | one match for `BEGIN PRIVATE KEY` — a **PEM-format validator constant**, `e.startsWith("-----BEGIN PRIVATE KEY-----")`, not a key |
| git history | the same constant, introduced by `a4edfec` *"FW27: FCM behind a seam, uncredentialed"* |
| tracked `.env` | none; only `web/.env.example` |
| `NEXT_PUBLIC_*` | exactly one, `NEXT_PUBLIC_SITE_URL` — an origin, not a secret |

### Rate limits

| Endpoint | Limited? | Evidence |
|---|---|---|
| `POST /api/v1/auth/magic-link` | **yes**, invisibly | 10 attempts at one address on a restarted container issued **one** token. Every response was 202, because `RequestRefusal` (`invalid`/`rate-limited`/`undeliverable`) all map to 202 so an attacker cannot tell them apart. |
| `POST /api/v1/auth/refresh` | **no** | 30 attempts in 757 ms, zero 429s. Does no outbound work and its tokens are 256-bit, so this is unbounded work per unauthenticated caller rather than a guessing or spam vector. |
| `GET /api/v1/export/pdf` | bounded, not rate-limited | `MAX_QUEUED = 2`; five concurrent renders gave `503 503 200 200 200` |
| `POST /api/alertes` | yes | 5 per 10 minutes per client key |

**Email enumeration: no oracle.** 12 known/unknown pairs — status identical (202),
body identical, **median timing delta −0.0 ms**. The defence holds under the
measurement that usually breaks this pattern.

### Logging — no user data reaches it

119 log lines including several exception stack traces. Occurrences of
`fw30-1@example.com`: **0**. Of `@example.com`: **0**. Of `Bearer`, `accessToken`,
`fcmToken`, a note's contents, or a JWT prefix: **0** each. `/confidentialite`'s
claims hold under probe.

### Dependencies

`pnpm audit`: 14 advisories — 7 high, 6 moderate, 1 low, 0 critical. 14 direct
production dependencies; 2 088 lockfile entries.

**Only one reaches the production tree.** `pnpm why --prod` for each vulnerable
package:

| Package | In production tree? |
|---|---|
| `tmp` | no |
| `extract-zip` | no |
| `uuid` | no |
| `postcss@8.4.31` | **yes**, via `next@15.5.25` |

The postcss advisories are attacks via **malicious CSS input**; the CSS processed
is ours, at build time, and `next start` on a standalone build does not run it.
No advisory affects the running server on attacker-controlled input. The fix is a
Next upgrade.

---

## 4. Integrity under concurrency

**Scope, stated because it matters.** These ran **in-process** through the route
handlers (R204) under `NODE_ENV=test`. They cannot run against the production
container, because F-WRITE makes every write there return 500. Integrity is a
property of the transaction logic and the database rather than of `NODE_ENV`, so
the results are meaningful — but *"integrity holds"* must **not** be read as
*"integrity holds in production"*, where no write completes at all.

| Question | Result |
|---|---|
| Two simultaneous writes to the same day | both 200; **1 row** (the unique key); **2 events** — both attempts left a trace |
| Can `firstRecordedAt` be moved by any interleaving? | **No.** Identical before and after 8 concurrent edits. `updatedAt` did move. |
| A client-supplied `firstRecordedAt` / `recordedAt` | **HTTP 400** — refused, not silently stripped |
| A replay concurrent with an edit | replay 200, edit 200, 1 row, events 1 → 2: **delta 1**. The replay added no event. |
| A deletion concurrent with a write | write 200, 1 row, no crash, no partial row |

Last-writer-wins on the row and the append-only trail keeps the loser: the state
is unambiguous and the evidence is complete. SPEC's *timestamps are
server-assigned* survives eight-way concurrency **and** a deliberate attempt.

*Not measured: the count of events whose entry no longer exists — the relation
filter was rejected by Prisma and returned −1. Recorded as unmeasured rather than
as zero.*

---

## 5. Scalability at volume

### Query plans

`EXPLAIN (ANALYZE, BUFFERS)` against the ten-year user, **after `ANALYZE`**:

| Query | Plan | Rows | Time |
|---|---|---|---|
| dossier, one year | Bitmap Index Scan `Entry_userId_dayDate_portion_key` | 261 | 0.269 ms |
| account export, whole history | Index Scan `Entry_userId_dayDate_idx` | 2 609 | 0.680 ms |
| the alert send | Bitmap Index Scan `AlertSubscriber_confirmedAt_createdAt_idx` | 1 000 | 0.512 ms |
| the purge | same index | 1 250 | 0.463 ms |

**No missing index, no N+1, no sequential scan on any query that matters**, at ten
years and 5 000 subscribers.

The one remaining sequential scan is `EntryEvent`, and **it is the fixture's fault,
not the product's**: only `fw30-u1` has events, so the `userId` filter selects
100 % of the table and a seq scan is the correct plan. A plan read off a table
where one user owns every row says nothing about a table where 200 do. Stated as a
limit of the measurement.

### Payloads and timings

| | |
|---|---|
| PDF, 261-row annex | 200, 1 485 ms |
| PDF, 522 half-day rows | 200, 1 643 ms — **doubling the rows cost 158 ms; the render is not row-bound** |
| PDF, pathological user | 200, 154 882 bytes, 1 976 ms — a 10 003-char note, an RTL override, 40 absence rows |
| account export, ten years | 200, **1 237 600 bytes**, 130 ms |

**The predicted finding did not materialise, and its premise was wrong.** The
prompt expected the PDF at 2 600 annex rows to be the finding. `lib/dossier/load.ts`
is year-scoped (`dayDate >= YYYY-01-01 AND <= YYYY-12-31`), so **a 2 600-row annex
cannot exist**. `QUEUE_WAIT_MS = 30 000` has roughly 18× headroom over the slowest
render measured.

**The 2 600-row load is real, but it lives somewhere else.** `lib/account/export.ts`
reads `{ where: { userId } }` with **no year bound and no pagination**, plus
unbounded `entryEvent`, `device`, `deviceSession` and `reminderSent` reads. 1.2 MB
at ten years, in one response.

### Concurrency

| | |
|---|---|
| 10 simultaneous dossier requests | all 200 in 4 086 ms; **44 of 100 connections** afterwards |
| 5 simultaneous PDF renders (`MAX_QUEUED = 2`) | `503 503 200 200 200` in 17 102 ms — exactly three served |
| 4 renders across **two** containers | four 200s, **zero 503s** |

R236 asked what the sixth caller gets: a 503, promptly, rather than a timeout. The
bound behaves as specified **on one replica**. The queue lives in process memory,
so N replicas admit 2N concurrent renders and neither knows about the other.

### Connections

| | |
|---|---|
| `max_connections` | 100 |
| `superuser_reserved_connections` | 3 → 97 usable |
| host and container CPUs | 8 |
| `connection_limit` | **set nowhere** — not in `DATABASE_URL`, not in `lib/db`, not in `docs/deploy.md` |
| pg-boss pool | `new PgBoss({ connectionString: url })` — no `max` |
| `docs/deploy.md:192` | *"Every replica runs its own scheduler"* |

`docs/deploy.md` discusses replicas and per-replica schedulers and **never mentions
a pool size, a `connection_limit` or `max_connections`**. An operator scaling to
two replicas has no number to reason with. Under F-WRITE's leak this stops being
arithmetic and becomes the binding constraint.

---

## 6. Resilience and operability

**Postgres stopped mid-flight**, then restarted with no other intervention:

| Request | With Postgres down |
|---|---|
| `GET /api/v1/dossier` | 500, `P1001` named in the log |
| `GET /api/ready` | **200** |
| `GET /api/health` | 200 |
| `GET /` and the calculator | 200 |
| after `docker start` | serves again — **recovers without intervention** |

Static pages are unaffected, which is correct; they need no database. The log names
the cause by Prisma error code rather than a generic failure.

### F-BLIND — a database outage is silent at every observable endpoint

**Severity: medium.**

*What I first wrote was too strong, and the documentation corrected me.*
`/api/ready` returning 200 with the database down looks damning until you read
`docs/deploy.md:94–106`, which scopes it deliberately: `/api/ready` is **Coolify's
deploy health check** (200 ready, 503 while degraded) and `/api/health` is for a
restart policy. R83 is the reasoning — readiness 503 stops a *deploy* and leaves
the running version serving; wiring liveness to it turns a missing variable into a
crash-loop. For a deploy gate, checking configuration is the right check, and
`lib/content/readiness.ts` confirms the scope: `readiness()` runs exactly one
check, `servingWithoutOrigin()`, and never touches the database.

**The finding that survives is narrower and still real: nothing anywhere reports
"this instance cannot reach the database."** `/api/health` says the process
answers; `/api/ready` says the configuration is present; both are 200 throughout an
outage. The only signal is individual 500s in a log nobody is required to be
reading. R244 made scheduled jobs report themselves; the **request** path has no
equivalent.

### Backup and restore at volume

FW28 proved a restore with a demo year. This is the ten-year dataset.

| | |
|---|---|
| `pg_dump -Fc` | 1 s, 515 655 bytes |
| restore into a fresh empty database | 2 s |
| row counts | `User` 199/199, `Entry` 3 435/3 435, `EntryEvent` 3 153/3 153, `AlertSubscriber` 5 000/5 000, `DeviceSession` 80/80, `SessionToken` 160/160, `Device` 1/1, `VerificationToken` 1/1 — **all match** |
| one dossier rebuilt from each | 72 364 bytes, **sha256 identical** |

**A determinism question fell out of it.** The first comparison differed at the
same byte length. Rather than assume reordering, the dossier was built **twice from
the same database**: also different, and the first differing byte named the cause —
`"generatedAt":"…T14:09:33.970Z"` against `"…T14:09:34.025Z"`. A build timestamp,
which a document recording when it was produced *should* carry. Excluding that one
field, the dossier is byte-for-byte deterministic across two databases and two
runs. For a document whose argument is that its record can be trusted,
deterministic ordering is the property that matters, and it holds at 261 annex
rows.

---

## 7. Code quality

### The twenty-test falsifiability sample

*"Could this test fail?"* answered by reading is reasoning, which R254 forbids. It
was answered by **mutation**: change the code under test so the property the
test's **name** claims is violated, run that one test, record RED or GREEN.

| | |
|---|---|
| population | `vitest list` — 1 823 (`vitest.config.ts`) + 505 (`vitest.db.config.ts`) = **2 328** |
| excluded, and why (R133) | e2e, visual, runtime, a11y, late, container — not vitest suites reachable this way; they need a built server or a container |
| seed | **`FW30`**, stated so the draw reproduces (R171) |
| redraws | none. What was drawn was measured. |

Mutations were **proposed by twenty independent readers** and **applied by one
sequential harness**, because the proposer must not also be the judge. The harness
asserts its anchor occurs exactly once and refuses to write otherwise (R211),
proves the plant landed via `git diff --numstat` (R180), requires the test to be
**observed to run** — a `-t` matcher selecting nothing is INCONCLUSIVE, never a
pass (R133) — and restores the file before reading any result. The tree was
verified clean after all twenty.

**Result: 18 RED, 2 UNFALSIFIABLE-BY-MUTATION.**

A representative few, to show the mutations were real:

| # | Subject | Mutation |
|---|---|---|
| 1 | `lib/calc-engine/rules.ts` | `simplifiedBasisDays` 240 → 250 |
| 3 | `lib/calc-engine/warnings.ts` | `requestedTaxYear !==` → `===` |
| 5 | `lib/account/export.ts` | **added** `fcmToken` to the export payload |
| 13 | `lib/content/provisional.ts` | `employmentRate < FULL_TIME` → `>` |
| 18 | `lib/fr/faq.ts` | the social threshold swapped for the fiscal one |
| 20 | `tests/support/vocabulary.ts` | `/certifi(?!cat)/i` → `/certifi/i` |

Number 5 is the right shape for its test: the property is *the export never carries
the token*, so the mutation **adds** the forbidden thing.

**The two that could not be falsified are different kinds**, and both survived
adversarial challenge — two independent agents each, all four returning
UNFALSIFIABLE-CONFIRMED after attempting refutation.

**14 — `tests/unit/guides/typography.test.ts` → *"does not mistake the typographic
one for it"*.** The test is a self-test of a helper defined in the test file:
`elisions()` at line 139, called with two test-local constants. No product
mutation can reach it. **This one is correct as it stands.** Its own describe block
is named *"the elision detector works, **so the absence below means something**"* —
it is an R133 positive control for the block that scans real
`content/guides/*.mdx`. A control is supposed to be independent of the thing it
controls. Counting it as a defect would misread the one test in the sample that
exists to stop an absence assertion passing vacuously.

**17 — `tests/unit/params/schema.test.ts` → *"gives every param a documented
meaning"*. This one is a finding.** The assertion is a tautology under the
subject's own types: `PARAM_SCHEMA` is `Readonly<Record<ParamName, ParamSpec>>`, so
a missing entry is a **compile** error and the runtime assertion can never fire —
the test's own `?.` is dead code. `field` is `EngineField`, a closed union of
non-empty string literals, so `field.length > 0` holds for every legal value. And
the sharper half: **the name promises a *documented* meaning, but `ParamSpec` has
no description field at all.** The assertion checks the length of an engine field
*path*. Nothing anywhere checks that a human wrote down what a param means. The
name claims documentation and the code measures a string length — which is exactly
the defect the sample was drawn to look for.

*Static code-quality census — duplication, dead code, complexity hotspots, type
safety, and the ruling-register triage — see §9.*

---

## 8. The audit's own instrument

**Six times tonight a measurement produced a finding that was not there.** Every
one would have been reported as a defect. Every one was caught only by asking what
the **observable effect** should be, rather than what the symptom usually looks
like. R254 says an audit measures rather than reasons; these say an audit must also
check that it is measuring the right quantity.

| # | The false finding | What was actually wrong |
|---|---|---|
| 1 | *Three FCM credentials are declared and never read* — an operator handing over a real Firebase private key that nothing consumes | The grep demanded the literal `process.env.FCM_PROJECT_ID`. `lib/push/fcm.ts:113` reads `env.FCM_PROJECT_ID` where `env: EnvLike = process.env` is an **injectable parameter**, written that way so a test can supply a fake. The indirection is good design; the regex was too literal. |
| 2 | *CSV formula injection is defended* — "lines containing the formula: 0" | The formula had been planted in `User.name`, which **the CSV has no column for**, and an earlier probe had overwritten that name anyway. Two independent reasons for a false pass in one measurement, neither visible in its output. |
| 3 | *The magic-link endpoint is unrated and sends mail* — a mail-bomb and domain-reputation risk | It **is** limited, by address and by IP, and the route maps every refusal to 202 **so an attacker cannot tell them apart**. The limiter is invisible by design and I was looking for it by status code. |
| 4 | *The alert send does a sequential scan while the purge is indexed* | The plan was read off tables that had never been `ANALYZE`d. The planner estimated 9 rows where there were 2 609. After `ANALYZE`, both use the same index. |
| 5 | *Every injection shape is refused* — eighteen clean 400s | The payloads used `items:` where the schema says `entries:`. Every one was rejected for a field-name mismatch **before any injection content was examined**. The control caught it. |
| 6 | *Connections leak and never drain, 87 of 100* | Those 87 belonged to **my own vitest process**, which spawns 36 workers; they vanished when it exited. The container's genuine leak was found afterwards, by driving it with `curl` alone. |

Three of the six were caught by a **control** — a positive case asserted alongside
the negative one. That is R196's *both directions* rule, and it earned its place
three times in one session.

---

## 9. Static code-quality census

*Filled from the parallel census — see the section appended below.*

---

## 10. UNEXAMINED

This section is as valuable as the findings.

- **The Android client.** There is no `android/` directory; AN1–AN15 are unbuilt.
  Every claim about the API contract is a claim about the server's side of it.
- **Lighthouse and the throttled calculator.** `pnpm lighthouse` was not run this
  session. SPEC §21's LCP-on-slow-4G criterion remains unverified, as FW29 also
  recorded.
- **The visual baselines.** `test:visual` was not run; no baseline was regenerated,
  and none needed to be (R135/R207 do not arise).
- **Chromium killed mid-render, and the mailer made to throw.** Two of the four
  failure injections the prompt names were not performed. Postgres-stopped and
  render-queue-full were.
- **`EntryEvent` query plans at realistic multi-user selectivity.** The fixture
  gives one user every event, so its plans are not representative. Stated in §5.
- **Events orphaned by a concurrent delete.** The relation filter was rejected by
  Prisma; recorded as unmeasured rather than as zero.
- **Whether the six absent security headers would break any page.** They were not
  added, so nothing was measured about the consequences of adding them.
- **F-HALFDAY beyond the engine and the two render sites.** The chain was traced to
  `ResultPanel.tsx:198` and `releve/print/page.tsx:185`; no user-facing screenshot
  was taken.
- **Real-world data.** Every number here comes from a generated fixture. R197 kept
  each user coherent, but a fixture is not a population.

---

## 11. PARK30, by severity

| id | Finding | Severity |
|---|---|---|
| **PARK30-1** | **F-WRITE** — every transactional write fails in a production build; ~4 pools leaked per request; ~25 unauthenticated requests exhaust the database | **CRITICAL** |
| **PARK30-2** | **F-CI** — the container suite is structurally incapable of passing in CI (`reuseExistingServer: !process.env.CI` against a harness that starts the container on the same port). Main has been red for three pushes. | **HIGH** |
| **PARK30-3** | **F-CONTRACT** — `docs/api-v1.md` calls itself *"the contract with the Android client"* and *"FW23 freezes it"*, and omits 4 of the 13 v1 routes: `/export/pdf`, `/export/csv`, `/account/export`, `/account/delete`. A rename of the PDF route today breaches no frozen contract. | **HIGH** |
| **PARK30-4** | **F-PLATFORM** — `no-coordinates.ts:86` matches by substring, so `platform` contains `lat` and the documented device-registration body is refused `coordinates_refused`. `docs/api-v1.md:859` publishes that exact body; line 902 documents the error as `invalid_body`. | **MEDIUM** (high on contact) |
| **PARK30-5** | **F-EXPORT** — `lib/account/export.ts` is unbounded and unpaginated: 1.2 MB at ten years, plus unbounded event, device, session and reminder reads | **MEDIUM** |
| **PARK30-6** | **F-CONN** — `connection_limit` unset, pg-boss pool unsized, `docs/deploy.md` silent on the arithmetic while documenting per-replica schedulers | **MEDIUM** |
| **PARK30-7** | **F-RETRY** — a deterministic input-domain refusal (`DAYS_EXCEED_TOTAL`) is presented as HTTP 500 with *"l'application réessaiera"*, a retry that can never succeed. Reachable by a legitimate settings change. | **MEDIUM** |
| **PARK30-8** | **F-BLIND** — nothing reports "this instance cannot reach the database" | **MEDIUM** |
| **PARK30-9** | **F-AUDIT** — `docs/release-audit-web.md:205` claims *"Six CHECK constraints exist. Every one was fired"*; its own evidence block exercises **three**. `Entry_detectedKind_when_detected`, `DeviceSession_revoked_pair` and `SessionToken_consumed_after_created` were never fired. And REPORT-FW29 cites CI run `35974016195` as a precondition without recording that it **failed**. | **MEDIUM** |
| **PARK30-10** | **F-TAUTOLOGY** — `tests/unit/params/schema.test.ts` *"gives every param a documented meaning"* cannot fail, and its name claims documentation that `ParamSpec` has no field for | **MEDIUM** |
| **PARK30-11** | **Six security headers absent** — CSP, XCTO, Referrer-Policy, Permissions-Policy, HSTS, X-Frame-Options. `Permissions-Policy: geolocation=()` is the one that would make SPEC's central promise structural. | **MEDIUM** |
| **PARK30-12** | **F-HALFDAY** — a whole-day user with a non-integer 40 % ceiling is told *"0,5 jours restants"* when the takeable answer is 0, on the calculator **and** the printed Relevé. 57 of 167 year lengths produce it. | **LOW** |
| **PARK30-13** | **`/api/v1/auth/refresh` is unrated** — 30 attempts, zero 429s. Unbounded work per unauthenticated caller; not a guessing vector at 256 bits. | **LOW** |
| **PARK30-14** | **`postcss@8.4.31`** is the only vulnerable package in the production tree, via `next@15.5.25`, and only at build time | **LOW** |
| **PARK30-15** | **The render queue is per-process** — N replicas admit 2N concurrent renders and neither knows about the other | **observation** |
| **PARK30-16** | **`/releve/print` accepts a token minted for another user by design** — the token *is* the credential, so `AUTH_SECRET` leakage yields any user's dossier | **observation** |
| **PARK30-17** | **R209's consequence line is one table too broad** — `VerificationToken` has 25 call sites; the magic-link flow took it over. `Account` and `Session` are genuinely dead, and `lib/content/personal-data.ts:208` already says so. | **observation** |

---

## 12. The three that most deserve a task of their own

**PARK30-1 (F-WRITE), because the product does not work when deployed and the fix
is worthless without a test that runs a production build and writes; PARK30-2
(F-CI), because it is the only place such a test could run and it has never once
passed; and PARK30-3 (F-CONTRACT), because the Android client is the next thing to
be built and it will be built against a document that is both wrong where it speaks
and silent about a third of what it governs.**

---

## 13. Could this launch tomorrow?

**No, and unlike FW29's answer the obstacle is now the software.** FW29 concluded
that every technical criterion this codebase owns was met and the single largest
obstacle was that `monreleve.ch` does not exist. That remains true. But a product
that cannot record a day cannot launch at any domain, and the audit that certified
it was reading a suite that runs in the one environment where the defect does not
occur.
