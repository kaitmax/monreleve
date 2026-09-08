# Implementation Plan: frontalier

Source of truth: `SPEC-frontalier-web.md` **v2.2** (design system: Frontier Work v1.0 per `DESIGN-SYSTEM.md`, replacing Carbon on 03.09.2026) (Android client with location auto-detection; web reduced to the public acquisition surface; v2.1 adds the detection refinements, absence days, rule versioning, and the device-only geofence contingency). Task detail lives in `tasks/todo.md`.

Two task series, because there are two clients:

- **FW1–FW29** — web (public site) and backend (API, database, dossier, PDF, jobs, deploy).
- **AN1–AN15** — the Android app.

Commit convention: `FW<N>: <title>` / `AN<N>: <title>`, push proof required per task. The FW prefix also keeps these distinct from Tizi's T-numbers in the relay.

## Overview

Build the frontalier product as one backend with two clients. The **web** is public and anonymous: the calculator, the LAMal/CMU comparator, the guide mesh, the alert list, and the app's landing page — its whole job is to rank, convince, and hand off. The **Android app** is the product: two logging modes (manual, or location detection that *proposes* and the user confirms), a calendar that shows the quality of the record, and the dossier as PDF and CSV.

The plan is dependency-ordered and vertically sliced. Three properties are preserved from v1 and matter more now that there are two clients: the calculation engine is built and frozen before any UI consumes it; the web is shippable on its own at Checkpoint B, months before the app; and every checkpoint leaves something deployable.

**The riskiest thing in v2 is not code.** Whether balanced-power location can reliably distinguish "at home in Ferney-Voltaire" from "at work in Meyrin" is an empirical question, and the entire auto mode rests on it. AN6 is a measurement spike scheduled before any detection UI is built, and its result is a human gate.

## Architecture Decisions

(Rationale in spec §2–§3; listed here because they shape task boundaries.)

- **Single Next.js 15 app**, module boundaries enforced by ESLint import rules (`lib/calc-engine` imports nothing; `lib/ui/core` bans React; UI strings only from `lib/fr`). The guardrails are FW1, before any feature code exists to violate them.
- **One rendering paradigm (React)**; `lib/ui/core` stays React-free so the rail and formatters render identically in browser, PDF, and OG image.
- **Engine first, everything else is delivery.** The Geneva fixtures are ship-blocking; fixtures are frozen only after the human regulatory-verification gate at Checkpoint A.
- **Evidence model:** server-assigned timestamps, append-only `EntryEvent` audit, late-entry flags surfaced everywhere including the PDF. No API path ever accepts a client `recordedAt`.
- **Magic-link auth (Auth.js v5 + Resend)**, database sessions, `trustHost: true`.
- **PDF = headless Chromium printing a session-gated print route** that reuses the exact Relevé components — the screen and the document cannot drift.
- **Reminders = server-scheduled FCM** (pg-boss + Firebase), exactly one per day, opt-in, carrying the proposal in auto mode.
- **No signed-in web area.** The web is static/ISR and anonymous; TanStack Query and session cookies are gone from it entirely, so the "zero cookies on public routes" guarantee is total.
- **Design system = Frontier Work v1.0** (`DESIGN-SYSTEM.md`): Inter, token radii, grey canvas / white cards, brand `#173B63`, country dots, Lucide. Its §2 overrides (no map, no live dot, no timeline, tier in words, 49.9 band kept, four screens named ours) bind every prompt and every task.
- **Two engines, one conformance suite.** The Kotlin port and the TypeScript engine both consume `fixtures/geneva-cases.json` in CI; a divergence on any case fails both builds. The server stays authoritative for the dossier and the PDF.
- **Detection is on-device and coordinate-free.** Fixes are classified against a bundled border polygon and discarded; Room keeps only per-day minute tallies. Lint rules fence coordinates inside `detection/`, and the API rejects any payload containing them.
- **Detection proposes, the user disposes.** No code path writes an entry without a confirmation tap; an unconfirmed proposal expires and the day stays *non renseigné*.
- **Provenance is a stored field**, printed in the annex, the CSV, and the PDF — including the detected value the user overrode.
- **Android state:** Compose + ViewModel + `StateFlow`, Room as the single source of truth for entries, WorkManager for sampling, proposal, and sync. `EntryRepository` is the only writer.
- **Detection is tiered, buffered, and hysteretic (v2.1).** Fixes within 150 m of the frontier count for neither side; side changes under 10 minutes are folded back; each day gets a HIGH/MEDIUM/LOW tier shown in words. LOW withholds. **No tier auto-confirms.**
- **Rules are versioned by tax year.** `RuleSet(2026)` is the only set at launch; the Geneva fixtures are pinned to it and must not move.
- **Absences are record-only.** `ABSENT` explains a gap in the calendar and the annex and never reaches the engine.
- **Named contingency for detection:** device-only *domicile* / *lieu de travail* geofences, never synced — built only if Checkpoint G triggers it.
- **Budgets in CI from day one:** ≤100 KB public / ≤250 KB app first-load JS (gzip), LCP < 2.5 s slow 4G, zero third-party requests, zero cookies on public routes.

