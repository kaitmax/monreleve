# frontalier

A French-language product for cross-border workers who live in France and work in Switzerland. It answers one expensive question — *how many telework days do I have left before the 40 % fiscal threshold and the 49,9 % social-security threshold?* — and produces the document that proves the answer: the **Relevé annuel de télétravail**, an audit-defensible PDF in which every recorded day carries a server-assigned timestamp and its provenance.

One backend, two clients:

| Client | Role | Stack |
|---|---|---|
| **Web** (`web/`) | Public, anonymous acquisition surface: calculator, LAMal/CMU comparator, guides, alert list, app landing page. No signed-in area. | Next.js 15, TypeScript strict, Sass + CSS tokens, MDX |
| **Backend** (inside `web/`) | API `/api/v1`, database, dossier computation, PDF, jobs. Authority for timestamps and the document. | Prisma + PostgreSQL, passwordless magic link built here (R209 - no Auth.js), pg-boss, FCM, Playwright/Chromium for PDF |
| **Android** (`android/`) | The app: daily logging (manual, or location detection that *proposes* and the user confirms), calendar, dossier, exports. | Kotlin, Jetpack Compose, Room, WorkManager |

iOS is designed (see `prompts/design-frontier/`) but is **not** in the launch scope.

---

## Read these, in this order

| # | File | What it is |
|---|---|---|
| 1 | **`SPEC-frontalier-web.md`** (v2.2) | The product and technical specification. Normative. §2 lists every decision D1–D40 with its rationale; §7 is the calculation engine; §8 the data model; §13 the detection model; §20 the boundaries (Always / Ask first / Never); §21 the success criteria. |
| 2 | **`DESIGN-SYSTEM.md`** | Frontier Work v1.0 as adapted for this product. §1 is the token block; §2 the product overrides that bind every UI task (no map, no live location, tier in words, four screens, manual mode is a peer). |
| 3 | **`tasks/plan.md`** | Phases, checkpoints, human gates, risks, Definition of Done, and the three disciplines (Execution, Test, UI). |
| 4 | **`tasks/todo.md`** | The 45 tasks — FW1–FW29 (web + backend) and AN1–AN15 (Android) — each with acceptance criteria, verification commands, dependencies, files, scope. |
| 5 | `docs/regulatory-sources.md` | Primary sources for every constant in the engine. Created in FW3; frozen at Checkpoint A. |
| 6 | `prompts/design-frontier/FD1–FD13` | The design prompts (Claude Design) for every screen. Reference for what a screen must contain; the spec wins on any conflict. |
| — | `relay/` | Session prompts for Claude Code, one per task, plus the phase runbooks. |

If any of files 1–4 is missing, stop and say so before writing code.

---

## How work happens here

This repository is built by Claude Code in **one task per session**, driven by prompts in `relay/`. The rules below are the standing protocol; they are restated at the top of every session prompt and are not optional.

**1. One task per session.** The task is named in the prompt (e.g. `FW1`). Nothing outside it is touched. Anything noticed outside scope goes in the report under *NOTICED BUT NOT TOUCHING*.

**2. Increments.** Each task is executed as ordered increments — implement → test → verify → commit → push. The project builds and existing tests pass after **every** increment. Never more than ~100 lines uncommitted.

**3. Test-first.** New behaviour gets its failing test before the code (RED), then the minimum to pass (GREEN), then refactor with tests green. Bug and bounce fixes start with a reproduction test that fails before the fix and passes after — both runs shown in the report.

**4. Commit only on green. No exceptions.** A commit happens only when `typecheck`, `lint`, `test`, and `build` all pass on the increment. If an increment cannot reach green, it is not committed: revert or stash, and report the blocker. **A red commit is a bounce.**

**5. Commit format.** `FW<N>: <increment title>` / `AN<N>: <increment title>`. Push after every increment; the push output goes in the report.

**6. Simplicity and scope.** The naive, obviously-correct version first. No abstraction before the third use. No cleanup of adjacent code.

**7. Questions.** Anything on the spec §20 *Ask first* list, or any ambiguity: pause the increment, ask the operator, and record the ruling **verbatim** in the report. Never decide unilaterally, never deviate silently.

**8. Report.** Each session ends by writing `REPORT-<task>.txt` at the repo root (pure ASCII, committed, pushed): summary, environment, per-increment evidence (files, trimmed command output, commit hash), proofs required by the task, deviations, noticed-but-not-touching, questions, push proof. The session is not done until the report exists.

**9. Definition of Done** (`tasks/plan.md`) applies to every task on top of its own acceptance criteria: lint clean, typecheck clean, tests green, build clean, budgets green, strings only in `lib/fr` / `fr/`, tokens only, UI states (loading / empty / error) present, `/dev/composants` entry and screenshot baseline for any UI change.

