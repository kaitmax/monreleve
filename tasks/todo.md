# Task List: frontalier-web

Spec: `SPEC-frontalier-web.md` **v2.2**. Design tokens: `DESIGN-SYSTEM.md` (Frontier Work v1.0; §2 overrides bind every UI task). Plan and checkpoints: `tasks/plan.md`.
Two series: **FW1–FW29** (web + backend), **AN1–AN15** (Android). FW1–FW20 are unchanged from v1 — the public web surface was not affected by the pivot.
Every task also clears the project-wide Definition of Done and the Execution, Test, and UI Disciplines in `tasks/plan.md` — the Verification blocks below list only what is *specific* to the task. New behavior is test-first (RED before GREEN); bounce and bug fixes start with a failing reproduction test; every screen ships loading/empty/error states.

---

# Phase 1 — Foundation

## FW1: Scaffold, guardrails, CI

**Description:** Initialise the Next.js 15 App Router project with TypeScript strict, pnpm, the Frontier Work token layer as Sass + CSS custom properties, self-hosted Inter (variable, `tnum` enabled), `lucide-react`, and — critically — the lint guardrails that make the spec's boundaries mechanical: ESLint import rules (nothing imports into `lib/calc-engine`; `lib/ui/core` bans `react`/`@carbon/react`; user-facing strings only from `lib/fr`), stylelint-declaration-strict-value (no raw hex/px), size-limit and Lighthouse CI wiring, Vitest + Playwright harnesses, and the `/dev/composants` workbench stub (noindex).

**Acceptance criteria:**
- [ ] `pnpm build` and `pnpm dev` run; the token layer compiles to CSS custom properties; Inter served same-origin (latin + latin-ext) with tabular numerals verified on a figure
- [ ] Each guardrail demonstrably fails CI on a planted violation (raw hex, raw radius/spacing off the token set, React import in `lib/ui/core`, inline French string) — violations then removed
- [ ] `pnpm size` runs with the §17 budgets configured (public ≤100 KB, app ≤250 KB) even though routes are near-empty

**Verification:**
- [ ] Tests pass: `pnpm test` (harness smoke test)
- [ ] Build succeeds: `pnpm build && pnpm typecheck && pnpm lint`
- [ ] Manual check: view-source shows zero third-party font/script requests

**Dependencies:** None
**Files likely touched:** `package.json`, `next.config.ts`, `eslint.config.mjs`, `.stylelintrc`, `lib/ui/core/styles/global.scss`, `app/dev/composants/page.tsx`
**Estimated scope:** M

---

## FW2: Bundle budget spike (fail fast)

**Description:** The week-one risk check. Build one throwaway-but-kept page under `/dev/` assembling a representative set of our components (header, form with select and number input, accordion, table, sheet, banner) with the Inter variable font and a dozen Lucide icons, and measure real gzipped first-load JS and the font payload. Subset and preload the font. Record numbers and the go/no-go decision in `docs/perf-spike.md`. If the public budget (100 KB) is unreachable, stop and escalate (drop the variable font for static weights, or trim the component set) before any feature page exists.

**Acceptance criteria:**
- [ ] Measured first-load gzip for the spike page recorded with the exact import list
- [ ] Decision recorded: budgets reachable as configured, or escalation proposed
- [ ] Tree-shaking verified: removing one Lucide icon import measurably shrinks the bundle; the font subset is under 60 KB

**Verification:**
- [ ] Tests pass: `pnpm size` (spike page under app budget)
- [ ] Build succeeds: `pnpm build`
- [ ] Manual check: `docs/perf-spike.md` contains numbers, not adjectives

**Dependencies:** FW1
**Files likely touched:** `app/dev/spike/page.tsx`, `next.config.ts`, `docs/perf-spike.md`, `.size-limit.json`
**Estimated scope:** S

---

## FW3: calc-engine — types, validation, regime, denominator, granularity

**Description:** First half of the pure engine (spec §7): the full public type surface (`Canton`, `Regime`, `Granularity`, `DenominatorMethod`, `TeleworkInput` incl. `taxYear`, `TeleworkResult`, `Warning`, `ValidationError`, `Result`), `validate.ts` (Result, never throw), `regime.ts` (the eight 1983-accord cantons), `denominator.ts` (simplified240 with `ceil`, exact = user-supplied + `EXACT_METHOD_UNVERIFIED`), **`rules.ts` — the `RuleSet` keyed by tax year (spec §7.7), with `2026` as the only set and the default, every constant citing its source**, and `granularity.ts` (>4h / 2–4h / hours + mission-travel-day rules). Zero runtime deps, no I/O, no clock. No threshold may appear anywhere but inside a `RuleSet`.

**Acceptance criteria:**
- [ ] All types compile exactly as spec §7.4; `regimeFor` and `classifyTeleworkHours` exported and unit-tested at 1.9h/2h/4h/4.1h
- [ ] `simplified240` denominator correct at employmentRate 1/50/80/100 and mid-year `periodFraction`; `totalWorkDays ≤ 0` → validation error, never a division
- [ ] No magic numbers: every constant lives in `RuleSet(2026)` with its citation; `ruleSetFor(2027)` falls back to 2026 with a warning; `docs/regulatory-sources.md` started

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/calc-engine`
- [ ] Build succeeds: `pnpm typecheck` (strict + noUncheckedIndexedAccess, no suppressions)
- [ ] Manual check: `grep -rn "0\.4\|240" lib/calc-engine/src --include='*.ts' | grep -v constants` returns nothing

**Dependencies:** FW1
**Files likely touched:** `lib/calc-engine/{types,constants,regime,denominator,granularity,validate,index}.ts`, `tests/unit/…`
**Estimated scope:** M

---

## FW4: calc-engine — waterfall, rates, headroom, warnings + Geneva fixtures

**Description:** The core arithmetic — built strictly test-first. **Encode the six Geneva cases verbatim in `tests/fixtures/geneva-cases.ts` before writing any waterfall code**: run them against FW3's stubs and show them failing (RED) in the session report, then implement until green. The implementation: `waterfall.ts` (regime-lost branch; France-before-third-state mission imputation; budget = min(cap, headroom)), `declarable-rate.ts` (**truncate 2 dp** — must match AFC filing) vs `rawRate` (round up 1 dp), `headroom.ts` (**floor to half-day**, negatives reported never clamped), mission cap `ceil` proration, and `warnings.ts` emitting all seven codes. The fixture file is the most valuable file in the repository.

**Acceptance criteria:**
- [ ] All six fixtures reproduce exactly: a→30.00, b→40.00 (237/3), c→**39.16** (226/14), d→40.00 (230/10), e→60.00 (91/149), special→**4.16** (220/20)
- [ ] The two rounding rules live in separate files, each rounding site commented with its rule; when telework alone > 40%, missions are excluded from the declarable rate
- [ ] Boundary tests at exactly 40.0% and 49.9%; mission-cap rounds **up** at rates 1/50/80/100

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/calc-engine`
- [ ] Build succeeds: `pnpm typecheck`
- [ ] Manual check: fixture table matches spec §7.5 line by line; the report shows the fixtures failing before the waterfall existed (RED), then passing (GREEN)

**Dependencies:** FW3
**Files likely touched:** `lib/calc-engine/{waterfall,declarable-rate,headroom,warnings}.ts`, `tests/fixtures/geneva-cases.ts`, `tests/unit/…`, `docs/regulatory-sources.md`
**Estimated scope:** M

---

## FW5: calc-engine — property tests + coverage gate

**Description:** `fast-check` suites asserting the eight spec invariants over 10,000 generated cases each (partition sums to total; declarable ≤ 40 when regime applies; credited ≤ cap and ≤ headroom; social ≥ fiscal remaining; rawRate monotonic in telework; declarable ≤ rawRate; truncation never overstates; France/third swap never increases credit). Wire the 100% statement-and-branch coverage gate for this package into CI. **No snapshot tests in this package** — enforced by a lint or CI grep.

