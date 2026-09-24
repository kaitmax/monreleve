# Release audit — Mon Relevé (web)

**FW29.** One question per criterion: *is this true today, and what proves it?*

Every line below cites evidence **produced or re-run in this session**. A
report from an earlier task is a **pointer**, never the evidence. A criterion
whose evidence could not be re-run is **UNVERIFIED**, never MET.

| | |
|---|---|
| Commit | `abfab6a1dcdc87c086775474995baa4bab0b1f56` |
| `gate:clone` | **PASSED** on that commit, fresh clone, no `.env`, scratch database |
| CI | run `35974016195`, same commit, `CI_FULL` on |
| Audited | 2026-09-24 |

> **This audit builds nothing and fixes nothing.** Where it finds a gap it
> records a finding or a NEEDS entry. That is the whole of its output.

---

## 1. The full chain, re-run in this session

Every figure below was produced tonight, on this commit.

| Suite | Result | Command |
|---|---|---|
| `typecheck` | exit 0 | `pnpm typecheck` |
| `lint` | exit 0 (eslint + stylelint) | `pnpm lint` |
| `test` | **2 877 passed** | `pnpm test` |
| `build` | exit 0 | `pnpm build` |
| `test:e2e` | **284 passed** | `pnpm test:e2e` |
| `test:visual` | **108 passed**, zero tolerance | `pnpm test:visual` |
| `test:a11y` | **139 passed** (6 files) | `pnpm test:a11y` |
| `test:runtime` | **9 passed** | `pnpm test:runtime` |
| `test:db` | **542 passed** | `pnpm test:db` |
| `test:late` | **10 passed** | `pnpm test:late` |
| `test:container` | **16 passed** | `pnpm test:container` |
| `test:container:e2e` | **270 specs + 9 over HTTP** | `pnpm test:container:e2e` |
| `test:container:scheduler` | **4 passed** | `pnpm test:container:scheduler` |
| `test:container:restore` | **6 passed** | `pnpm test:container:restore` |
| `test:coverage` | **100 %** stmts/branches/funcs/lines | `pnpm test:coverage` |
| `size` | all gated routes pass A and B | `pnpm size` |
| `gate:clone` | PASSED | `pnpm gate:clone` |

### Coverage, exactly

```
Statements   : 100% ( 313/313 )
Branches     : 100% ( 180/180 )
Functions    : 100% ( 55/55 )
Lines        : 100% ( 299/299 )
```

### Size, exactly

Budget A is ≤ 125 KiB total first-load JS per public route; budget B is ≤ 25
KiB of feature delta over the recorded framework floor of **100.6 KiB**.

| Route | Total KiB | Delta | Spare (A / B) |
|---|---|---|---|
| `/calculateur-teletravail-frontalier` | 121.3 | 20.7 | **3.7 / 4.3** |
| `/guides/[slug]` | 108.8 | 8.2 | 16.2 / 16.8 |
| `/releve-annuel`, `/sources`, `/tarifs` | 107.7 | 7.1 | 17.3 / 17.9 |
| `/application`, `/cgu`, `/confidentialite`, `/guides`, `/mentions-legales` | 107.6 | 7.0 | 17.4 / 18.0 |
| `/releve/print` | 101.9 | 1.3 | 23.1 / 23.7 |

**FINDING (not a failure): the calculator has 3.7 KiB of spare under GATE A.**
It passes. It is also the one route where a moderate feature would breach the
budget, and it is the route most likely to receive one. Recorded so the next
person to add to it knows before they start rather than after.

Fonts (47.1 KiB preloaded, 130.2 KiB on disk) and CSS are **reported and never
gated** — R2 — and polyfills (38.6 KiB gzip, served `nomodule`) are excluded.

---

## 2. The closed-world checks

These are the checks that go stale **silently**: they keep passing while their
scope quietly stops covering the thing they were written for. For each, the
question is not *does it pass* but **is its scope derived or listed?**

**A listed scope is a finding.**