**10. Design tokens are law.** No raw hex, radius, or spacing outside `DESIGN-SYSTEM.md`. Lint enforces it on both clients from FW1 / AN1 onward.

Pure ASCII applies to relay prompts and reports, **not** to code — source files contain accented French where the product requires it.

### The gate is the CI command (ruling R94)

```
pnpm gate          # exactly what CI runs, in CI's order
pnpm test:clean-tree   # test:coverage with public/ moved aside
```

**`pnpm gate` is not a convenience alias.** It is the same command set as
`.github/workflows/ci.yml`, in the same order, and running anything *else*
before a commit is how five consecutive red commits reached `main` during
FW10: the local gate ran `pnpm test` and CI ran `pnpm test:coverage`. They
agreed on every prior task, and the day they disagreed nothing local said so.

**`pnpm test:clean-tree` is required before any commit that changes how a test
reads the filesystem** — a new walker, a new root, a new `readFileSync` of a
path outside `lib/`. It moves `web/public` aside and runs the suite, because
`public/` is generated by `scripts/copy-fonts.mjs` and **is not tracked by
git**: a test that reads it passes on any machine that has ever built, and
throws `ENOENT` during module evaluation in a fresh checkout — which reports
"0 test" and fails the run without naming a single assertion. The script
restores the directory in a `finally` and verifies the restore before
propagating the exit code.

The visual and Lighthouse suites stay outside `pnpm gate` because each needs
something the others do not — the Playwright container (R37) and a served
build. Run `pnpm test:visual` after **any** change to markup, copy or tokens:
a copy edit is a visual change, and so is a metric one.

---

## Non-negotiables to carry in your head

- **The engine reproduces the Geneva tax administration's worked examples exactly**, including their rounding (39,16 % and 4,16 %). Fixtures live in `fixtures/geneva-cases.json` and are consumed by both the TypeScript and the Kotlin engine. If a fixture fails, nothing ships.
- **Timestamps are server-assigned.** No API path accepts a client `recordedAt`. The audit table `EntryEvent` is append-only.
- **The app never records a day by itself.** Detection proposes; the user's tap creates the entry.
- **No coordinate is ever stored, logged, or transmitted.** Country is determined on-device against a bundled border polygon and the fix is discarded. The API rejects any payload carrying one.
- **Manual mode is a peer.** Identical dossier, no nagging, no "recommandé".
- **No map, no live location, no movement timeline, anywhere.**
- **Never claim more than the record supports.** *Déclaré, enregistré, horodaté* — never *certifié, attesté, conforme*.
- **French only**, one locale, no i18n abstraction.

---

## Stack quick reference

**Web / backend** — Node 22, pnpm ≥ 9.

### Environment (ruling R81)

Nothing is required to run locally. Two variables matter in a container:

| Variable | Local | Container | What it does |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | unset | **required** | The absolute site origin, scheme and no trailing slash. Unset falls back to `http://localhost:3000`, which reads as *undecided* rather than as a claim — the domain is an open question gated at Checkpoint C. A malformed value (a bare hostname, a path, a non-http scheme) throws rather than silently producing relative URLs. |
| `FRONTALIER_RUNTIME` | unset | **`1`** | Marks *this process is serving*. Set only by FW28's runner stage. |

Together they close a gap that `NODE_ENV` cannot. `next build` sets
`NODE_ENV=production` too, so a guard keyed on it fires during every local
build — which publishes nothing. An earlier version did exactly that and broke
`pnpm build`, which is part of the Definition of Done.

With the marker set and the origin unset, a *serving* process returns **503**
from `/sitemap.xml`, reports **`degraded`** from `/api/health`, refuses
readiness with **503** from `/api/ready`, and **omits canonicals**. Each is the
safe failure rather than the quiet one: a sitemap of localhost URLs is
well-formed XML that indexes nothing and trips no other gate, and a canonical
pointing at localhost is worse than no canonical at all, because a crawler
treats it as an *instruction* rather than as an absence.

### Liveness and readiness are different endpoints (ruling R83)

| Endpoint | Meaning | Degraded origin | Who reads it |
|---|---|---|---|
| `/api/health` | **Liveness** — the process is answering | **200**, `status: "degraded"`, reasons in the body | a restart policy |
| `/api/ready` | **Readiness** — send traffic to this version | **503**, the failing check named | FW28's Coolify *deploy* health check |