## Definition of Done (project-wide — every task clears this before it counts)

- `pnpm typecheck`, `pnpm lint` green; tests green — **in CI via the coverage run** (`pnpm test:coverage`, which is a strict superset of `pnpm test`; the uninstrumented run stays the local loop command, ruling R22); `pnpm build` clean.
- No raw hex, no arbitrary spacing, no React in `lib/ui/core`, no strings outside `lib/fr` (all lint-enforced — a violation fails CI, not review).
- New/changed UI has a `/dev/composants` entry, a visual baseline, zero jest-axe violations, its loading/empty/error states implemented, and a keyboard path.
- Budgets (`pnpm size`) still green.
- Commit `FW<N>: <title>` pushed; report notes any spec deviation explicitly.

## Execution Discipline (per task)

How every FW task is executed inside a Claude Code session — this is the increment cycle, and it is part of the standing protocol in every relay prompt:

- Each task runs as **ordered increments**: implement → test → verify → **commit → push**, then the next slice. The project builds and existing tests stay green after every increment; never more than ~100 lines uncommitted.
- **One logical change per commit**, message `FW<N>: <increment title>`; push proof captured per increment for the report.
- **Simplicity first**: the naive, obviously-correct version before any abstraction; no config-driven machinery for a single use case.
- **Scope discipline**: touch only what the task requires. Out-of-scope observations go to a NOTICED BUT NOT TOUCHING list in the report — never fixed in-task.
- **Ask-first items (spec §20) or any spec ambiguity**: pause, route the question through the relay to chat-Claude, and record the ruling **verbatim** in the report and the next prompt's pre-step.
- Exit artifact per session: `REPORT-FW<N>.txt` with per-increment evidence (files, trimmed command output, commit hash), guardrail/AC proofs, deviations, and push proof.

## Test Discipline (per increment)

Tests are proof; "seems right" is not done. How the TDD cycle maps onto this project:

- **RED → GREEN → REFACTOR inside every increment.** New behavior gets its failing test before the code. A test that passes on first run proves nothing — for pivotal tests (the Geneva fixtures above all), the session report shows the failing run before the implementation exists.
- **The Prove-It pattern is the bounce protocol.** Every bounce-verdict fix and every bug fix starts with a reproduction test that fails on the current code and passes after the fix — both runs in the report. No reproduction, no fix.
- **Pyramid, mapped to this codebase:** small ≈ 80% — engine, formatters, zones, params codec, entry aggregation, dossier math (pure, no I/O, milliseconds); medium ≈ 15% — API routes and services against a **real Postgres** (CI service container), never a mocked Prisma; large ≈ 5% — only the Playwright flows enumerated in spec §19 (Geneva-c through the UI, offline sync, auth round trip, exports). E2E does not grow beyond that list without a ruling.
- **Fixed mock boundaries, decided once:** fake Resend (capture outbox) and web-push (fake transport); the clock is injectable at service seams for `recordedAt`, late-flag, and reminder tests (the engine itself never touches a clock, per spec); the PDF pipeline is verified by extracting from the real output, not by mocking Chromium. Everything else: real implementation.
- **State, not interactions.** Assert what came out (rows, responses, rendered strings), never which internal method was called. DAMP over DRY: each test reads as a self-contained specification; one behavior per test; names describe the behavior.
- **Snapshot policy (restating spec):** forbidden in `lib/calc-engine` (CI grep enforces); allowed in `lib/ui` only as reviewed appearance baselines.
- **Command hygiene:** the repo's own scripts, focused command inside the loop, full suite once before the report — and never re-run an unchanged command for reassurance.
- **Guardrail proofs are adversarial (R7).** A fence proof is not complete with the straight violation alone; it must include at least one evasion attempt, and the report shows both. The evasions that have actually defeated a fence in this project: a **path trick** (`./../fr` satisfies a "starts with `./`" pattern while escaping the directory), an **alternate extension** (a rule globbing `**/*.ts` does not see `.tsx`, which is the extension an accidental React component actually carries), a **re-export** (`export * from 'react'`), and a **dynamic import** (`await import('react')`, which `no-restricted-imports` never visits). Two of those four shipped as holes in FW1 and were found only in review.
- **Verification chains use `&&`, never `;` (R15).** A chain must short-circuit, so that a failing check cannot be followed by a commit. `(pnpm typecheck && pnpm lint && pnpm test && pnpm build) && git commit` is correct; separating them with `;` produced a red commit in FW3 that had to be amended.
- **Any normalising text API is forbidden for formatted numbers (R71, restating R66).** Assert on `textContent` / `innerText` **by codepoint**. That covers Testing Library's `getBy*Text`/`queryBy*Text`, `getByRole(…, { name })`, jest-dom's `toHaveTextContent`, and Playwright's `toHaveText`/`toContainText`/`innerText`. The default normalizer collapses runs of whitespace to a single ordinary space, and in JavaScript `\s` matches **U+202F** (the narrow no-break space `formatDays` uses as a group separator) and **U+00A0** (which `formatPercent` puts before the percent sign). **The normaliser touches only the DOM side, never the matcher** — measured, and the correction matters because it decides which way a mismatch fails: DOM U+00A0 against a matcher written with an ASCII space *matches, silently*; DOM U+202F against a matcher written with U+202F *does not match*, going red against correct content. Both halves were met in FW9's DataGrid, where one assertion failed loudly against a correct table and its neighbour was **green while asserting nothing**. And a comparison whose two sides both come from the formatter is *tautological* — it proves pass-through, not the codepoint: changing `GROUP_SEPARATOR` left it green while a `charCodeAt` assertion failed with `expected 32 to be 8239`. Pin the byte where the claim is about the byte.
- **Float hygiene at every proration or rounding site (R10).** Multiply before dividing, and normalise before rounding. Percentages and month fractions are not exactly representable in IEEE 754, so a product that is mathematically an integer can arrive as integer + 1e-14 and round the wrong way: `240 × 45/100 × 7/12` is exactly 63 but evaluates to `63.000000000000007`, and the rule rounds **up**, so it becomes 64 — a one-day error in the denominator, which moves the number filed with the AFC. Every such site carries a comment saying the normalisation is **float hygiene and not a regulatory rounding rule**, so it is never mistaken for one. Cases that exist only because of float behaviour go in **shared fixtures** (`fixtures/denominator-cases.json`), not in TypeScript-only tests, because the Kotlin port shares the defect and must share the guard.

## UI Discipline (per component and screen)

The spec (§6, §16) owns the visual system; this section adds the engineering structure on top of it.