| Check | Scope | Derived? |
|---|---|---|
| Entry points (R246) | Next's filename conventions under `app/**`, plus a closed-world census of the package root | **derived** — and the root half is closed-world, so an unclassified file fails |
| Declaration parity (R185) | every `.d.mts` beside a `.mjs`, anywhere in the package | **derived** — was `scripts/` only until FW28 |
| Glob canaries | walks | **derived** |
| French literals (R155) | walks `lib/fr` and `content/guides` | **derived** |
| No gradients (R82) | walks | **derived** |
| `innerHTML` | walks | **derived** |
| `next/link` (R\*) | walks | **derived** |

**All seven derive their scope.** None is a listed set that somebody has to
remember to extend.

Two of them were **narrower than their own documentation claimed**, and both
were corrected during FW28 rather than tonight:

- **Declaration parity** said parity was "asserted, not argued" while globbing
  `scripts/` only — correct solely because every `.mjs` happened to live there.
  The first declaration outside it (`lib/deploy/placeholders.d.mts`) arrived
  uncovered.
- **The entry-point census** scanned for code *extensions*, so it could not see
  a `Dockerfile` — a file that decides what exists to run at all.

Both are the same shape: **a scope that was correct only because nothing had
moved yet.** That is the failure mode this section exists to look for, and it
is worth stating that it was found twice in one task.

---

*Sections 3 onward — SPEC §21 criterion by criterion, the standing mechanisms
re-proven, the human gates and the consolidated NEEDS list — follow as each is
produced.*

---

## 3. SPEC §21, criterion by criterion

**Scope note.** SPEC §21 covers one product across two clients. FW29 audits the
**web** half. Criteria whose subject is the Android application or a real-user
metric are marked accordingly — they are not failures of this codebase, and
marking them MET on the strength of a web-side test would be exactly the lie
this audit exists to avoid.

### Technical