The split is not pedantry. Health returning 200 while degraded means a deploy
could go live with no sitemap and no canonicals, because the orchestrator sees
a healthy container. The obvious fix — make health 503 — is worse than the
problem: an orchestrator **restarts** what fails liveness, and a restart cannot
supply a missing environment variable, so the container would loop while the
previous version stayed down. Failing *readiness* stops the deploy and leaves
the running version serving, which is the outcome anyone would want.

`/api/ready` reports a **list of named checks**, passing ones included, because
a deploy log that shows which checks ran is what makes it possible to notice
one silently ceasing to be evaluated. Today there are two: **site-origin** and
**database** (R353).

The **database** check passes only when the database is both REACHABLE (a
`SELECT 1` inside 2 s) and MIGRATED (every migration this build ships is
recorded finished in `_prisma_migrations`, none rolled back). Either half
failing returns 503, which stops a deploy and leaves the running version up.
It reports one of four codes - `unreachable`, `timeout`, `unmigrated`,
`migration_failed` - and **never** the driver error, the host, the port or a
migration name: `/api/ready` is unauthenticated, so the detail goes to the
server log instead (R354).

| code | what the operator does |
|---|---|
| `unreachable` | start the database service; check `DATABASE_URL` resolves from inside the container |
| `timeout` | the database is slow or unreachable across the network; it may still be starting |
| `unmigrated` | run `prisma migrate deploy` (docs/deploy.md section 4), then redeploy |
| `migration_failed` | a migration is recorded rolled back; resolve it against the database before serving |

Outside a serving process the database check is **not evaluated** rather than
passed: it stays in the list with `ok: null`, so `pnpm build` and CI still
need no database (R355) and a check that stopped running cannot hide as a
pass.

The site still serves — degraded is not broken. Build-time fallback stays, so
`pnpm build` and CI need no environment, and `/api/ready` answers **200** there
(a readiness check that failed in CI would block the pipeline for a condition
that publishes nothing). Proof: `pnpm test:runtime` for the degraded direction,
`pnpm test:e2e` for the healthy one.

```
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # Next.js production build
pnpm typecheck      # tsc --noEmit, strict + noUncheckedIndexedAccess
pnpm lint           # eslint (boundaries, jsx-no-literals) + stylelint (tokens only)
pnpm test           # vitest — unit + property
pnpm test:e2e       # playwright
pnpm test:visual    # screenshot baselines
pnpm test:a11y      # jest-axe
pnpm size           # first-load JS budget: public routes <= 100 KB gzip
pnpm lighthouse     # LCP < 2.5 s slow 4G on the calculator
pnpm prisma migrate dev / pnpm db:seed
```

Workbench: `/dev/composants` — every component, every state. No Storybook.

**Android** — Kotlin, Compose, minSdk 26, JDK 17.

```
./gradlew assembleDebug ktlintCheck detekt
./gradlew test                       # unit + Kotest property (engine conformance)
./gradlew connectedDebugAndroidTest  # Compose UI tests
./gradlew verifyPaparazziDebug       # screenshot baselines
./gradlew bundleRelease
```

**Shared** — `fixtures/geneva-cases.json`: both CIs consume this one file; a divergence on any case fails both builds.

---

## Repository layout

```
frontalier/
  README.md  SPEC-frontalier-web.md  DESIGN-SYSTEM.md
  tasks/          plan.md  todo.md
  relay/          PHASE-<n>.md runbooks, FW<N>.txt / AN<N>.txt session prompts
  prompts/        design-frontier/  (FD1–FD13)   design/ (superseded Carbon series, kept for history)
  fixtures/       geneva-cases.json            (created FW4, frozen Checkpoint A)
  docs/           regulatory-sources.md  detection-model.md  deploy.md  perf-spike.md  release-audit-*.md
  web/            Next.js app + backend         (see SPEC §5)
  android/        Kotlin/Compose app            (see SPEC §5)
```

---

## Where we are

**Pre-code. Phase 1 (Foundation) starts with FW1.** See `relay/PHASE-1.md` for the runbook and `relay/FW1.txt` for the first session prompt.

Human gates that no task may pass on its own:

| Gate | When | What |
|---|---|---|
| Fixtures freeze | Checkpoint A | Every constant verified against admin.ch / AFC / impots.gouv.fr |
| Indexing | Checkpoint C | Domain chosen; keyword difficulty checked; slugs are permanent |
| Detection accuracy | Checkpoint G | Two-stage measurement against a threshold written down beforehand |
| Reviewer sign-off | Checkpoint E | Expert-reviewed cases incl. one residence-1983 canton |
| Play Store | Checkpoint E | Background-location justification accepted; data safety form matches spec §13 |

---

*Working name: frontalier. Wordmark and domain are open questions (spec §22).*