- **The "AI aesthetic" is held off by the token discipline, not by austerity.** Frontier Work is rounded and warm by design — which makes the generic-app drift *more* likely, not less. The defenses: radius only from the seven tokens, brand blue used sparingly (Frontier: "do not use it everywhere"), no shadows on cards, no illustrations, no flag emoji, and the §2 overrides in `DESIGN-SYSTEM.md`. The remaining trap is content: **never lorem ipsum** — placeholder copy is realistic French from `lib/fr`, marked `TODO-COPY` where unwritten, because fake text hides the wrapping and overflow problems real French reveals.
- **Component structure:** composition over configuration — children and slots, not prop bags. Leaf components live flat in `lib/ui/react`; a component that grows a hook or subcomponents graduates to a folder (`Component/{Component.tsx, Component.scss, Component.test.tsx, use-*.ts}`). Any component past ~200 lines gets split. In `/app`, screens fetch and presentational components render — a presentational component takes data via props and computes nothing (restating the spec's boundary).
- **State ladder, decided for this app:** local `useState` for form state; **the URL and `localStorage` are the calculator's state** (the FW13 codec — never duplicated into a store); no theme/locale context (one theme, one locale, by design); server state in `/app` via **TanStack Query** with optimistic updates on the daily log (tap → confirmation row instantly, marked pending, reconciled to the server timestamp on response, handed to the FW30 offline queue when disconnected); **no global store** — reaching for one is an ask-first. TanStack Query never ships to public routes.
- **Three states per screen, always:** loading (Carbon `SkeletonText`/`SkeletonPlaceholder` — never spinners for content), empty (honest, actionable), and error (with retry). All three registered in `/dev/composants` and visually baselined. A blank flash or an unhandled fetch error is a bounce.
- **A11y engineering (on top of spec §16):** semantic elements first — a click target is a `<button>`, an input has a `<label>` or `aria-label`; one `h1` per page, no skipped heading levels (guides and marketing pages included); modals take initial focus, trap it, and return it on close (the FW25 calendar modal is the reference case); the keyboard path is written into each screen's E2E, not checked after.
- **Android (v2):** Compose + ViewModel + `StateFlow`; Room is the single source of truth for entries and `EntryRepository` is the only writer, so no screen calls the API or a DAO directly. Every screen ships loading, empty, and error states, and the offline/pending state is a fourth first-class state, not a toast. `FrontierTheme` wraps `MaterialTheme`; every radius, colour, and spacing is a token — a literal outside the set, a shadow on a card, or a FAB is a review rejection. Optimistic writes go to Room first and display a pending marker until the server timestamp returns.
- **Responsive:** mobile-first at Frontier's baselines — 360 × 800 dp Android, 390 × 844 iPhone, 430 × 932 large phone; desktop 1280 min / 1440 recommended. 360 dp is the reference device: one-handed, on a train.

## Task List

### Phase 1 — Foundation
- [ ] FW1: Scaffold, guardrails, CI
- [ ] FW2: Carbon budget spike (fail fast)
- [ ] FW3: calc-engine — types, validation, regime, denominator, granularity
- [ ] FW4: calc-engine — waterfall, rates, headroom, warnings + Geneva fixtures
- [ ] FW5: calc-engine — property tests + 100% coverage gate
- [ ] FW6: ui/core — zones, generated SCSS, French formatters
- [ ] FW7: ui/core — renderRailSvg (3 variants, byte-identical)
- [ ] FW8: ui/react — result components (Rail, Badge, Rate, Tile, LegalNote)
- [ ] FW9: ui/react — FieldGroup, DataGrid, Container, PublicShell

### Checkpoint A: Foundation
- [ ] All six Geneva fixtures exact (39,16 % / 4,16 %); 100% engine coverage; 8 invariants × 10k cases
- [ ] Spike numbers recorded; budgets confirmed reachable (or escalation decided)
- [ ] Visual baselines + a11y green for all nine components; 200px rail thumbnail human-approved
- [ ] **Design-token gaps** — values in real use that no token carries, reviewed together with the closed radius set (`DESIGN-SYSTEM.md` §4.1). **Six have been closed since this line was written**, all by ruling and all now pinned by test: the size family (R62), the three layout widths (R64), the two header heights and the compact CTA (R68), the hairline `--size-rule` (R69), and the `label`/`wordmark` type pairs (R70) — and `-md`, which is Sass-only because a media query condition cannot read `var()`. `TICK_WIDTH` 1,5 px is also closed: R46 made it 2 and R62 gave it `--size-tick`, so its old *absence* assertion became a mirror. **Still open, none blocking:** an H1 40/48 pairing (three FD briefs ask for it, the token is 32/40 — FW16/FW20 will need a ruling); uppercase tracking 0,04 em for eyebrow labels (FD11:72, FD13:46, and stylelint rejects a raw `letter-spacing`); and an absolute site origin, which is not a design token but the same shape of gap and is gated at Checkpoint C.
- [ ] **HUMAN GATE — fixtures frozen:** constants verified against admin.ch / AFC / impots.gouv.fr; `docs/regulatory-sources.md` dated

### Phase 2 — Calculator slice (deployable public MVP at checkpoint)
- [ ] FW10: Public layout + legal pages + robots/sitemap skeleton
- [ ] FW11: Calculator form (3 visible fields, mission line, accordion, live recompute)
- [ ] FW12: Result panel (badge, two rates, rail, tiles, warnings, contextual links)
- [ ] FW13: URL params codec + share (the public contract)
- [ ] FW14: Alerts — Prisma init, double opt-in, capture component, /alertes
- [ ] FW15: OG image, JSON-LD, metadata, Umami events

### Checkpoint B: Calculator shippable
- [ ] E2E: Geneva case (c) through the UI displays `39,16 %` and `45,0 %`
- [ ] Param round-trip ×10k; shared URL pre-fills; result never gated
- [ ] 320px clean; meaningful with JS disabled; zero cookies / third-party requests (trace)
- [ ] This slice is deployable as a soft launch if desired — nothing later blocks it

### Phase 3 — Public content
- [ ] FW16: Guides infrastructure (MDX, template, hub, mesh link-checker)
- [ ] FW17: Content — pillar + seuil-social + missions guides
- [ ] FW18: Content — attestation, droit-option, déclaration, genève
- [ ] FW19: LAMal/CMU comparator (data module + page)
- [ ] FW20: Homepage, /releve-annuel, /tarifs, /sources, /a-propos

### Checkpoint C: Public site complete
- [ ] Mesh rules pass the link-checker (pillar↔clusters bidirectional; guide→calculator ×2; calculator→/releve-annuel)
- [ ] Lighthouse green on every public route; sitemap/robots/canonicals/hreflang correct
- [ ] **HUMAN GATE:** domain chosen + keyword difficulty checked **before anything is indexed** (slugs are permanent)

### Phase 4 — Backend and API

- [ ] FW21: Full Prisma schema + migrations + seed (provenance, loggingMode, devices)
- [ ] FW22: Auth — magic link, App Link callback, refresh tokens for the device
- [ ] FW23: Entries API `/v1` — server timestamps, provenance, append-only audit, coordinate rejection
- [ ] FW24: Dossier service — aggregation, monthly breakdown, evidence annex payload
- [ ] FW25: Exports — CSV endpoint, print route, PDF via Chromium
- [ ] FW26: Account export + deletion, alerts hygiene jobs
- [ ] FW27: Reminder scheduler (pg-boss) + FCM delivery
- [ ] FW28: Deployment — Docker, Coolify, backups, health, assetlinks.json
- [ ] FW29: Web + backend release audit

### Checkpoint D: Backend complete, app can be built against it

- [ ] Entries API proven: server clock wins, `EntryEvent` append-only, a coordinate-bearing payload is rejected with 400
- [ ] Dossier payload for a seeded year matches a direct engine computation exactly; PDF is A4 with the annex expanded and provenance per row
- [ ] Magic link round trip works **through the App Link callback**, not only in a browser
- [ ] API is versioned and documented; no unversioned endpoint exists
- [ ] Deployed to staging; the public site keeps serving with the database stopped

### Phase 5 — Android foundation

- [ ] AN1: Android project scaffold, FrontierTheme, token lint fences, CI
- [ ] AN2: Kotlin engine port + shared JSON conformance suite
- [ ] AN3: Core components — rail, badge, rate, tiles, day cell + screenshot tests
- [ ] AN4: Auth, session, onboarding shell, install-referrer prefill
- [ ] AN5: Room + repository + WorkManager sync (manual entries end to end)

### Checkpoint F: Manual-mode app is a complete product

- [ ] Kotlin and TypeScript engines agree on every fixture; a planted one-digit divergence fails both builds
- [ ] Log offline → reconnect → entry syncs with both timestamps; queue survives process death
- [ ] **This is the fallback product.** If detection later fails its gate, what exists here still ships.

### Phase 6 — Detection

- [ ] AN6: **Detection accuracy spike** — polygon, sampling, real-world measurement
- [ ] AN7: Detection service — buffer, hysteresis, tiers, withholding
- [ ] AN7b *(conditional — only if Checkpoint G triggers D31)*: device-only geofences
- [ ] AN8: Onboarding — mode chooser, permission priming, refusal path
- [ ] AN9: Aujourd'hui — auto mode (proposal, confirm, correct, provenance)

### Checkpoint G: Detection gate

- [ ] **HUMAN GATE — accuracy, two stages:** (1) one device, one week, both sides of the Geneva border, proposals compared against a hand-kept log; (2) the Checkpoint F manual-mode build distributed to **20–30 frontaliers** for two weeks with detection running silently alongside their manual entries — agreement measured per tier. The threshold is written down **before** stage 1 runs.
- [ ] **Decision tree recorded:** pass → AN7 ships as specified; fail on border cases only → activate the D31 device-only geofence contingency (AN7b) and re-run stage 2; fail broadly → auto mode does not ship and the app launches manual-only. No fourth option.
- [ ] Battery cost ≤ 3% per working day, measured on a real device
- [ ] Full sampling-to-proposal cycle completes with the network stubbed to fail
- [ ] No coordinate outside `detection/` — lint rule, API rejection test, and a database inspection after a simulated month

### Phase 7 — Complete the app

- [ ] AN10: Calendrier — grid, letter/bar/triangle encoding, legend, edit sheet
- [ ] AN11: Relevé — dossier screen, PDF/CSV export, share sheet
- [ ] AN12: Paramètres — settings, consent revocation, data export, account deletion
- [ ] AN13: Notifications — FCM, one daily reminder carrying the proposal
- [ ] AN14: Play Store release prep — data safety, background-location justification, closed testing
- [ ] AN15: Android hardening audit

### Checkpoint E: Complete

- [ ] Every §21 technical criterion checked, with evidence per item
- [ ] Manual mode and auto mode produce an identical dossier from the same days
- [ ] PDF is A4, same rail, annex fully expanded with provenance; CSV schema exact; monochrome print loses nothing
- [ ] **HUMAN GATE:** expert reviewer signed the reviewer cases (incl. one residence-1983 canton, one part-time mid-year start) and ruled on how provenance is worded in the document
- [ ] **HUMAN GATE:** Play Store closed testing passed; background-location justification accepted
- [ ] Staging deploy dry-run on the VPS passed; saharadesertguide untouched

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Regulatory constants wrong (drafted from advisory sources) | High | Human gate at Checkpoint A before fixtures freeze; every constant cited in `docs/regulatory-sources.md`; reviewer cases at Checkpoint E |
| Carbon tree-shaking silently blows the budget | High | FW2 spike in week one; `size-limit` blocking in CI from FW1; escalation path = Carbon Web Components before more pages exist |
| LAMal premium data has no clean source | Med | FW19 acceptance requires a dated, cited data file (OFSP priminfo or equivalent); if unavailable, comparator degrades to formula + manual premium input — decide at FW19, not later |
| Chromium on the VPS (RAM, image size) | Med | Single-render concurrency guard in FW25; Debian-slim runner; fallback = queue PDF jobs via pg-boss |
| **Detection cannot separate home from work near the border** | **High** | The kill-risk for auto mode. AN6 measures it before any detection UI exists; Checkpoint G is a two-stage gate with a written decision tree; the D31 device-only geofence contingency (AN7b) is the fallback for border-only failure; the manual-mode app (Checkpoint F) is a complete product that ships regardless |
| **Background mechanics on Android are harder than the spec implies** (WorkManager ≥15 min and Doze-deferred; foreground service needs a persistent notification) | Med | AN6 decides the mechanism from measurements; a persistent-notification UX cost is routed back as a design question before AN7 |
| **Battery drain gets the app uninstalled** | High | 3%/working-day budget is a spec requirement, measured on device in AN6/AN7; the app withholds low-confidence days rather than sampling harder |
| **Play Store rejects or delays background location** | High | Prominent-disclosure screen built to Play's requirement in AN8; demo video prepared in AN14; manual-only build is release-ready as the fallback |
| **The two engines diverge** | High | Shared `fixtures/geneva-cases.json` consumed by both CIs from AN2 onward; a planted divergence must fail both builds before the port is accepted |
| **A coordinate leaks into storage or a payload** | High | Lint fence on `detection/`, API schema rejection with a test, and a post-simulation database inspection at Checkpoint G |
| Users override detection constantly (correction rate high) | Med | Measured as a first-party metric from launch; >10% means auto mode creates work — change the default rather than defend the feature |
| Magic-link deliverability | Med | Resend domain with SPF/DKIM verified in FW22 acceptance; test inbox placement |
| Employer attestation makes the dossier redundant (kill-risk #1) | High | Not a code task — run the 10 frontalier interviews **in parallel with Phases 1–2**; cheap slices ship regardless |
| Timezone/day-boundary bugs corrupt records | High | All day math in Europe/Paris; explicit unit tests at DST transitions in FW23/FW24 |

## Open Questions (human input needed — none block Phase 1)

1. Employer-attestation interviews (kill-risk) — target: done before Checkpoint C.
2. Named expert reviewer + terms — needed for `/a-propos` (FW20) and Checkpoint E.
3. Domain (`.fr` / `.ch` / `.com`) + keyword difficulty — needed before Checkpoint C indexing.
4. Truncation vs rounding of the declarable rate — confirm before Checkpoint A freeze (invariant 7 inverts if rounding).
5. Tamper-evidence (hash chain) — reviewer question; `EntryEvent` is designed to accept it without migration.
6. **Detection accuracy threshold, per tier** — what agreement rate makes auto mode shippable? Decide the numbers *before* AN6 runs, so the gate is not negotiated against a result you have already seen.
7. **Contingency geofence radius** — 150 m or 300 m, and whether a user may define a third place. Only matters if Checkpoint G triggers D31.
8. **Border polygon source, licence, and maintenance** — needed for AN6; the app ships it, so corrections require a release.
9. **Legal weight of a disclosed correction** — does printing "proposé X, enregistré Y" strengthen or weaken the document? Expert reviewer, before Checkpoint E.
10. **iOS: fast follow or not?** Affects whether the Kotlin port is treated as one-off or as a shared-core problem.

## Parallelization Opportunities

- **Safe to parallelize:** FW3–FW5 (engine) with FW6–FW7 (ui/core) after FW1; FW17–FW18 (guide content) with FW21–FW27 (backend); **the entire AN series with FW16–FW20 (web content)** once the API contract is frozen; AN6 (the detection spike) with AN3–AN5, since it touches nothing they touch.
- **Must be sequential:** FW1 → everything; FW3→FW4→FW5; FW21→FW22→FW23→FW24→FW25; AN1→AN2→AN3; AN5 before AN9/AN10/AN11; AN6 before AN7 (never build detection UI before measuring detection); AN7→AN8→AN9; **AN7b only after Checkpoint G triggers it.**
- **Needs coordination (contract first):** FW13's param schema; **FW23's `/v1` API contract, which must be frozen before AN4 starts** — an app in the field cannot be redeployed like a server; and `fixtures/geneva-cases.json`, which is frozen at Checkpoint A and consumed by AN2.

Relay note: one FW task per Claude Code session, report as `.txt`, bounce verdicts preserved verbatim in the next prompt's pre-step — same discipline as Tizi.