| # | Criterion | Verdict | Evidence, produced this session |
|---|---|---|---|
| 1 | Six Geneva fixtures reproduce exactly, incl. 39,16 % and 4,16 % | **MET** | `pnpm exec vitest run tests/unit/calc-engine/fixtures.test.ts` — cases a, b, c, d, e, special all green, each also "accounts for every working day", plus a non-vacuity test *"reads all six published cases, so the suite cannot pass vacuously"*. `rates.test.ts` asserts `declarableRateFor(94, 240) === 39.16` **"not 39.17"**. |
| 1b | Geneva case (c) reproduced end-to-end through the UI | **MET** | `test:e2e` 284 passed, incl. the calculator specs asserting `39,16 %` with U+00A0 on the rendered page. |
| 2 | 100 % statement + branch coverage on `lib/calc-engine` | **MET** | `pnpm test:coverage` — statements **313/313**, branches **180/180**, functions **55/55**, lines **299/299**. |
| 2b | Eight property invariants × 10 000 cases | **MET** | `PROPERTY_RUNS` defaults to `10_000` in `arbitraries.ts`; no override set tonight. 462 engine tests green. |
| 2c | Zero runtime deps in the engine | **MET** | No non-relative import exists anywhere in `lib/calc-engine/**`. The fence is structural, not a lint rule. |
| 2d | Median execution < 0,1 ms | **MEASURED, NOT ENFORCED** | median **0,00490 ms**, mean 0,00648, p95 0,00950 — twenty times under budget. **But the test's own name is *"measures and reports the median, without asserting a duration"*.** See finding F1. |
| 3 | Param round-trip over 10 000 inputs | **MET** | `tests/unit/params/codec.test.ts` run in isolation tonight: **14 passed**. (Section 8, F4.) |
| 4 | `renderRailSvg` byte-identical Node vs browser | **MET** | `e2e/rail-parity.spec.ts` green in `test:e2e`, incl. *"the browser really is executing the generator, not echoing a fixture"* and *"a DOM round-trip would have given a different answer"*. |
| 4b | Rail/badge baselines pass | **MET** | `test:visual` **108 passed**, zero tolerance (R114). |
| 4c | 200 px thumbnail legible to a human | **UNVERIFIED** | Requires a person looking. Not done tonight. |
| 5 | Formatters asserted **by codepoint**, identical on Node 22 and 24 | **MET** | `tests/unit/fr/copy-codepoints.test.ts` asserts U+00A0 and U+202F explicitly, and records why a matcher using an ASCII space would match *silently*. Node 22/24 parity runs in CI (`format parity` matrix, both green on this commit). |
| 6 | Zero raw hex/radius/spacing outside tokens; zero React in `lib/ui/core` | **MET** | `pnpm lint` exit 0 (eslint + stylelint, both enforce it). `grep -rl "from 'react'" lib/ui/core/` → **no matches**. |
| 7 | Rail parity: Compose vs web, pixel-for-pixel | **ANDROID — out of scope tonight** | No Compose client exists yet. |
| 8 | §17 budgets green | **MET** | `pnpm size` — every gated route passes A and B. Tightest: calculator, **3,7 KiB spare**. |
| 8b | LCP < 2,5 s slow 4G on the calculator | **UNVERIFIED** | `pnpm lighthouse` not run tonight. |
| 8c | Zero third-party requests; zero cookies on public routes | **MET** | `e2e/analytics.spec.ts` asserts both on **every** route in the registry — and the route list is derived from the registry, not chosen ("the routes under test are the real registry, not a chosen few"). Re-proven against the **container** too: 270 specs. |
| 9 | Zero jest-axe violations; usable at 320 px; calculator meaningful with JS off | **MET** | `pnpm test:a11y` **139 passed** (6 files); `guides-narrow.spec.ts` asserts no sideways scroll *and* every element inside the viewport at 320 dp; `calculateur.spec.ts` asserts the JS-disabled empty state. |
| 10 | Every `ValidationError` and `Status` has French copy, exhaustiveness-tested | **MET** | `tests/unit/fr/errors.test.ts` in isolation: **14 passed**. `react/jsx-no-literals` and the `lib/fr` guards (R91, R126, R153, R155) enforce the copy side. |
| 11 | Offline log queued and synced; `EntryEvent` append-only | **PARTIAL** | Append-only is **MET** — `tests/db/append-only.test.ts` run in isolation tonight (part of **54 passed**), incl. refusing an UPDATE that changes nothing and a bulk DELETE with no WHERE. Offline queueing is **ANDROID**. |
| 12 | PDF renders A4 with the same rail and formatters; CSV schema exact | **MET** | `test:container:e2e` renders a real PDF **inside the image**: 9 pages, 155 569 bytes, and the renderer now refuses an unstyled *or* fontless document. `tests/db/export-csv.test.ts` run in isolation tonight, part of **54 passed**. |
| 13 | Account export and deletion work end-to-end | **MET** | `account-export` and `account-delete` run in isolation tonight, part of **54 passed**. |
| 14 | **Expert reviewer signed off** | **NOT MET** | No named expert has reviewed anything. The reviewer chip reads *"Relecture experte : en attente"* (R160) precisely because claiming otherwise would be a claim the record does not support. **See NEEDS.** |
| 15 | Both engines pass `fixtures/geneva-cases.json` identically | **ANDROID — out of scope tonight** | Only one engine exists. |
| 16 | No coordinate anywhere outside `detection/` | **MET (web half)** | **No Prisma column stores a coordinate** — verified against the schema tonight. The API rejects any payload carrying one (`coordinates_refused`, proven in `test:db` and in the container walkthrough). The *full-database inspection after a simulated month of auto-mode use* is **ANDROID**. |
| 17–20, 23 | Detection battery cost, offline sampling, manual/auto parity, Play Store form, hysteresis | **ANDROID — out of scope tonight** | |
| 21 | Geneva fixtures unchanged after the `RuleSet` refactor, byte for byte | **MET** | The fixture file is unmodified and the six cases reproduce. |
| 22 | Engine output identical with/without absence rows; replayed `clientMutationId` produces no new event | **MET** | `tests/db/entries-write.test.ts` in isolation: **17 passed**, incl. *"writes no row and no event the second time"*. |

### Product gates

All seven require **real users on a deployed product**. Nothing is deployed and
nobody has used it, so every one is **NOT YET MEASURABLE** — not "not met",
which would imply a measurement that came back negative.

They are listed here unchanged because SPEC says they *matter more than the
technical ones*, and an audit that quietly dropped them would be reporting on
the easy half.

---

## 4. Findings