**Acceptance criteria:**
- [ ] All eight invariants pass × 10,000 cases; generators cover part-time, mid-year, exact-method, and all granularities
- [ ] Coverage report shows 100/100 for `lib/calc-engine`, and CI fails below it
- [ ] Median `calculateTelework` execution < 0.1 ms (micro-benchmark recorded)

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/calc-engine --coverage`
- [ ] Build succeeds: `pnpm typecheck`
- [ ] Manual check: CI config shows the coverage threshold; `grep -r "toMatchSnapshot" lib/calc-engine` empty

**Dependencies:** FW4
**Files likely touched:** `lib/calc-engine/tests/property/*.ts`, `vitest.config.ts`, CI workflow
**Estimated scope:** S

---

## FW6: ui/core — zones, generated SCSS, French formatters

**Description:** The single-source `zones.ts` (Zone = 3 rail bands; Status = 4 badge states with French labels, Lucide icon names, one-line explanations — `mission-exposure` sits on the green band by design) mapped to the Frontier status colours, plus the build step generating `_zones.scss` from it. French formatters with **normalised** `Intl` output: `formatPercent` (U+00A0 before %), `formatDays` (U+202F group separator), `formatDate` (Swiss dots). Exhaustiveness test: every `Status` has French copy.

**Acceptance criteria:**
- [ ] `formatPercent(34.6) === "34,6\u00A0%"` and `formatDays(1234.5) === "1\u202F234,5"` asserted **by codepoint**; `formatDate("2026-12-18") === "18.12.2026"`; cases for 0, negatives, half-days
- [x] ~~`_zones.scss` is generated (build script), never hand-edited — a stale-file check fails CI if `zones.ts` and the SCSS diverge~~ — **SUPERSEDED by ruling R38.** Built and proven in FW6 (four hand-edit classes caught, including EOL-only), then removed in FW7: once R31 reduced the file to three Zone classes and the rail was ruled to fill from `ZONE_BAND_TOKEN` directly, the generated stylesheet had no consumer. A generated file whose only reader is its own stale-check is abstraction before use. `zone-tokens.ts` is the single source; if a CSS consumer ever appears, the generator returns with it.
- [ ] Status exhaustiveness test fails on any missing label/icon/explanation

**Verification:**
- [ ] Tests pass: `pnpm vitest run tests/unit/ui-core`
- [ ] Build succeeds: `pnpm build` (generation step runs)
- [ ] Manual check: run tests under Node 22 and Node 24 — identical formatter output

**Dependencies:** FW1
**Files likely touched:** `lib/ui/core/zones.ts`, `lib/ui/core/zone-tokens.ts`, `lib/ui/core/format/{number,date}.ts`, tests
**Estimated scope:** M

---

## FW7: ui/core — renderRailSvg

**Description:** The pure SVG string generator for the threshold rail — the one drawing implementation shared by browser, PDF, and OG image. Frontier progress primitive: 8 px pill track, fill in the band colour, **two tick markers at 40 and 49.9 protruding 4 px above and below** with tabular labels. Three variants (`inline`, `compact`, `social` at 1200×630 carrying the product name), coloured by `Zone` (never `Status`), positioned by `declarableRate`, tokens only.

**Acceptance criteria:**
- [ ] Byte-identical output for the same `RailData` in Node and browser (jsdom/browser test compares strings)
- [ ] Visual baselines for every variant × zone, plus a 200px-wide render kept as the thumbnail-legibility artifact for human review at Checkpoint A
- [ ] Negative/over-100 percentages clamp visually at the rail's edges without lying numerically (label still shows the true value)

**Verification:**
- [ ] Tests pass: `pnpm vitest run tests/unit/ui-core && pnpm test:visual`
- [ ] Build succeeds: `pnpm typecheck`
- [ ] Manual check: open the 200px baseline — thresholds distinguishable at thumbnail size

**Dependencies:** FW6
**Files likely touched:** `lib/ui/core/rail/renderRailSvg.ts`, `tests/unit/rail.test.ts`, `tests/visual/rail.spec.ts`
**Estimated scope:** S

---

## FW8: ui/react — result components

**Description:** The React wrappers that render a `TeleworkResult`: `ThresholdRail` (wraps `renderRailSvg` — the only permitted `dangerouslySetInnerHTML`), `ZoneBadge` (four states, Lucide icon + label + explanation), `RateDisplay` (Display 48/56, Inter `tnum`, zone-coloured), `MetricTile` (card radius 16), `LegalNote` (Caption 13/18). Each registered in `/dev/composants` in every state, with jest-axe and visual baselines. Warning `#B7791F` never as body text — covered by the automated contrast audit over every fg/bg token pair in use.

**Acceptance criteria:**
- [ ] All five components render all states in `/dev/composants`; four badge states visually distinct with icon + label; zero jest-axe violations
- [ ] Contrast audit passes across every token pair used; a planted warning-as-text case fails it (then removed)
- [ ] `RateDisplay` shows no numeric jitter (`tnum` asserted via computed style in a Playwright check)

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/ui/react && pnpm test:a11y && pnpm test:visual`
- [ ] Build succeeds: `pnpm build`
- [ ] Manual check: /dev/composants review of all states

**Dependencies:** FW6, FW7
**Files likely touched:** `lib/ui/react/{ThresholdRail,ZoneBadge,RateDisplay,MetricTile,LegalNote}.tsx` + colocated SCSS, `app/dev/composants/page.tsx`
**Estimated scope:** M

---

## FW9: ui/react — FieldGroup, DataGrid, Container, PublicShell

**Description:** The structural set: `FieldGroup` owning the `ValidationError → French message` mapping (with an exhaustiveness test over the union — the calculator, comparator, and settings must phrase the same failure identically), `DataGrid` (hairline rules only, no zebra), `Container` (three named widths per ruling R64 — `public` 1200 · `narrow` 720 · `article` 680, 32 px desktop / 20 px mobile gutters; **no grid and no 1440** — this clause used to say "12-column desktop grid, max 1440", both of which R64 and DESIGN-SYSTEM.md §1 superseded, and neither is asked for by any other document), and `PublicShell` — white header with 1 px bottom border (4 items max, `Calculateurs ▾` menu, brand-colour `Suivre mes jours` CTA → `/application`, hamburger on mobile with the CTA outside it) and the four-column footer with the standing disclaimer and « vérifié le » date.

**Acceptance criteria:**
- [ ] Exhaustiveness test: every `ValidationError` code maps to French copy; adding a code without copy fails CI
- [ ] PublicShell keyboard path complete including the mobile hamburger; CTA visible at 360 px outside the hamburger
- [ ] All four components in `/dev/composants` with baselines; zero jest-axe violations

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/ui/react && pnpm test:a11y`
- [ ] Build succeeds: `pnpm build && pnpm size`
- [ ] Manual check: footer shows all four sitemap columns + legal line

**Dependencies:** FW6, FW8
**Files likely touched:** `lib/ui/react/{FieldGroup,DataGrid,Container,PublicShell}.tsx` + SCSS, `lib/fr/errors.ts`, tests
**Estimated scope:** M

---

# Checkpoint A — Foundation (see plan.md; includes the HUMAN GATE freezing fixtures)

---

# Phase 2 — Calculator slice

## FW10: Public layout + legal pages + robots/sitemap skeleton

**Description:** Wire `(public)/layout.tsx` around `PublicShell`; ship `/mentions-legales`, `/confidentialite` (nLPD + GDPR: names the data collected, retention, export/deletion rights), `/cgu` (must state: record-keeping tool, **not tax advice**); `robots.ts` disallowing `/app/`, `/connexion`, `/inscription`, `/dev/`; `sitemap.ts` public-routes-only; trailing-slash policy enforced with 301; `hreflang="fr-FR"` + self-canonicals in the root metadata.

**Acceptance criteria:**
- [ ] Three legal pages live with real French content stubs (placeholders marked `TODO-LEGAL` where entity details are pending)
- [ ] `robots.txt` and `sitemap.xml` render correctly; `/dev/*` and `/app/*` absent from the sitemap
- [ ] Trailing-slash 301 verified both directions

**Verification:**
- [ ] Tests pass: `pnpm test:e2e -g "routing"`
- [ ] Build succeeds: `pnpm build`
- [ ] Manual check: curl both slash variants → one 301, one 200

**Dependencies:** FW9
**Files likely touched:** `app/(public)/layout.tsx`, `app/(public)/{mentions-legales,confidentialite,cgu}/page.tsx`, `app/{robots,sitemap}.ts`, `next.config.ts`
**Estimated scope:** M

---

## FW11: Calculator form

**Description:** `/calculateur-teletravail-frontalier` — three visible fields in a white card (canton select, taux number input step 5 default 100, jours de télétravail step 0.5), the always-visible mission question line above a collapsed accordion holding the five advanced fields with the verbatim method helper text (spec §9.3), all wired to `calculateTelework` recomputing on every `input` event with **no debounce**. Server-rendered explanatory content so the page is meaningful with JS disabled. `aria-live="polite"` on the result region.

**Acceptance criteria:**
- [ ] Three fields → live result; leave/sick days are **not asked** under simplified240; accordion fields alter the result correctly (missions, exact method, décompte, début d'activité → periodFraction)
- [ ] Validation errors render via `FieldGroup` in French (2 px error border + 13 px message); no inline strings (all via `lib/fr`)
- [ ] With JS disabled, the page shows the full explanatory copy and the form (no result) — no blank shell

**Verification:**
- [ ] Tests pass: `pnpm test:e2e -g "calculator form"`
- [ ] Build succeeds: `pnpm build && pnpm size` (public budget)
- [ ] Manual check: throttle to slow 4G — LCP < 2.5 s (Lighthouse)

**Dependencies:** FW9, FW5 (frozen engine)
**Files likely touched:** `app/(public)/calculateur-teletravail-frontalier/page.tsx`, `lib/fr/calculator.ts`, form island component, SCSS
**Estimated scope:** M

---

## FW12: Result panel

**Description:** The ordered panel (spec §9.3): `ZoneBadge` → two-rate display (**Taux à déclarer à l'AFC** large; **Part de jours hors de Suisse** smaller; explanatory line when they differ) → `ThresholdRail` positioned by declarableRate → four `MetricTile`s (restants avant 40 %, avant 49,9 %, imposés en Suisse, en France — negatives shown as « X jours au-dessus ») → one banner per engine `Warning` → `LegalNote` → exactly one contextual link chosen by `Status` (exhaustiveness-tested mapping to the four destinations).

**Acceptance criteria:**
- [ ] Geneva case (c) inputs render `39,16 %` and `45,0 %` with the difference explained; case (e) shows regime-lost with missions excluded from the declared rate
- [ ] Every `Warning` code produces its French notification; every `Status` maps to its link (test enumerates both unions)
- [ ] Panel appears below the form without replacing it; iterating inputs updates in place; announced via aria-live

**Verification:**
- [ ] Tests pass: `pnpm vitest run app && pnpm test:e2e -g "result panel"`
- [ ] Build succeeds: `pnpm build`
- [ ] Manual check: colour-blind simulation — every state readable from icon + text alone

**Dependencies:** FW11
**Files likely touched:** result panel component, `lib/contextual-links.ts`, `lib/fr/{warnings,result}.ts`, tests
**Estimated scope:** M

---

## FW13: URL params codec + share

**Description:** The public contract (spec §9.4): `params/schema.ts` + `codec.ts` mapping the nine frozen param names ⇄ `TeleworkInput`; pre-fill form from URL; unknown params ignored, invalid values default + dismissible notice (never a blank page — Facebook mangles URLs); `noindex` + bare-path canonical on any param-bearing URL; share = copy-link + `navigator.share` where available; persist the last inputs to `localStorage` for the future `/inscription` prefill.

**Acceptance criteria:**
- [ ] Round-trip property test: `decode(encode(input)) === input` over 10,000 generated valid inputs; hostile/malformed cases covered
- [ ] Param URL pre-fills the form and reproduces the result; empty `?` behaves as bare path
- [ ] `noindex` + canonical present exactly when params exist; **no personal data** representable in the schema

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/params && pnpm test:e2e -g "params"`
- [ ] Build succeeds: `pnpm typecheck`
- [ ] Manual check: paste a mangled URL (`&amp;`, truncated value) — notice shown, page usable

**Dependencies:** FW12
**Files likely touched:** `lib/params/{schema,codec}.ts`, calculator page, share component, `tests/property/params.test.ts`
**Estimated scope:** M

---

## FW14: Alerts — Prisma init, double opt-in, capture, /alertes

**Description:** Introduce Prisma/Postgres with the `AlertSubscriber` model only (full schema arrives FW21; migrations are additive). `POST /api/alertes` (rate-limited, source-tagged), Resend confirmation email (French), `GET /api/alertes/confirm`, one-click unsubscribe in every send, consent timestamps stored. Email-capture card mounted after the calculator result (**never gating it**) and the standalone `/alertes` landing for Facebook posts.

**Acceptance criteria:**
- [ ] Full double-opt-in loop works against a test inbox; unsubscribe sets `unsubscribedAt`; re-subscribe handled idempotently
- [ ] Capture sits below the result; submitting leaves the result visible and untouched (E2E-asserted)
- [ ] `source` recorded (`calculateur` | `alertes`); duplicate email → friendly French message, no error page

**Verification:**
- [ ] Tests pass: `pnpm vitest run app/api/alertes && pnpm test:e2e -g "alerts"`
- [ ] Build succeeds: `pnpm build` (Prisma generate + migrate in CI)
- [ ] Manual check: confirmation + unsubscribe emails render correctly in French

**Dependencies:** FW12
**Files likely touched:** `prisma/schema.prisma`, `app/api/alertes/**`, `lib/db/client.ts`, capture component, `app/(public)/alertes/page.tsx`, email templates
**Estimated scope:** M

---

## FW15: OG image, JSON-LD, metadata, Umami events

**Description:** Generic OG card (`opengraph-image.tsx`) rasterising the `social` rail variant with the product name — **never per-result** (spec §6.6). JSON-LD `WebApplication` + inline `FAQPage` (40 vs 49.9; do missions count; do sick days count). Titles/descriptions naming the 40 % threshold and the year. Umami self-hosted script same-origin; fire the eight calculator events (`page_view`, `calculated`, `result_status`, `accordion_opened`, `missions_declared`, `email_submitted`, `share_clicked`, `contextual_link_clicked`).

**Acceptance criteria:**
- [ ] OG image is 1200×630, identical for every param URL (asserted), validates in a card debugger
- [ ] JSON-LD validates (Rich Results test schema); FAQ content matches the on-page accordion
- [ ] All eight events fire with correct payloads (`result_status` carries the Status enum); zero cookies and zero third-party requests confirmed by trace test

**Verification:**
- [ ] Tests pass: `pnpm test:e2e -g "seo|analytics"`
- [ ] Build succeeds: `pnpm build && pnpm size`
- [ ] Manual check: Umami dashboard shows a test session's event stream

**Dependencies:** FW13, FW14, FW7
**Files likely touched:** `app/(public)/calculateur-teletravail-frontalier/opengraph-image.tsx`, `lib/analytics/events.ts`, metadata files, layout script tag
**Estimated scope:** M

---

# Checkpoint B — Calculator shippable (see plan.md)

---

# Phase 3 — Public content

## FW16: Guides infrastructure

**Description:** The MDX pipeline and article template: statically generated `guides/[slug]`, frontmatter (`title`, `description`, `lastReviewed`, `cluster`, `related`), desktop layout with 4-column sticky table of contents + 8-column prose (~70 chars/line), the guide component kit wired for MDX (bordered summary block, `DataGrid`, warning banner, accordion with FAQ structured data), the hub page, the end-of-article calculator card CTA (one variant, everywhere), `/sources` link in every guide footer — and a **mesh link-checker test** encoding spec §9.5's rules (pillar↔cluster bidirectional; every guide→calculator twice; no orphan guides).

**Acceptance criteria:**
- [ ] A sample MDX article renders the full template (TOC, components, CTA, lastReviewed, sources link) at `lg` and `sm`
- [ ] Link-checker fails on: missing pillar backlink, missing calculator CTA, or a guide absent from the hub — proven with a planted violation
- [ ] FAQ accordions emit valid `FAQPage` structured data per article

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/content && pnpm test:e2e -g "guide template"`
- [ ] Build succeeds: `pnpm build` (all MDX compiles statically)
- [ ] Manual check: article readable, TOC sticky, prose measure correct

**Dependencies:** FW10
**Files likely touched:** `lib/content/**`, `app/(public)/guides/{page.tsx,[slug]/page.tsx}`, MDX components map, `tests/unit/mesh.test.ts`
**Estimated scope:** M

---

## FW17: Guide content — pillar + seuil social + missions

**Description:** Write and ship three articles in French: the **pillar** `/guides/teletravail-frontalier-40-pourcent` (the definitive 40 % page: the rule, the avenant, the denominator methods, worked examples reusing Geneva cases), `/guides/seuil-social-49-9-pourcent` (A1 certificate, what switches at 49.9), `/guides/jours-de-mission-hors-suisse` (the inside-the-40% trap, the 10-day cap, France vs pays tiers). Every regulatory claim cited to `/sources`; drafts flagged `TODO-REVIEW` for the expert pass.

**Acceptance criteria:**
- [ ] Three articles live, each with the warning notifications for their traps, ≥2 calculator links (inline + CTA), and `lastReviewed` set
- [ ] Pillar links both clusters and vice-versa; 49.9 ↔ missions cross-linked (they interact); mesh test green
- [ ] Every threshold/date in the copy traces to an entry in `/sources` data (no uncited figures)

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/content` (mesh + citation lint)
- [ ] Build succeeds: `pnpm build`
- [ ] Manual check: read-through for French register — reference tone, not marketing

**Dependencies:** FW16
**Files likely touched:** `content/guides/teletravail-frontalier-40-pourcent.mdx`, `content/guides/seuil-social-49-9-pourcent.mdx`, `content/guides/jours-de-mission-hors-suisse.mdx`, `lib/content/sources.ts`
**Estimated scope:** M

---

## FW18: Guide content — attestation, droit d'option, déclaration, Genève

**Description:** The remaining four: `/guides/attestation-employeur-teletravail` (what employers must certify from 2026, why it may not suffice — the product's core argument), `/guides/droit-option-lamal-cmu` (the 3-month irrevocable window, linking the comparator), `/guides/declaration-impots-frontalier` (April season), `/guides/geneve` (canton-specific only: source-regime specifics, GE worked examples — thin canton pages are worse than none, so this one earns its slug or is cut).

**Acceptance criteria:**
- [ ] Four articles live with correct cluster linking (droit-option ↔ comparator; attestation ↔ releve-annuel offer; déclaration ↔ pillar); hub lists all seven
- [ ] Genève page contains canton-specific content only — no restated pillar material (reviewer note in frontmatter)
- [ ] Mesh test green across the complete set; every article carries `lastReviewed` + sources footer

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/content`
- [ ] Build succeeds: `pnpm build && pnpm lighthouse` (guide routes)
- [ ] Manual check: hub → every article → back paths all coherent

**Dependencies:** FW17
**Files likely touched:** four MDX files, `app/(public)/guides/page.tsx`, `lib/content/sources.ts`
**Estimated scope:** M

---

## FW19: LAMal/CMU comparator

**Description:** `/calculateur-lamal-cmu` — same shell as the calculator. A `lib/lamal` data+logic module: CMU cost from revenu fiscal de référence (formula constants cited), LAMal side from a **dated, source-cited cantonal premium data file** (OFSP/priminfo reference dataset; if a clean source is unavailable, fall back to user-entered premium — decide inside this task, record the decision). Output: two-column `DataGrid` of estimated annual cost, badge on the cheaper option, prominent error banner — choice **irrévocable**, window **trois mois** — `LegalNote`, email capture (`source: 'comparateur'`).

**Acceptance criteria:**
- [ ] Unit-tested cost logic with cited constants; premium data file carries source + fetch date; unknown canton/inputs → validated French errors
- [ ] Irrevocability notice unmissable above the fold of the result; cheaper-option `Tag` correct across test matrix (low/median/high income × family sizes)
- [ ] Result never gated; email capture appends with the comparator source tag

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/lamal && pnpm test:e2e -g "comparator"`
- [ ] Build succeeds: `pnpm build && pnpm size`
- [ ] Manual check: sanity-check three scenarios against a published example each way

**Dependencies:** FW9, FW14
**Files likely touched:** `lib/lamal/{data,calc}.ts`, `app/(public)/calculateur-lamal-cmu/page.tsx`, `lib/fr/comparator.ts`, tests
**Estimated scope:** M

---

## FW20: Homepage, /releve-annuel, /tarifs, /sources, /a-propos

**Description:** The remaining public surface. `/`: one job — route to the calculator or the guides (no hero theatre). `/releve-annuel`: the offer page — a card with a summary list of exactly what the dossier contains (working days, CH days, telework, missions, annualised %, per-entry timestamps, late flags); linked from every calculator result. `/tarifs`: one honest page — gratuit en 2027, payant dès 2028 (D3). `/sources`: every regulatory source, dated, linked to admin.ch / AFC / impots.gouv.fr, generated from `lib/content/sources.ts`. `/a-propos`: who reviewed the rules (placeholder `TODO-REVIEWER` until the human gate resolves).

**Acceptance criteria:**
- [ ] All five pages live and meshed (home→calculator+guides; every calculator→/releve-annuel after the result; /sources linked from every guide footer)
- [ ] `/sources` renders from the same dataset the guides cite — one source of truth, no drift
- [ ] `/tarifs` contains no tier grid, no checkout, and states the 2027/2028 position verbatim

**Verification:**
- [ ] Tests pass: `pnpm test:e2e -g "public pages"` + mesh test
- [ ] Build succeeds: `pnpm build && pnpm lighthouse`
- [ ] Manual check: click every footer link — zero 404s

**Dependencies:** FW16, FW19
**Files likely touched:** `app/(public)/{page.tsx,releve-annuel,tarifs,sources,a-propos}/…`, `lib/content/sources.ts`
**Estimated scope:** M

---

# Checkpoint C — Public site complete (see plan.md; HUMAN GATE: domain + keywords before indexing)

---

# Phase 4 — Backend and API

> v2 note: the signed-in web app is gone (spec D14). These tasks build the API the Android app consumes, plus the dossier and PDF the server owns.

## FW21: Full Prisma schema + migrations + seed

**Description:** Extend the schema to spec §8 v2.1: `User` (settings incl. `loggingMode` MANUAL|AUTO_DETECT, `detectionConsentAt`, `granularity`, `denominatorKind`, `activityStartDate`, `reminderTime`, and the reserved nullable `organizationId`), `Entry` (unique `userId+dayDate+portion`, unique `clientMutationId`, immutable `firstRecordedAt`, `clientClaimedAt`, the provenance trio `provenance` / `detectedKind` / `detectedAt`, and `kind = ABSENT` with a required `absenceReason`), append-only `EntryEvent` carrying provenance, `Device` (FCM tokens), Auth.js tables. Dev seed generating a realistic logged year: manual days, detected-and-confirmed days, one corrected day, one late entry, one offline-synced entry, one unrecorded weekday.

**Acceptance criteria:**
- [ ] Migration applies cleanly on empty and on FW14-era databases; constraints and indexes match spec §8
- [ ] `EntryEvent` is effectively append-only and `firstRecordedAt` immutable — an attempted update fails a test
- [ ] `pnpm db:seed` produces the demo year including every provenance value, both flag cases, and at least one absence of each reason

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/db`
- [ ] Build succeeds: `pnpm prisma migrate deploy` in CI against a service container
- [ ] Manual check: Prisma Studio shows a corrected entry retaining its `detectedKind`

**Dependencies:** FW14
**Files likely touched:** `web/prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`, `lib/db/client.ts`
**Estimated scope:** M

---

## FW22: Auth — magic link, App Link callback, device tokens

**Description:** Auth.js v5 email provider (Resend), `trustHost: true`. Two callback paths: browser (for account operations) and **Android App Link**, which issues a short-lived access token plus a long-lived refresh token to the device. Token refresh and revoke endpoints. `/.well-known/assetlinks.json` served from the web app with the package name and cert fingerprints. **No `/connexion` or `/inscription` pages** — remove them if scaffolded, and confirm no session cookie is set on any public route.

**Acceptance criteria:**
- [ ] Magic-link round trip completes through the App Link callback and returns a usable token pair; refresh and revoke work; sign-out invalidates
- [ ] `assetlinks.json` validates against Google's App Links tester
- [ ] Network trace on every public route: zero cookies, zero third-party requests (the v1 cookie exception is withdrawn)

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/auth && pnpm test:e2e -g "auth"`
- [ ] Build succeeds: `pnpm build`
- [ ] Manual check: magic-link email renders in French; SPF/DKIM verified on the Resend domain

**Dependencies:** FW21
**Files likely touched:** `lib/auth/**`, `app/api/auth/**`, `app/api/v1/token/route.ts`, `public/.well-known/assetlinks.json`
**Estimated scope:** M

---

## FW23: Entries API `/v1` — timestamps, provenance, coordinate rejection

**Description:** `GET /api/v1/entries?year=` and batch `POST /api/v1/entries`, the endpoint offline sync replays. Zod-validated payload of `{clientMutationId, dayDate, portion, kind, absenceReason?, note?, provenance, detectedKind?, detectedAt?, clientClaimedAt?}`; `absenceReason` required iff `kind = ABSENT`. The server assigns `recordedAt`/`firstRecordedAt` from its own clock — **no client value accepted for these**. Upsert on `userId+dayDate+portion`, latest receipt wins for `kind`, every write appends an `EntryEvent`. **The schema rejects any payload containing latitude, longitude, accuracy, altitude, speed, or a provider name** (spec D18). All day math in Europe/Paris, tested at both DST transitions. This contract is frozen once AN4 starts.

**Acceptance criteria:**
- [ ] A payload setting `recordedAt` is rejected or ignored — the server clock wins (test); `clientClaimedAt` stored verbatim when supplied
- [ ] A payload containing any coordinate field returns 400 with a French error, and the test asserting this is named so it cannot be deleted quietly
- [ ] Editing preserves `firstRecordedAt` and `detectedKind`, appends a MODIFIED event with its provenance; tenancy enforced from the token only; **a replayed batch with a seen `clientMutationId` writes no row and no event**

**Verification:**
- [ ] Tests pass: `pnpm vitest run app/api/v1/entries`
- [ ] Build succeeds: `pnpm typecheck`
- [ ] Manual check: DST-boundary unit tests present for late-March and late-October

**Dependencies:** FW21, FW22
**Files likely touched:** `app/api/v1/entries/route.ts`, `lib/entries/{service,validation}.ts`, tests
**Estimated scope:** M

---

## FW24: Dossier service

**Description:** `GET /api/v1/dossier?year=` returning the computed statement: identity block, four metrics, engine result (declarable rate, status, headroom), monthly breakdown (Suisse / Domicile / Mission FR / Mission tiers / cumulative declarable %), and the evidence annex — every entry with date, portion, kind, note, provenance in words, `firstRecordedAt`, last-modified when different, `clientClaimedAt` when synced offline, and the late flag. Unrecorded working days appear as `Non renseigné` rows rather than being skipped; absences appear as `Absence — congé` (etc.) rows and are counted once as *Absences déclarées* in the identification block. **The aggregation filters `ABSENT` out before building `TeleworkInput`.** The engine is called with the dossier year's `RuleSet`. Partial years are marked provisional with the period covered.

**Acceptance criteria:**
- [ ] For the seeded year, metrics and every monthly cumulative % match a direct `calculateTelework` call exactly, including truncation (12,91 % not 12,92 %)
- [ ] Annex includes gap rows; provenance is a French phrase, not an enum leaked to the client
- [ ] A year with no entries returns an honest empty payload, not zeros; engine output is identical for the seeded year with and without its absence rows

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/dossier`
- [ ] Build succeeds: `pnpm typecheck`
- [ ] Manual check: hand-check one month against the seed data

**Dependencies:** FW23
**Files likely touched:** `lib/dossier/{aggregate,annex,payload}.ts`, `app/api/v1/dossier/route.ts`, tests
**Estimated scope:** M

---

## FW25: Exports — CSV, print route, PDF

**Description:** `GET /api/v1/export/csv?year=` with exact columns `dayDate, portion, kind, absenceReason, provenance, detectedKind, note, firstRecordedAt, lastModifiedAt, clientClaimedAt, late`, UTF-8 with BOM. `/releve/print?year=&token=` — a signed-token, noindex print route rendering the document with the annex **always expanded**, A4 print CSS, Inter, black rules, colour only from the three status tokens plus the two country dot colours, logo ≤24px. `GET /api/v1/export/pdf?year=` drives headless Chromium over it and returns the file, with a concurrency guard so one export cannot OOM the VPS.

**Acceptance criteria:**
- [ ] PDF is A4 and contains the rail (same generator), the both-thresholds sentence, provenance per annex row, and gap rows — asserted by extraction
- [ ] Document contains none of `certifié|attesté|conforme|validé|approuvé` — asserted by a text test (spec §12)
- [ ] CSV header snapshot exact; both endpoints 401 without a token and 403 for another user's year; two concurrent PDF requests serialize and both succeed

**Verification:**
- [ ] Tests pass: `pnpm test:e2e -g "export|pdf"`
- [ ] Build succeeds: Docker build with the Chromium layer; image size recorded
- [ ] Manual check: print the PDF in greyscale — nothing is lost

**Dependencies:** FW24
**Files likely touched:** `app/api/v1/export/**`, `app/releve/print/page.tsx`, `lib/pdf/render.ts`, print SCSS, `Dockerfile`
**Estimated scope:** M

---

## FW26: Account export, deletion, hygiene jobs

**Description:** `GET /api/v1/account/export` (JSON + CSV of every entry and event) and `POST /api/v1/account/delete`, cascading user, entries, events, devices, and sessions. `GET/PATCH /api/v1/me` for settings including `loggingMode` and `detectionConsentAt` — revoking detection consent is a settings write, and the API records when. Retention jobs: purge unconfirmed alert subscribers after 30 days, prune dead FCM tokens.

**Acceptance criteria:**
- [ ] Export contains every entry **and every event**, matching database counts; deletion removes rows across all five tables and invalidates tokens
- [ ] Consent revocation is timestamped and returned to the client so the app can stop sampling immediately
- [ ] Hygiene jobs are idempotent and logged

**Verification:**
- [ ] Tests pass: `pnpm vitest run app/api/v1/account`
- [ ] Build succeeds: `pnpm build`
- [ ] Manual check: delete a seeded account, confirm nothing survives

**Dependencies:** FW23
**Files likely touched:** `app/api/v1/account/**`, `app/api/v1/me/route.ts`, `lib/jobs/**`, tests
**Estimated scope:** M

---

## FW27: Reminder scheduler + FCM

**Description:** pg-boss started once in `instrumentation.ts` behind a `globalThis` guard. Per-user daily job at `reminderTime` **Europe/Paris**, sent **only if today is unconfirmed**, exactly one, idempotent on user+date. In auto mode the payload carries the pending proposal so the notification can offer confirm and correct actions. `POST /api/v1/devices` registers FCM tokens; 404/410 responses prune them.

**Acceptance criteria:**
- [ ] Opt-in → one push on an unconfirmed day, none on a confirmed day, none after opt-out (test clock)
- [ ] Scheduler singleton proven: hot-reload and a two-instance test do not double-send
- [ ] Dead tokens pruned; a user with no device is skipped without error

**Verification:**
- [ ] Tests pass: `pnpm vitest run lib/push`
- [ ] Build succeeds: `pnpm build`
- [ ] Manual check: real push received on a test device

**Dependencies:** FW23, FW26
**Files likely touched:** `instrumentation.ts`, `lib/push/**`, `app/api/v1/devices/route.ts`, jobs
**Estimated scope:** M

---

## FW28: Deployment — Docker, Coolify, backups

**Description:** Multi-stage Dockerfile: Next standalone, **`ENV HOSTNAME="0.0.0.0"`** in the runner (502 otherwise behind the proxy), Chromium + Inter layers, `TZ=Europe/Paris`. **Coolify's deploy health check points at `/api/ready`, NOT `/api/health` (ruling R83)**: readiness returns 503 while degraded, which stops a deploy and leaves the running version serving; liveness returns 200 whenever the process answers, because an orchestrator RESTARTS what fails liveness and a restart cannot supply a missing environment variable. Wire the restart policy, if any, at `/api/health`. Env checklist including `FCM_SERVICE_ACCOUNT_JSON`, `PDF_TOKEN_SECRET`, `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_CERT_FINGERPRINTS`, and **two added by ruling R81**: `NEXT_PUBLIC_SITE_URL` (the absolute site origin — unset means the localhost stand-in, and a *serving* process with the stand-in returns 503 from `/sitemap.xml` and from `/api/ready`, reports `degraded` from `/api/health`, and omits canonicals) and `FRONTALIER_RUNTIME=1` (**the runner stage must set this** — it is the marker that distinguishes serving from building, which `NODE_ENV` cannot: `next build` sets `NODE_ENV=production` too, and an earlier guard keyed on it broke every local build). Proof lives in `web/e2e/guard.runtime.spec.ts`, run by `pnpm test:runtime` against a `next start` with the marker set and the origin unset — including one test that reads BOTH endpoints in the same process at the same moment, which is the only way the R83 split can be shown to be real. Postgres as a managed service with automated daily dumps — **the entries table is the product**. Umami deployed same-origin. **GlitchTip deployed as a Coolify service; the backend reports to it with email addresses and entry payloads scrubbed** (spec D32). Existing VPS sites untouched.

**Acceptance criteria:**
- [ ] Container runs: health 200, auth round trip, PDF export, all inside the image; a thrown test error appears in GlitchTip with no email in the event
- [ ] `docs/deploy.md` covers env, ports, backup **and a tested restore**, plus the do-not-touch list for co-hosted sites
- [ ] Staging trace: zero third-party requests, analytics same-origin, public routes cookie-free

**Verification:**
- [ ] Tests pass: `pnpm test:e2e` against the container
- [ ] Build succeeds: `docker build` in CI
- [ ] Manual check: Coolify staging deploy green; backup file present after the first nightly run

**Dependencies:** FW25, FW27
**Files likely touched:** `Dockerfile`, `docker-compose.yml`, `app/api/health/route.ts`, `app/api/ready/route.ts`, `docs/deploy.md`, CI
**Estimated scope:** M

---

## FW29: Web + backend release audit

**Description:** Walk the web and backend halves of spec §21 and produce `docs/release-audit-web.md` with evidence per criterion. Re-run the full suite on staging. Confirm the human gates: fixtures freeze (Checkpoint A), domain and keywords (Checkpoint C).

**Acceptance criteria:**
- [ ] Every web/backend §21 checkbox has linked evidence; gaps fixed
- [ ] Full suite green on staging in one run
- [ ] `fixtures/geneva-cases.json` is published and frozen for the Android port to consume

**Verification:**
- [ ] Tests pass: `pnpm test && pnpm test:e2e && pnpm test:visual && pnpm test:a11y && pnpm size && pnpm lighthouse`
- [ ] Build succeeds: staging deploy from CI
- [ ] Manual check: read the audit — would you sign it?

**Dependencies:** FW28
**Files likely touched:** `docs/release-audit-web.md`, `fixtures/geneva-cases.json`, fixes as found
**Estimated scope:** M

---

# Checkpoint D — Backend complete (see plan.md)

---

# Phase 5 — Android foundation

## AN1: Scaffold, FrontierTheme, token lint fences, CI

**Description:** Android project: Kotlin, Compose, minSdk 26, single activity, Compose Navigation. **`FrontierTheme` wrapping `MaterialTheme`** — Frontier colour tokens (light + dark, light shipped), bundled Inter with `tabularNum`, type scale, and the radius set {4, 8, 12, 14, 16, 20, 24, 999} as the only shapes. Lint fences per spec §5: `calc/` imports nothing from `android.*`/`androidx.*`; `detection/` cannot import `data/remote`; **no coordinate type outside `detection/`**; no string literal in a composable; **no radius, colour, or spacing literal outside the token set in `ui/`**. CI: assemble, ktlint, detekt, unit tests, APK size check.

**Acceptance criteria:**
- [ ] App builds and launches to a placeholder Aujourd'hui with FrontierTheme applied and Inter rendering with tabular numerals
- [ ] Each fence fails CI on a planted violation (a `RoundedCornerShape(10.dp)`, a raw `Color(0xFF...)`, a `Location` type in `data/`, a literal string in a composable) — proofs captured, violations removed
- [ ] APK size check configured against the 12 MB budget

**Verification:**
- [ ] Tests pass: `./gradlew test`
- [ ] Build succeeds: `./gradlew assembleDebug ktlintCheck detekt`
- [ ] Manual check: side-by-side with the web calculator — same colours, same type, same radii

**Dependencies:** None (may run in parallel with the FW series once the design tokens are settled)
**Files likely touched:** `android/**` scaffold, `design/FrontierTheme.kt`, `design/Tokens.kt`, detekt/lint config, CI workflow
**Estimated scope:** M

---

## AN2: Kotlin engine port + shared conformance suite

**Description:** Port `lib/calc-engine` to `calc/` in Kotlin: same types, same waterfall, **same two rounding rules** (declarable rate truncated to 2 dp; headroom floored to the half-day, negatives reported), same warning codes, **the same `RuleSet` keyed by tax year with 2026 as the only set**, `Result` rather than exceptions. Convert the Geneva fixtures into `fixtures/geneva-cases.json` at the repo root and have **both** projects' CI consume that one file. Add the property invariants from spec §7.6 in Kotest.

**Acceptance criteria:**
- [ ] All six Geneva cases exact in Kotlin, including 39,16 % and 4,16 %; the TS suite reads the same JSON and still passes
- [ ] A deliberate one-digit change to the JSON fails **both** CIs — proven and reverted
- [ ] All eight invariants pass ×10,000 cases in Kotest; `calc/` has no Android import

**Verification:**
- [ ] Tests pass: `./gradlew :app:testDebugUnitTest` and `pnpm test` on the web side
- [ ] Build succeeds: both CIs green on the same fixture file
- [ ] Manual check: diff the two implementations' rounding sites — comments name the same rules

**Dependencies:** AN1, FW29 (fixtures frozen)
**Files likely touched:** `android/.../calc/**`, `fixtures/geneva-cases.json`, both CI workflows
**Estimated scope:** L — if it exceeds one session, split waterfall from rates/headroom as AN2a/AN2b

---

## AN3: Core components + screenshot tests

**Description:** The shared visual vocabulary in Compose: `ThresholdRail` (8 dp pill, ticks at 40 and 49,9 protruding, coloured by Zone, positioned by declarable rate), `ZoneBadge` (four statuses, Lucide icon + label + explanation), `RateDisplay` (Display 48/56, Inter tabular), `MetricTile`, `DayCell` (letter + 6 dp country dot for kind, 4 dp bar for record quality, corner triangle for corrected), `LegendRow`, `ConfidenceTier` (words + icon + 3 segments, no %). French formatters with codepoint-exact separators (U+00A0 before %, U+202F grouping, Swiss dot dates). Screenshot regression for every component in every state.

**Acceptance criteria:**
- [ ] Formatter tests assert **codepoints**, matching the web's output byte for byte
- [ ] Rail and badge render all zones/statuses; `mission-exposure` shows an amber badge on a green rail band, and a test asserts that pairing
- [ ] Screenshot baselines cover every `DayCell` state including late, missing, corrected, and today

**Verification:**
- [ ] Tests pass: `./gradlew test verifyPaparazziDebug`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: compare rail screenshots against the web SVG at the same width — pixel parity

**Dependencies:** AN2
**Files likely touched:** `android/.../ui/components/**`, `format/**`, screenshot tests
**Estimated scope:** M

---

## AN4: Auth, session, onboarding shell

**Description:** Email entry → magic link → **App Link** back into the app → token pair stored in `EncryptedSharedPreferences`, with transparent refresh and sign-out. Onboarding shell: canton, taux, méthode, décompte, début d'activité, pre-filled from install-referrer parameters when the user arrived from the web calculator. Four-destination Frontier bottom navigation (80 dp incl. safe area, 24 dp icons, active = brand colour) with placeholder screens; header greeting + date, no bell.

**Acceptance criteria:**
- [ ] Full sign-in round trip on a device; app reopens signed in after process death; sign-out clears tokens
- [ ] Install-referrer values pre-fill onboarding; absent referrer degrades to empty fields without error
- [ ] Bottom bar navigates all four destinations; exactly four; TalkBack announces the active one

**Verification:**
- [ ] Tests pass: `./gradlew test connectedDebugAndroidTest`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: click the magic link on the device, not in a desktop browser

**Dependencies:** AN3, FW22 (API contract frozen)
**Files likely touched:** `android/.../data/remote/**`, `auth/**`, `ui/screens/onboarding/**`, navigation
**Estimated scope:** M

---

## AN5: Room, repository, sync — manual mode end to end

**Description:** Room entities for entries and pending mutations; `EntryRepository` as the **only** writer; WorkManager sync replaying the queue to `POST /api/v1/entries` with exponential backoff. Every queued mutation carries a **client-generated UUID** (`clientMutationId`). Aujourd'hui in **manual mode**: hero rate from the local engine (with the current year's `RuleSet`), rail, three 56 dp large buttons (radius 14) each with its country dot and the nested mission destination choice, a tertiary « Déclarer une absence » action opening the reason choice, half-day rows when configured, confirmation row showing the **server** timestamp and provenance, unlogged-days strip. Optimistic write to Room with a pending marker until the server value returns.

**Acceptance criteria:**
- [ ] Log offline → kill the app → reopen → reconnect → entry syncs, with `clientClaimedAt` and the server `recordedAt` both stored and the pending marker cleared
- [ ] Local engine output matches the server dossier for the same days (cross-checked in a test)
- [ ] Conflict: same day edited offline and online → latest server receipt wins, both attempts present in `EntryEvent`; a retried mutation with the same UUID is acknowledged without a duplicate; an absence entry changes no figure on the hero

**Verification:**
- [ ] Tests pass: `./gradlew test connectedDebugAndroidTest`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: airplane-mode logging on a real device, then reconnect

**Dependencies:** AN4, FW23
**Files likely touched:** `android/.../data/local/**`, `data/repo/**`, `sync/**`, `ui/screens/aujourdhui/**`
**Estimated scope:** L — split as AN5a (Room + repo + sync) and AN5b (Aujourd'hui manual UI) if one session is not enough

---

# Checkpoint F — Manual-mode app is a complete product (see plan.md)

---

# Phase 6 — Detection

## AN6: Detection accuracy spike

**Description:** **A measurement, not a feature.** Source a Swiss border polygon (licence and date recorded), implement point-in-polygon with the 150 m buffer on-device, and **decide the background mechanism from measurements** — WorkManager periodic, geofence transitions, foreground service, or a combination — against the accuracy and battery budgets. Stage 1: a full working week on both sides of the Geneva frontier on one device, proposals compared against a hand-kept log. Stage 2 (after Checkpoint F): the manual-mode build distributed to **20–30 frontaliers** for two weeks with detection running silently alongside their manual entries, agreement measured **per tier**. Produce `docs/detection-model.md` with polygon source, buffer, hysteresis constants, tier thresholds, mechanism chosen, accuracy per tier, battery figure, and a recommendation against the pre-agreed threshold. **Build no detection UI in this task.**

**Acceptance criteria:**
- [ ] Agreement rate per tier reported against the thresholds agreed *before* stage 1 ran, with the disagreeing days listed and explained; the Checkpoint G decision tree (pass / border-only fail → AN7b / broad fail → manual-only) applied and recorded
- [ ] Background mechanism chosen with its measured trade-offs; if it requires a persistent notification, that UX cost is routed back as a design question before AN7
- [ ] Battery cost per working day measured on a real mid-range device
- [ ] Point-in-polygon correctness tested: points inside, outside, inside the 150 m buffer, within 500 m of the frontier, plus enclaves

**Verification:**
- [ ] Tests pass: `./gradlew test` (polygon unit tests)
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: `docs/detection-model.md` contains numbers and a recommendation, not adjectives

**Dependencies:** AN1
**Files likely touched:** `android/.../detection/{Polygon,Sampler}.kt`, `assets/ch-border.geojson`, `docs/detection-model.md`
**Estimated scope:** M — **this task gates Checkpoint G and all of AN7–AN9**

---

## AN7: Detection service — buffer, hysteresis, tiers, withholding

**Description:** Production detection using the mechanism chosen in AN6: sampling within the declared working window, per-fix three-way classification (Switzerland / elsewhere / **150 m border buffer**) with the **coordinate discarded immediately**, Room tallies of minutes per side plus fix and buffer-fix counts, **hysteresis** (side changes under 10 minutes folded back; significant after 30), evening classification through the engine's granularity rules into a proposal with a **HIGH / MEDIUM / LOW tier**, and **`LOW` withholding** — the day is offered for manual entry with a plain explanation. No tier writes an entry. Missions and absences are never auto-detected. The tally summary is exposed to the UI as « Base de la détection » and **never synced**.

**Acceptance criteria:**
- [ ] Full sampling-to-proposal cycle completes with the network stubbed to fail; nothing in the path touches Retrofit
- [ ] No coordinate is written to Room, logged, or emitted — proven by inspecting the database and log output after a simulated day
- [ ] Classification honours >4 h = 1 day and 2–4 h = ½ day; a 9-minute excursion is folded back and a 31-minute one is not; buffer fixes count for neither side; tier boundaries tested; `LOW` withholds rather than guesses

**Verification:**
- [ ] Tests pass: `./gradlew test`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: run a simulated day with injected fixes and read the resulting tally row

**Dependencies:** AN6 (go decision), AN5
**Files likely touched:** `android/.../detection/**`, `sync/DetectionWorker.kt`, Room tally entity, tests
**Estimated scope:** M

---

## AN7b *(conditional)*: Device-only geofences — the D31 contingency

**Description:** **Built only if Checkpoint G's decision tree lands on "border-only failure".** User-defined *domicile* and *lieu de travail* circles (radius from open question 7), captured once via the device's current position and **stored in encrypted device storage only** — never in Room's synced tables, never in a DTO, never logged, deleted in one tap, on sign-out, and on account deletion. Classification tests each fix against the circles before the polygon. Consent copy in onboarding is extended to say the two places stay on the phone. The API rejection test from FW23 is unchanged and still passes.

**Acceptance criteria:**
- [ ] The two geofence centres exist nowhere but encrypted device storage — proven by inspecting Room, the network trace, and the logs after a simulated week
- [ ] Deleting a place, signing out, or deleting the account removes them; the lint fence still forbids a coordinate type outside `detection/`
- [ ] Stage-2 accuracy re-run against the same threshold, recorded in `docs/detection-model.md`

**Verification:**
- [ ] Tests pass: `./gradlew test connectedDebugAndroidTest`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: define both places, log a week, then read the synced database — no coordinate anywhere

**Dependencies:** AN7, Checkpoint G decision
**Files likely touched:** `detection/Places.kt`, `detection/Classifier.kt`, onboarding copy, encrypted storage wrapper
**Estimated scope:** M

---

## AN8: Onboarding — mode chooser, permission priming, refusal

**Description:** The three linear screens from design prompt D5. Mode chooser with two **visually identical** cards, *Saisie manuelle* pre-selected. Priming screen stating what the app does, what it records, what it never does, and warning in advance about Android's two-step permission — shown **before** the system dialog, as Play requires. Refusal screen in neutral grey, no error icon, stating manual mode produces the same annual statement, one link to settings, and **no second ask ever**. Consent timestamped through `PATCH /api/v1/me`.

**Acceptance criteria:**
- [ ] Manual is the default; neither card carries a recommendation, highlight, or lock; the decline action is a real button
- [ ] Refusal path leaves the app fully functional with no banner, no repeat prompt, and no red dot anywhere afterwards
- [ ] Consent and revocation are both timestamped server-side; revoking stops sampling and clears local tallies immediately

**Verification:**
- [ ] Tests pass: `./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=*OnboardingTest`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: deny the permission on a device and use the app for a full day — count the prompts (must be zero)

**Dependencies:** AN7
**Files likely touched:** `ui/screens/onboarding/**`, `permissions/**`, `fr/strings.xml`
**Estimated scope:** M

---

## AN9: Aujourd'hui — auto mode

**Description:** The three states from design prompt D4b: *détection en cours* (quiet strip, no spinner, `Saisir maintenant` escape hatch), *à confirmer* (proposal card with detected kind, reason, detection window, **the confidence tier in words**, `Confirmer` / `Corriger`, and the line **« Rien n'est enregistré tant que vous n'avez pas confirmé »**), *confirmé* (confirmation row with server timestamp and provenance in words). Always-visible mode strip with `Changer`. Correcting writes `DETECTED_CORRECTED` and preserves `detectedKind`.

**Acceptance criteria:**
- [ ] **No code path creates an entry without a confirmation tap** — a test drives a full detection cycle without user input and asserts zero rows and a day still `Non renseigné`
- [ ] Confirm writes `DETECTED_CONFIRMED`; correct writes `DETECTED_CORRECTED` and retains the overridden `detectedKind` through sync
- [ ] Expired proposals disappear without writing; the day appears in the unlogged-days strip; a `HIGH`-tier proposal still requires the tap — a test asserts no auto-confirm at any tier

**Verification:**
- [ ] Tests pass: `./gradlew test connectedDebugAndroidTest`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: confirm one day, correct another, then read both in the dossier annex

**Dependencies:** AN8
**Files likely touched:** `ui/screens/aujourdhui/**`, `data/repo/EntryRepository.kt`, tests
**Estimated scope:** M

---

# Checkpoint G — Detection gate (see plan.md; HUMAN GATE on accuracy)

---

# Phase 7 — Complete the app

## AN10: Calendrier

**Description:** Month grid per design prompt D6 inside a white card: cells ≥ 44 dp, date 14/500, **letter + 6 dp country dot for kind** (S/D/M/A), **4 dp bottom bar for record quality** (green on time, amber late, grey missing, none for weekends/holidays/future), **corner triangle for corrected**, today outlined 2dp blue. Mandatory legend and a four-count month summary. Tap opens a Frontier bottom sheet (radius 24, drag indicator): kind choice with nested mission destination, the absence option with its reason, note field, the **provenance block in plain text** — what was detected, what was corrected, when it was first recorded — and, for detected days, **« Base de la détection »** (fixes, minutes per side, tier, buffer fixes discarded) read from the device tally only, plus the late notice stating the flag appears in the annual document. Cantonal holidays are display-only.

**Acceptance criteria:**
- [ ] Encoding correct across a seeded month; late tag appears exactly at the >7-day boundary (tested at 7 and 8)
- [ ] Editing preserves and still displays `firstRecordedAt` and `detectedKind`; a MODIFIED event is appended
- [ ] TalkBack announces kind, record quality, and provenance per cell — no meaning carried by colour or shape alone; an absence renders `A` with its quality bar and changes no figure on Aujourd'hui

**Verification:**
- [ ] Tests pass: `./gradlew test verifyPaparazziDebug connectedDebugAndroidTest`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: holiday table spot-checked for GE and VD against an official list; file header cites it

**Dependencies:** AN5 (manual) — auto states appear once AN9 lands
**Files likely touched:** `ui/screens/calendrier/**`, `ui/components/DayCell.kt`, `assets/holidays.json`
**Estimated scope:** M

---

## AN11: Relevé + exports

**Description:** The dossier screen per design prompt D7, rendered from the FW24 payload: provisional notice for a partial year, identity block, four metric tiles, zone panel with rail and the both-thresholds sentence, monthly table (missions merged to one column on mobile, with a line saying the split is in the annex and the PDF), collapsible evidence annex with provenance and late tags, legal footer. Exports call the API and hand the file to the Android share sheet. **PDF requires connectivity and says so.**

**Acceptance criteria:**
- [ ] Screen figures match the API payload exactly; annex rows show provenance and gap rows; cached payload is labelled with its computation date when offline
- [ ] PDF and CSV export end to end on a device and open in an external app
- [ ] Nothing on this screen is editable — no swipe action, no inline edit, no delete

**Verification:**
- [ ] Tests pass: `./gradlew test connectedDebugAndroidTest`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: export a PDF on a phone and read it in a PDF viewer

**Dependencies:** AN10, FW25
**Files likely touched:** `ui/screens/releve/**`, `data/remote/DossierApi.kt`, share intent
**Estimated scope:** M

---

## AN12: Paramètres

**Description:** Mode d'enregistrement with consent revocation, canton, taux, méthode, décompte, début d'activité, reminder time and opt-in, email, alert-list opt-in, **export de mes données** (JSON + CSV via the API, handed to the share sheet), and **suppression du compte** — a confirmation naming exactly what is destroyed, that the dossier cannot be regenerated, and clearing all local Room data as well as the server rows.

**Acceptance criteria:**
- [ ] Every setting persists, syncs, and immediately affects Aujourd'hui's computation
- [ ] Switching auto → manual stops sampling and clears tallies within the session; switching back re-primes consent properly
- [ ] Deletion removes server rows and the local database, and returns the app to a signed-out first-run state

**Verification:**
- [ ] Tests pass: `./gradlew test connectedDebugAndroidTest`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: delete a test account on a device and confirm a clean first run

**Dependencies:** AN9, FW26
**Files likely touched:** `ui/screens/parametres/**`, `data/repo/SettingsRepository.kt`, `detection/**` teardown
**Estimated scope:** M

---

## AN13: Notifications

**Description:** FCM registration through `POST /api/v1/devices`, permission request at the right moment (not at first launch), and the single daily reminder — **exactly one**, at the user's chosen time, only when today is unconfirmed. In auto mode it carries the proposal with confirm and correct actions handled from the notification. Opt-in; degrades silently when denied, with the in-app unlogged-days strip as the only fallback.

**Acceptance criteria:**
- [ ] Exactly one notification per unconfirmed day; none when confirmed; none after opt-out
- [ ] Notification actions write the correct provenance and update the app state
- [ ] No second reminder, no digest, no streak — asserted by reading the scheduler code and a test over a simulated week

**Verification:**
- [ ] Tests pass: `./gradlew test`
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: receive and act on a real notification from the lock screen

**Dependencies:** AN9, FW27
**Files likely touched:** `notifications/**`, `data/remote/DeviceApi.kt`, manifest
**Estimated scope:** M

---

## AN14: Play Store release preparation

**Description:** Release build with R8, App Bundle, Play App Signing, mapping upload. **Data safety form matching spec §13 line by line** — location collected but not stored or shared, processed on-device only. **Background-location justification** plus the demo video showing the in-app prominent disclosure before the system dialog. Privacy policy linked from the listing and from Paramètres. Internal → closed testing track configured. Forced-update mechanism wired to a minimum-supported-version flag from the API.

**Acceptance criteria:**
- [ ] Release bundle installs and runs; APK download size within the 12 MB budget; cold start within 1,2 s on a mid-range device
- [ ] Data safety declarations verified against the code, not against intentions — each claim traced to where it is enforced
- [ ] Closed testing track live with at least one external tester completing sign-in, a week of logging, and a PDF export

**Verification:**
- [ ] Tests pass: `./gradlew test connectedDebugAndroidTest`
- [ ] Build succeeds: `./gradlew bundleRelease` + Play upload accepted
- [ ] Manual check: watch the demo video as a reviewer would — is the disclosure unmistakably before the dialog?

**Dependencies:** AN13, AN11
**Files likely touched:** `android/app/build.gradle.kts`, `proguard-rules.pro`, store listing assets, `docs/play-release.md`
**Estimated scope:** M

---

## AN15: Android hardening audit

**Description:** Walk the Android half of spec §21 and produce `docs/release-audit-android.md` with evidence per criterion. Re-run everything: engine conformance, detection cycle offline, coordinate absence across lint + API + database inspection, battery measurement, screenshot baselines, TalkBack pass, 200% text scale, both modes producing an identical dossier from the same days.

**Acceptance criteria:**
- [ ] Every Android §21 checkbox has linked evidence; gaps fixed
- [ ] Manual-mode and auto-mode dossiers from identical days are byte-identical apart from provenance strings
- [ ] Open human gates listed explicitly as launch blockers, not silently skipped

**Verification:**
- [ ] Tests pass: full Gradle suite plus screenshot and instrumentation runs
- [ ] Build succeeds: `./gradlew bundleRelease`
- [ ] Manual check: read the audit — would you sign it?

**Dependencies:** AN14 (and all prior)
**Files likely touched:** `docs/release-audit-android.md`, fixes as found
**Estimated scope:** M

---

# Checkpoint E — Complete (see plan.md; HUMAN GATES: reviewer sign-off, Play acceptance)