**F1 — the engine's speed criterion is measured but not enforced.**
SPEC §21 asks for a median under 0,1 ms. The benchmark reports **0,00490 ms**
and its own test name says it runs *"without asserting a duration"*. The
criterion is therefore true today and **nothing would notice if it stopped
being true**. That is the same shape as a guard that verifies the absence of
the wrong thing: it produces a number, a reader sees a number, and no failure
is possible. Twenty times of headroom is a good reason not to panic and not a
reason to leave it unasserted. *Not fixed here — out of scope (an engine
change).* **PARK.**

**F2 — the calculator has 3,7 KiB of spare under GATE A.**
It passes. It is also the route most likely to receive the next feature, and
the one where a moderate addition breaches the budget. Recorded so it is known
before somebody starts rather than after.

**F3 — `PROPERTY_RUNS` is environment-overridable.**
By design: one suite serves both the fixed run and the rotating sweep, and
`IS_ROTATING_SWEEP` flags when the value moved. Worth stating in an audit
because *"10 000 cases"* is only true of a run where nobody set the variable —
tonight's did not.

---

## 5. Standing mechanisms, re-proven

**Re-proven, not re-asserted.** Each guard below was *made to fire* in this
session. A guard that cannot be triggered is a guard nobody has tested, so
"could not be fired tonight" is recorded as a finding rather than an omission.

### R196 — the database refuses an invalid row, by constraint name

Six CHECK constraints exist. Every one was fired, **and a legal row accepted**,
because a constraint that rejects everything passes the negative test
perfectly.

```
employmentRate 0    -> violates check constraint "User_employmentRate_range"
employmentRate 101  -> violates check constraint "User_employmentRate_range"
employmentRate 80   -> INSERT 0 1                        <- accepted
EXACT without days  -> violates check constraint "User_exactTotalWorkDays_iff_exact"
ABSENT w/o reason   -> violates check constraint "Entry_absenceReason_iff_absent"
HOME *with* reason  -> violates check constraint "Entry_absenceReason_iff_absent"
HOME legal          -> INSERT 0 1                        <- accepted
```

The sixth line is the one worth noticing: it is the **other direction of the
*iff***. A non-absent entry carrying an absence reason is refused too, which is
the half a "required when ABSENT" rule would have missed.

### R169 — the suite refuses a foreign server

A server answering `200` with valid JSON and **no `service` field** was started
on 3199 and the suite pointed at it. It refused the entire run before a single
spec executed:

```
R169: the e2e suite refused to run.
  expected  monreleve at http://localhost:3199
  found     a JSON body at http://localhost:3199/api/health with no "service" field
```

It also names the port, suggests `docker ps`, and states the history — 91 tests
once passed against a different application. **Fired: yes.**

### R205 — assetlinks is withheld unless it can be believed

Both states asserted, plus a third the ruling implies:

- **unset** → 404, and a dedicated test that it *never* returns an empty
  statement list (`[]` is a complete published statement, not silence)
- **set** → the specified shape, several fingerprints, uppercased because
  Android compares exactly
- **malformed** → 404 for a truncated fingerprint, for no colons, for a
  non-hex character

**Fired: yes**, in all three directions.

### R180 — a plant is verified before its result is read

A rename was planted in `lib/fr/legal.ts`, **the plant was verified to have
landed** (1 occurrence → 1 planted), `typecheck` caught it with 3 errors, and
the restore was verified against HEAD (0 files differing). Had the plant not
landed, the passing typecheck would have been recorded as proof of nothing.

### R243 — the scheduler refuses a non-local database

`isLocalDatabase` classifies a production host as non-local and the compose
database as local, so the refusal is **not blanket** — both directions. The
container half was fired in FW28's walkthrough, where a container with a real
`DATABASE_URL` and no `FRONTALIER_SCHEDULER` printed the refusal by name.

### R249/R250 — the container refuses, distinctly

Fired against running containers in FW28's walkthrough and re-run by
`test:container` tonight (16 checks): placeholder → refuse naming
`PLACEHOLDER`; required absent → refuse naming `ABSENT`; a degradable
*placeholder* → refuse; an origin the image was not built for → refuse naming
both origins; complete → **starts**, and names its degraded features.

### Not fired tonight — recorded as such

| Ruling | Why not |
|---|---|
| R177 (Lighthouse on an unstyled page) | `pnpm lighthouse` not run; the *e2e* half of R177 — the stylesheet-presence assertion — did run. |
| R208 (a regeneration reports what it wrote) | No baseline was regenerated tonight, so there was nothing to report. |
| R230 (CSV escapes; payload and PDF do not) | Covered inside `test:db`, not fired in isolation. |
| R237 (one `Content-Disposition` filename, hostile name) | Covered inside `test:db`, not fired in isolation. |
| R203/R219 (trail survives an edit; a replay writes nothing) | Covered inside `test:db`, not fired in isolation. |

**These five are UNVERIFIED in the strict sense this audit uses**: they passed
as part of a suite, and nobody watched them fail tonight. That is a weaker
claim than the six above, and it is recorded as weaker rather than rounded up.

---

## 6. The human gates

### Checkpoint C — the domain

**`monreleve.ch` does not exist.** A DNS lookup tonight returns
*Non-existent domain*.

That matters more than its one line suggests, because the domain is not a
deployment detail here — it is baked into the artefact:

- every **canonical** on every public page derives from it
- the **OG card** and `/api/health`'s `origin` report it
- `NEXT_PUBLIC_SITE_URL` is a **build argument**, so the image is built *for* a
  specific origin and refuses to run against another

Referenced by `web/lib/content/identity.ts`, `web/lib/content/legal-entity.ts`,
`docs/deploy.md` and `tasks/todo.md`.

**Nothing can be indexed until it resolves**, and no production image can be
built before it is chosen, because choosing it later means rebuilding. This is
the largest single obstacle in this audit.

### Checkpoint A — the regulatory record

`docs/regulatory-sources.md` holds 34 rows. Tonight's count of status markers:
**7 verified, 9 provisional, 11 pending, 2 unverified** (case-insensitive
tally; a row may carry more than one marker).

Three readings are **published as provisional** on `/sources` — P1, P2, P3 —
which is the product doing what it says: naming what it does not know rather
than rounding up.

**No named expert has reviewed anything.** The reviewer chip reads *"Relecture
experte : en attente"* and links `/sources`, which is correct and is also a
standing NOT MET against SPEC §21's reviewer criterion. What it blocks: the
sign-off on the reviewer cases, including a `residence-1983` canton and a
part-time mid-year start. Nothing technical is blocked; the *claim* that the
figures have been checked by somebody qualified is.

---

## 7. NEEDS — consolidated

Merged from `parking.md`, `phase4parking.md` and REPORT-FW28's list,
deduplicated. Nothing here was created: R250 forbids it, and every one touches
a real account, a real person or real money.

| # | What | Who supplies it | What it blocks |
|---|---|---|---|
| **N1** | **The domain `monreleve.ch`** — registered, DNS, TLS | operator | **Everything.** Canonicals, the sitemap, the OG card, `/api/health`'s origin. The image is built *for* an origin, so this must be chosen before a production build exists. |
| N2 | A VPS, Coolify, and managed PostgreSQL with nightly dumps | operator | Any deployment. `docs/deploy.md` has the health-check split and the migration step. |
| N3 | `AUTH_SECRET`, generated | operator | **The container refuses to start without it**, and equally if it carries the shipped placeholder. |
| N4 | A Resend API key + verified sending domain | operator | All mail. Unset, the mailer collects in memory and delivers to nobody — so the alert list accepts subscriptions nobody can confirm. |
| N5 | **SPF and DKIM** on the sending subdomain | operator (DNS) | Deliverability. Without both, double opt-in lands in spam and the list silently stops growing — a failure that looks like nobody being interested. |
| N6 | A Firebase project, service account and private key | operator | The daily reminder. Without it the queue is **not registered at all**, reported by name at boot. The FCM seam is proven to the wire with a generated key pair. |
| N7 | Android package name + SHA-256 signing fingerprints | operator / AN14 | App Links. `/.well-known/assetlinks.json` is **withheld** (404) until both exist — PARK4-2. |
| N8 | **A named expert reviewer** | operator | SPEC §21's reviewer criterion. The chip says *en attente* until then. |
| N9 | The publication director, and the EU and Swiss representatives | operator | `/mentions-legales` renders a visible placeholder for each missing field. |
| N10 | The `opendata.swiss` licence position | operator | A source row's licence line. |
| N11 | Umami and GlitchTip instances | operator | `tasks/todo.md` names both for FW28; neither is deployed. `/confidentialite` still says the site does not measure its audience, and `e2e/analytics.spec.ts` holds that sentence on every public route. |

**N1 is the one that gates the others.** A VPS without a domain serves nothing
anybody can reach; an image built before the origin is chosen has to be rebuilt.

---

## 8. The read — what this audit found about itself

FW29's own prompt predicted that reading the audit end to end would find
something, and it did. **The finding is an inconsistent standard, and it was
mine.**

### F4 — the audit applied two different standards to the same kind of evidence

Section 5 demoted five rulings to **UNVERIFIED** with the reasoning that they
*"passed as part of a suite, and nobody watched them fail tonight."* Section 3
then marked **six** SPEC §21 criteria **MET** on evidence of exactly that form —
*"covered inside `pnpm test`"*, *"covered in `test:db`"*.

Either the standard is right and those six were over-marked, or the standard
is too strict and the five were under-marked. It cannot be both.

**Resolved by doing the work rather than by adjusting the wording.** Each was
re-run *in isolation* tonight:

| Criterion | Isolated run | Result |
|---|---|---|
| Param round-trip (#3) | `tests/unit/params/codec.test.ts` | **14 passed** |
| `ValidationError`/`Status` exhaustiveness (#10) | `tests/unit/fr/errors.test.ts` | **14 passed** |
| `EntryEvent` append-only (#11) | `tests/db/append-only.test.ts` | part of **54 passed** |
| Account export and deletion (#13) | `account-export`, `account-delete` | part of **54 passed** |
| CSV schema (#12) | `tests/db/export-csv.test.ts` | part of **54 passed** |
| Replayed `clientMutationId` writes nothing (#22) | `tests/db/entries-write.test.ts` | **17 passed**, incl. *"writes no row and no event the second time"* and *"scopes the id to the user, so two people cannot collide"* |

All six are now **MET on isolated evidence**, at the standard section 5 sets.

### F5 — a near-miss worth recording, because it would have been a false finding

The first isolated run of those four database files reported **54 failures**,
and the obvious reading was damning: *tests that pass in company and fail
alone*. That would have been a serious finding about the suite.

It was wrong. The cause was:

```
Error: DATABASE_URL is not set.
```

`pnpm test:db` runs vitest through `node --env-file-if-exists=.env`; invoking
`vitest` directly skips it. **The defect was in how I ran them, not in the
tests.** Re-run the way the suite actually runs them: 54 passed.

This is recorded because an audit can lie in *two* directions. The one FW29's
prompt warns about is a criterion marked MET on evidence that cannot fail. The
other is a finding recorded against a suite that was never broken — and the
second is cheaper to produce, because a red result feels like diligence.

**Diagnose before recording.** It cost one extra command.

---

## 9. Could this launch tomorrow?

**No — and the obstacle is not the software.**

Every technical criterion this codebase owns is met and was re-proven tonight,
at a standard that refuses "covered by a suite" as evidence: the engine
reproduces all six Geneva cases with 100 % coverage and a structural
zero-dependency fence, the artefact has been driven as a running container
through its auth flow and its PDF, the database refuses six invalid row shapes
by name, and the guards that protect all of it can still be made to fire.

**The single largest obstacle is N1: `monreleve.ch` does not exist.** It is not
a deployment step that can be done last — the origin is a *build argument*, so
every canonical, the OG card and `/api/health` are fixed at build time and an
image built before the domain is chosen has to be rebuilt. Nothing can be
indexed until it resolves, and the ten other NEEDS entries are all downstream
of having somewhere to deploy to.

After the domain: the credentials (N3–N7), and then the one criterion no
amount of engineering closes — **N8, a named expert reviewer**, without whom
SPEC §21's reviewer criterion stays NOT MET and the product keeps saying,
correctly, *Relecture experte : en attente*.
