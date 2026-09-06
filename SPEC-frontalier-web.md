# Spec: frontalier-web — unified build

Project id: `frontalier`
Version: **2.2 — design system replaced: IBM Carbon → Frontier Work v1.0 (see `DESIGN-SYSTEM.md`, 03.09.2026). Product model unchanged from v2.1.**
Status: awaiting review
Supersedes: v1 of this document, plus `SPEC-calc-engine.md` v2, `SPEC-ui-foundation.md` v2, `SPEC-calc-web.md`, and the build-relevant content of `design.md`, `architecture.md`, and `frontalier-telework-dossier.md`. All normative rules from those documents are carried into this one except where §2 records a reversal.

> **What this document is.** One product, two clients, one backend.
>
> - **Web (Next.js)** — the public acquisition surface: calculator, LAMal/CMU comparator, guides, alert list, legal pages. No signed-in area.
> - **Android (Kotlin/Compose)** — the app: daily logging, **automatic location detection with user confirmation**, the calendar, the dossier, exports.
> - **Backend** — one Postgres database and one API serving both, and the authority for timestamps, the dossier, and the PDF.
>
> Section 2 records every decision that changed, including the ones that reverse v1. Read it first if you knew the old plan. The most important reversals: geolocation is now in scope, native Android replaces the PWA, and the signed-in web app is gone.

---

## 1. Objective

A French-language product for French-resident cross-border workers employed in Switzerland.

**Web — public, no account (Next.js):**

1. **The calculator** — how many telework days remain before the 40% fiscal and 49.9% social ceilings.
2. **The LAMal/CMU comparator** — estimated annual cost either way, with the irrevocability warning.
3. **The guides** — a pillar page on the 40% rule plus six cluster guides, internally meshed for SEO.
4. **The alert list** — double-opt-in email capture: "get notified when the rules change", and the pre-launch waiting list for the app.

**Android — the app (Kotlin/Compose):**

5. **Two logging modes, chosen by the user and switchable at any time:**
   - *Saisie manuelle* — the user taps in where they worked, one gesture a day. No location data is collected at all.
   - *Détection automatique* — the phone determines from location whether the working day was spent in Switzerland or at home, and **proposes** it each evening. The user confirms or corrects. **The app never records a day by itself.**
6. **The calendar** — month grid showing, per day, where the user worked *and the quality of the record*: on time, late, missing, corrected.
7. **The dossier** — the *Relevé annuel de télétravail*: an audit-defensible A4 PDF plus CSV, with an evidence annex carrying, per entry, its server timestamp **and its provenance**.

The product is the dossier; the logging is the mechanism that makes it credible. Detection makes the logging effortless — it does not make the record. **The user's confirmation is what creates the entry**, because a day written by a phone is the phone's assertion, while a day confirmed by the worker is the worker's declaration, and only the second is worth anything in front of an administration.

A wrong number costs the user money. The calculation engine reproduces the Geneva tax administration's five published worked examples exactly, including their rounding, on **both** clients, or nothing ships.

### Non-goals (whole project)

- No tax advice, no monetary amounts, no recommendations. The product records, computes days and rates, and formats.
- No payments. Free through 2027; `/tarifs` says so honestly. Billing is a later project.
- **No signed-in web app.** The tracker, calendar, and dossier exist only on Android. The web surface is public and anonymous.
- No iOS at launch. No employer/HR dashboard. No Germany/Italy corridors. No German or Italian localisation, and no i18n abstraction to prepare for it.
- **No map, no pin, no route, no location history in any interface.** The app shows a conclusion per day, never the movements behind it.
- **No raw coordinates are ever stored or transmitted.** See §13.
- No dark theme. The dossier is always light; dark doubles QA on the least valuable surface.
- No blog, no comments, no forum, no multi-language switcher, no charts, no gamification, no onboarding tour.
- No admin UI. Alert subscribers and users are managed via the database.

---

## 2. Consolidation decisions — what changed and why

Unifying the phases forced concrete choices. Each is a deliberate deviation from the source documents, recorded here so review can veto them individually.

| # | Decision | Replaces | Rationale |
|---|---|---|---|
| D1 | **Single Next.js app, single repo.** Internal module boundaries (`lib/calc-engine`, `lib/ui/core`, `lib/ui/react`) enforced by ESLint import rules, not workspace packages. | pnpm workspace with `packages/calc-engine`, `packages/ui-foundation`, `apps/calc-web` | "One project" was the instruction. The boundaries that mattered (engine purity, no React in core) survive as lint rules; the workspace overhead does not. |
| D2 | **One rendering paradigm: React everywhere.** The vanilla-TS Core tier for the calculator page is dropped. `lib/ui/core` survives as *pure TypeScript with no React imports* (rail generator, formatters, zones) because the PDF and OG routes still need DOM-free rendering — but the calculator page is a React island like everything else. | ui-foundation's two-tier architecture and the 15 KB phase-0 budget | Maintaining two interactivity paradigms in one codebase built in one pass doubles work for a budget that only made sense when the calculator shipped alone. New budgets in §17 replace 15/60/200. |
| D3 | **`/tarifs` is one honest page** — "Gratuit en 2027. Payant dès 2028 (CHF 39–49/an prévu)." | The phase-1 A/B price test (39/an vs 5/mois landing pages) | The A/B test was a phased-rollout experiment. Price framing can still be tested later via the alert list; it does not belong in the build. |
| D4 | **Homepage ships at launch.** `/` routes to the calculator or the guides; no redirect period. | Phase 0's "the calculator is the homepage, `/` 302-redirects" | With guides and the app shipping simultaneously, the redirect rationale is gone. |
| D5 | **Contextual links point at real guides from day one.** | The phase-0 fallback where all four statuses pointed at `/alertes` | The guides exist at launch. The mapping table in §9.3 is final. |
| D6 | **Auth is passwordless magic-link (Resend).** `/mot-de-passe-oublie` is removed from the route map. | architecture.md's login/signup/forgot-password triple | No password storage, one fewer screen, fits a compliance audience. Auth.js v5 email provider. |
| D7 | **The daily reminder is Web Push (VAPID) scheduled server-side**, default 17:30 Europe/Paris, exactly one per day, opt-in. | design.md's "one daily local notification" | Locally-scheduled PWA notifications (Notification Triggers API) never shipped in browsers. Server-scheduled push is the only reliable implementation. Degrades gracefully to the in-app "jours non renseignés" banner if permission is denied. |
| D8 | **Canton guide: Genève only at launch.** | architecture.md's open list of canton pages | Its own recommendation — test one before building twenty-six. |
| D9 | **Tracker granularity: day and half-day. Hours mode is calculator-only.** Half-days log as AM/PM portions. | calc-engine exposes three granularities; design.md's tracker implied day-only | The three-button daily log has no sane hourly UX. The engine keeps `hours` for the calculator's exact-method users; the tracker validates against it. |
| D10 | **Cantonal holidays appear in the calendar as display-only styling**, from a static per-canton JSON, clearly non-authoritative, never used in calculation. | calc-engine v2 removed the holiday table entirely; design.md's calendar still greys holidays | Both documents are right: the simplified-240 basis needs no holiday arithmetic, but the calendar UI still reads better with holidays greyed. Display only. |
| D11 | **Account deletion and data export (JSON + CSV) ship in Paramètres.** | Not in any source doc | A compliance product collecting logs from French residents cannot ship without nLPD/GDPR data rights. |
| D12 | **Cookies: none on public routes; an essential session cookie on `/app` and auth routes only.** No consent banner (essential-only + cookieless self-hosted analytics). | calc-web's "zero cookies of any kind" | Auth requires a session cookie. The public acquisition surface keeps the original guarantee. |

### v2 decisions — the Android and auto-detection pivot

These **reverse** parts of v1. Where a v2 decision conflicts with a v1 one, v2 wins.

| # | Decision | Reverses | Rationale |
|---|---|---|---|
| D13 | **The tracker is a native Android app** (Kotlin, Jetpack Compose), not a PWA. | D2's single-codebase premise; v1 §13 | Reliable background location is impossible in a browser. Once detection is the core mechanic, the platform follows it. |
| D14 | **The signed-in web app is deleted.** `/app/*`, `/connexion`, `/inscription` are removed from the web project. Web is public and anonymous. | v1 §9.1, §10, §11 | Two full clients for one signed-in experience is waste. The web's job — rank, convince, capture the email — never needed auth. |
| D15 | **Location auto-detection is in scope**, as an opt-in mode with explicit consent. | The one-pager's "not doing: zero-input geolocation tracking" | Owner's decision. The stated risks (battery, nLPD/GDPR, audit double-edge) are handled by D16–D19 rather than by avoidance. |
| D16 | **Detection proposes; the user disposes.** No entry is ever written without a confirmation tap. The proposal expires unconfirmed rather than auto-committing. | — (new) | Preserves the declaration model that gives the dossier its value, and keeps the app from asserting facts about the user's movements. |
| D17 | **Provenance is a first-class field on every entry**: `MANUAL`, `DETECTED_CONFIRMED`, or `DETECTED_CORRECTED`, plus the detected value when it was overridden. It is printed in the annex and the PDF. | — (new) | An automated log that the user overrode is discoverable. The document is stronger stating the override than hiding it. |
| D18 | **No coordinates are stored or transmitted, ever.** Country determination happens **on-device** against a bundled border polygon; the device keeps only a per-day tally of work-hours-in-Switzerland and derives a conclusion. Coordinates never leave the sampling function. | — (new) | Data minimisation is both the nLPD/GDPR answer and the audit answer: there is no movement history to subpoena, and no reverse-geocoding call to leak. |
| D19 | **Manual mode is a peer, not a fallback.** Full feature parity, identical dossier, no nagging, no "recommandé" tag, no degraded state when permission is refused. | — (new) | Play Store review scrutinises background-location justification, and users deny it routinely. An app that only works with the permission is an app that mostly doesn't work. |
| D20 | **The calculation engine is ported to Kotlin and the Geneva fixtures become a shared, language-neutral JSON conformance suite** that both implementations must pass in CI. The server remains authoritative for the dossier and the PDF. | D1's single-engine assumption | The app needs an instant offline rate; the document needs one source of truth. Shared fixtures are what stop the two from drifting. |
| D21 | **Reminders move from Web Push to FCM**, still server-scheduled by pg-boss, still exactly one per day, still opt-in. | D7 | Same design, correct transport for the platform. |
| D22 | **Offline queue moves from Serwist/IndexedDB to Room + WorkManager.** Same contract: queue locally, sync on reconnect, server assigns the timestamp on receipt and stores the client-claimed time alongside. | v1 §13 | Platform-native equivalent; the evidence semantics are unchanged. |
| D23 | **Auth becomes magic link with an app deep link**, issuing a long-lived refresh token to the device. No passwords anywhere. | D6 (extended, not reversed) | A tax app the user opens daily must not demand a login every session. |
| D24 | **Carbon is kept as the visual language on Android**, implemented as a Compose theme (tokens, type, zero radius), with Android conventions for navigation, back, and permissions. Material components are not used. | — (new) | The institutional register is the product's credibility. Material's rounded, elevated surfaces would undo it. |

### v2.1 decisions — adopted from the external review

Additive. None reverses a v2 decision; D16 and D18 in particular are reaffirmed.

| # | Decision | Rationale |
|---|---|---|
| D25 | **Border buffer.** A fix within 150 m of the frontier (computed on-device from the polygon) contributes to neither tally and lowers the day's confidence tier. | A 30–100 m GPS envelope makes a fix near the line meaningless. Withholding on *few* fixes was not enough; we also withhold on *near* fixes. |
| D26 | **Temporal stability.** A country change shorter than 10 minutes is ignored; a stay longer than 30 minutes is significant. Implemented as hysteresis on the tally, on-device. | Addresses GPS flicker for someone living 5 km from Geneva. Cheap, deterministic, testable. |
| D27 | **Tiered confidence** — `HIGH` / `MEDIUM` / `LOW` — replaces the binary flag. The tier is shown on the proposal card in words. `LOW` withholds the proposal. **No tier auto-confirms.** The confirmation tap remains the only way an entry is created (D16 reaffirmed). | Tells the user how sure the app is without letting the app decide for them. |
| D28 | **Absence days.** `EntryKind.ABSENT` with an `absenceReason` (`CONGE`, `MALADIE`, `FERIE`, `AUTRE`). Record-only: an absence **never reaches the engine** and never changes any figure. It closes a gap that *Non renseigné* leaves open. | A calendar and an annex that explain their gaps are more credible than ones that leave holes. |
| D29 | **Rule versioning.** The engine's constants become a `RuleSet` keyed by tax year (`2026` is the only set at launch and the default). A dossier for year *Y* computes under the rules of *Y* forever. The Geneva fixtures are pinned to `2026` and must not change. | The rules change annually and the product's stated moat is carrying that burden. |
| D30 | **Client mutation ids.** Every queued write carries a client-generated UUID; the server deduplicates on it in addition to the natural key. | Makes offline retries unambiguous. |
| D31 | **Device-only geofences as a named contingency.** If the polygon-only model fails its accuracy gate, the fallback is user-defined *domicile* and *lieu de travail* geofences **stored on the device only, never synced, deletable in one tap**. The server guarantee of D18 is unchanged. Built only if Checkpoint G triggers it. | The one place the external design is more likely to work near Geneva's suburban border. Written down now so failure has a path other than abandoning auto mode. |
| D32 | **Backend error monitoring**, self-hosted (GlitchTip) on Coolify. **No monitoring SDK in the app** — FCM remains the only third-party SDK. | We had none. The app constraint stands. |
| D33 | **`organizationId` (nullable) on `User`** from the first migration. No organisation features are built. | Our own one-pager asked for this and the v2 schema forgot it. Costs nothing now, saves a migration later. |
| D34 | **Coordinate-free evidence in the edit sheet** — « Base de la détection »: number of fixes, minutes attributed to Switzerland and elsewhere, confidence tier, border-proximity flag. **Kept on the device; never synced; not printed in the dossier.** | Lets the user judge a proposal without the app ever holding a location. |

### v2.2 decisions — design system

| # | Decision | Reverses | Rationale |
|---|---|---|---|
| D35 | **Frontier Work v1.0 replaces IBM Carbon** as the design system on web, Android, and the PDF. Tokens, type (Inter), radius (4–24, pill), colour (neutral canvas `#F7F8FA`, brand `#173B63`, France/Switzerland accents, status set), Lucide icons, components, and motion are adopted in full. `DESIGN-SYSTEM.md` is the single source. | D24 (Carbon on Android), v1 §6 | Owner's decision. The warmer, rounded register (Apple/Linear/Stripe) is chosen over Carbon's institutional one. |
| D36 | **Product overrides on the design system are recorded in `DESIGN-SYSTEM.md` §2** and bind the design prompts: no map, no live location indicator, no day timeline, no avatars, no notification bell, evidence content coordinate-free, confidence as a tier in words (no %), regulatory bands 40/49.9 kept on the rail with in-band alerts at 30/38, four screens named Aujourd'hui/Calendrier/Relevé/Paramètres, onboarding order per D19, no success animation on logging, pending sync never a toast, French copy. | — | A design system governs how things look; it cannot add data the product refuses to hold (D18) or reverse D16/D19. |
| D37 | **Android uses Compose `MaterialTheme` wrapped in `FrontierTheme`.** Material components are permitted, themed. The lint fence on shapes becomes: **every radius is a token** — any `.dp` radius outside {4, 8, 12, 14, 16, 20, 24, 999} fails the build. | D24's Material ban; §5 `RoundedCornerShape` fence | Matches Frontier §73. |
| D38 | **Kind indicators gain a country colour**: Suisse = `#D84B4B` dot, Domicile = `#315FA8` dot, Mission = neutral, Absence = tertiary. Always accompanied by the word or the letter. **No flag emoji anywhere.** | — | Frontier §10/§26, minus emoji (inconsistent across OEMs, absent from the PDF). |
| D39 | **Dark mode tokens adopted; light ships first**, dark after launch. | — (reaffirms v1 §6.1) | The PDF is always light; dark doubles QA on the least valuable surface. |
| D40 | **Touch targets: 44 px web, 48 dp Android.** | v1 §16 (48 everywhere) | Frontier §68 plus the Android platform guideline. |

Everything else — the calculation, the rounding rules, the zone/status distinction, the URL param contract, the design tokens, the linking mesh, the timestamps-as-evidence model — is carried over unchanged.

---

## 3. Tech stack

- **Next.js 15, App Router, React 19, TypeScript 5.x** — `strict: true`, `noUncheckedIndexedAccess: true`.
- **Design system: Frontier Work v1.0** (`DESIGN-SYSTEM.md`). Our own component library on Sass + CSS custom-property tokens; `lucide-react` for icons. No third-party UI kit.
- **Fonts self-hosted**: `@fontsource-variable/inter`, subsets `latin` + `latin-ext` (French needs é à ç ê î ï ô û œ), with `tnum` enabled for all figures. **Never the Google Fonts CDN** — German courts have found it breaches GDPR by transmitting visitor IPs; a known privacy defect on the front page of a compliance product is disqualifying.
- **MDX** for guides, statically generated.
- **Umami, self-hosted**, cookieless, script served same-origin. Zero third-party network requests on any page — verified by a network-trace test.
- **Sass only. No CSS-in-JS. No Tailwind.**
- Web testing: Vitest, fast-check, React Testing Library, jest-axe, Playwright (E2E + visual regression), size-limit + Lighthouse CI as blocking checks.
- Web lint: ESLint (import-boundary rules, no-restricted-imports), `stylelint-declaration-strict-value` (no raw hex, no raw px outside tokens).

### Backend (Node, colocated with the web project)

- **Prisma + PostgreSQL** — users, entries, entry events, subscribers, device tokens.
- **Auth.js v5** — email magic-link via Resend, `trustHost: true` (required behind the reverse proxy). For Android, the magic link opens an **App Link** and the callback issues a refresh token (D23).
- **Resend** — magic links, alert-list sends, double-opt-in confirmations.
- **pg-boss** — scheduled jobs (daily reminders, retention hygiene), started once in `instrumentation.ts` behind a `globalThis` guard so hot-reload and multiple workers don't duplicate the scheduler.
- **Firebase Cloud Messaging** — reminder delivery to devices (D21). FCM is the only third-party service the Android app talks to besides our own API.
- **PDF**: headless Chromium (Playwright) printing a dedicated server-rendered print route. The server is the sole PDF authority; the app requests and receives the file.

### Android

- **Kotlin, Jetpack Compose, minSdk 26, targetSdk current.** Single-activity, Compose Navigation.
- **`FrontierTheme` wrapping Compose `MaterialTheme`** (D37): Frontier tokens, Inter (bundled), token-only radii. Material3 components are permitted, themed. A lint check rejects any radius, colour, or spacing literal not in the token set.
- **Room** — local entries, pending mutations, detection tallies.
- **WorkManager** — sampling schedule, evening proposal, sync, retries.
- **Play Services Location** — `FusedLocationProviderClient` with balanced-power priority, plus geofencing where it reduces sampling cost.
- **Bundled Swiss border polygon** for on-device country determination (D18). No reverse-geocoding, no Maps SDK, no network call in the detection path.
- **kotlinx.serialization**, **Retrofit/OkHttp** for the API, **DataStore** for settings.
- Android testing: JUnit5 + Kotest for the ported engine, Robolectric for logic, Compose UI tests, Paparazzi (or Roborazzi) for screenshot regression, Macrobenchmark for startup, Android Lint + ktlint/detekt as blocking checks.
- Shared with web: `fixtures/geneva-cases.json` — the language-neutral conformance suite both engines must pass (D20).

---

## 4. Commands

```
Install:     pnpm install
Dev:         pnpm dev                  → http://localhost:3000
Build:       pnpm build
Start:       pnpm start
DB:          pnpm prisma migrate dev / pnpm prisma studio
Test:        pnpm test                 → Vitest unit + property
E2E:         pnpm test:e2e             → Playwright
Visual:      pnpm test:visual          → rail/badge baselines
A11y:        pnpm test:a11y
Size:        pnpm size                 → size-limit budgets (§17)
Lighthouse:  pnpm lighthouse
Lint:        pnpm lint --fix
Typecheck:   pnpm typecheck
Workbench:   /dev/composants           → every component, every state; noindex, out of sitemap
```

**No Storybook.** The `/dev/composants` route does the same work at a fraction of the cost for a solo developer. Revisit past twenty components.

---

## 5. Repository structure

```
frontalier/
  web/                                          → Next.js 15. Public only. No auth UI.
    app/
      (public)/
        layout.tsx                              → PublicShell: header + footer
        page.tsx                                → /
        calculateur-teletravail-frontalier/
          page.tsx
          opengraph-image.tsx                   → generic OG card (never per-result)
        calculateur-lamal-cmu/page.tsx
        guides/{page.tsx, [slug]/page.tsx}      → hub + MDX articles
        application/page.tsx                    → the app's landing page: what it does, Play link
        releve-annuel/page.tsx                  → what the dossier is
        tarifs/  sources/  a-propos/  alertes/
        mentions-legales/  confidentialite/  cgu/
      api/
        alertes/route.ts                        → POST subscribe
        alertes/confirm/route.ts                → GET double-opt-in
        auth/[...nextauth]/route.ts             → magic link; App Link callback for Android
        v1/entries/route.ts                     → GET by year, POST batch (device sync)
        v1/dossier/route.ts                     → GET computed dossier for a year
        v1/export/{pdf,csv}/route.ts
        v1/devices/route.ts                     → FCM token registration
        v1/account/{export,delete}/route.ts
        v1/me/route.ts                          → settings incl. loggingMode
      releve/print/page.tsx                     → PDF source, token-gated, noindex
      sitemap.ts  robots.ts  dev/composants/page.tsx
    lib/
      calc-engine/          → §7. Pure TS. Zero runtime deps. No I/O, no clock, no React.
      ui/core/              → pure TS + SCSS, no React (ESLint-fenced)
      ui/react/             → ThresholdRail, ZoneBadge, RateDisplay, MetricTile, ...
      fr/                   → ALL user-facing web strings
      content/  db/  auth/  push/  pdf/  analytics/  params/  dossier/
    content/guides/*.mdx
    prisma/schema.prisma

  android/                                      → Kotlin, Compose, single activity
    app/src/main/kotlin/.../
      calc/                 → the Kotlin port of the engine. Pure. No Android imports.
      design/               → FrontierTheme: tokens, type, radius set, colour set (light + dark)
      ui/components/        → ThresholdRail, ZoneBadge, RateDisplay, MetricTile, DayCell
      ui/screens/           → aujourdhui/ calendrier/ releve/ parametres/ onboarding/
      data/local/           → Room: entries, pending mutations, detection tallies
      data/remote/          → Retrofit API client, DTOs
      data/repo/            → EntryRepository — the only writer of entries
      detection/            → sampling, border polygon, day classification (§13)
      sync/                 → WorkManager workers
      fr/                   → ALL user-facing Android strings (strings.xml + typed accessors)
    app/src/main/assets/ch-border.geojson        → bundled polygon, versioned and dated

  fixtures/geneva-cases.json                     → shared conformance suite (D20)
  docs/regulatory-sources.md  docs/detection-model.md  docs/deploy.md
```

**Import boundaries, enforced by ESLint, each a review rejection when violated:**

**Web (ESLint), each a review rejection when violated:**

- `lib/calc-engine` imports nothing from `app/`, `lib/ui`, `lib/db` — nothing at all beyond its own files.
- `lib/ui/core` may not import `react` or any component library.
- `lib/ui` imports *types* from `calc-engine`, never logic; it computes nothing.
- User-facing strings come from `lib/fr` only.
- `_zones.scss` is generated from `zones.ts` by a build step — never hand-copied.

**Android (detekt/lint rules, same standing):**

- `calc/` imports nothing from `android.*`, `androidx.*`, or any project package. Pure Kotlin, no clock, no I/O — the same contract as the TS engine.
- `detection/` may not import `data/remote` and may not reference Retrofit. Detection never talks to a network.
- **Coordinates may not cross the boundary of `detection/`.** A `Location` or a lat/lng type appearing in `data/`, `ui/`, or any DTO is a review rejection (D18).
- `ui/` writes entries only through `EntryRepository`; no screen calls the API or the DAO directly.
- User-facing strings come from `fr/` only; no string literal in a composable.
- `design/` owns every token; a `.dp` radius outside {4, 8, 12, 14, 16, 20, 24, 999}, a raw colour literal, or a spacing value off the 4 px scale anywhere in `ui/` is a review rejection (D37).

---

## 6. Foundations — design system

**`DESIGN-SYSTEM.md` is normative** (D35). It adopts Frontier Work v1.0 in full and lists, in its §2, the handful of product overrides that constrain how components are instantiated. This section keeps only what the rest of the spec depends on.

### 6.1 Tokens in one paragraph

Inter everywhere, with **tabular numerals for every figure, date and timestamp** (the former Plex Mono role). Canvas `#F7F8FA`, cards `#FFFFFF` with a 1 px `#E4E7EC` border and no shadow. Text `#111827` / `#667085` / `#98A2B3`. Brand `#173B63` for the single primary action per screen, links, active navigation and selection. Status: success `#15803D`, warning `#B7791F`, error `#C53030`, info `#2563EB`, each with its soft background. Country accents: France `#315FA8`, Switzerland `#D84B4B` — dots and chips only, never flags. Radius from the token set only (buttons and inputs 12, cards 16, status card 20, sheets 24, chips/progress pill). Lucide icons, 1.75 stroke, 20 px. 4 px spacing base, 20 px mobile gutters. **Reference tokens, never raw values** — enforced by stylelint on the web and a radius/colour lint on Android.

Warning colour as text: `#B7791F` on white is borderline at small sizes. Warning **text** is `#111827` on the warning soft background `#FFF7E6` with a 4 px `#B7791F` accent; the warning colour itself is used for accents, icons, and the rail band.

### 6.2 Zones and statuses are different things

Unchanged from v1 and independent of the design system. The **rail shows position** — three regulatory bands, 0–40 / 40–49.9 / ≥ 49.9, coloured success / warning / error. The **badge shows status** — four states, one of which (`mission-exposure`) sits on the green band with a warning badge.

```ts
export type Zone   = 'compliant' | 'fiscal-exposure' | 'social-switch';
export type Status = 'compliant' | 'mission-exposure' | 'regime-lost' | 'social-switch';
```

The rail is coloured by `Zone` and positioned by `declarableRate`; the badge is driven by `Status`. Colouring the rail by status is a review rejection. Every status carries icon + label + one-line explanation, identical on web, Android, and PDF. Frontier's early-warning steps become **in-band alerts** at 30 % and 38 % (warning colour, banner), not new statuses — and Frontier's threshold table, which stops at 40 %, does **not** replace the 49.9 % social band (see `DESIGN-SYSTEM.md` §2).

### 6.3 The rail is a string generator

`renderRailSvg` is now the Frontier progress primitive: an 8 px pill track, filled from 0 to the declarable rate in the band colour, with **two tick markers at 40 and 49.9** protruding 4 px above and below the bar, labelled in tabular figures. Same contract as before:

```ts
export interface RailData {
  readonly percentage: number;   // declarableRate
  readonly zone: Zone;
  readonly width: number;
  readonly height: number;       // track height 8; total including ticks 16
  readonly variant: 'inline' | 'compact' | 'social';
}
export function renderRailSvg(data: RailData): string;
```

Pure function, one implementation, rendered in the browser, the PDF, the OG image, and ported to Compose with a screenshot test asserting parity. The `social` variant is 1200 × 630 and carries the product name. The OG card is generic, never per-result.

### 6.4 French formatting

Unchanged: `formatPercent(34.6)` → `"34,6 %"` (U+00A0), `formatDays(1234.5)` → `"1 234,5"` (U+202F), `formatDate` → Swiss dots. `Intl` output normalised, codepoints asserted, every number through `format/`. The typographic carrier changes from Plex Mono to **Inter with `font-feature-settings: "tnum"`** (web) / `FontFeature.tabularNum()` (Compose).

### 6.5 Register

Frontier's own rule of thumb governs: simpler → simplify; a card without actionable information → remove; colour carrying meaning → add text/icon; looks like a GPS tracker → reduce location visualisation. Warmth now comes from both the copy **and** the chrome; the copy still does the heavier lifting, and every string still lives in `lib/fr` / `fr/`.

---

## 7. The calculation engine — `lib/calc-engine`

Pure TypeScript, zero runtime dependencies, no I/O, no clock access, no React. Invalid input is the expected output of a form, so the API returns `Result`, never throws. Consumers: the calculator page, the tracker's running percentage, the dossier.

**Success looks like:** the engine reproduces all five worked examples published by the Geneva tax administration, exactly, including their rounding.

### 7.1 Regulatory basis

| Rule | Value | Source |
|---|---|---|
| Fiscal ceiling | 40% of annual working time (art. 10) | Avenant of 27 June 2023, in force 1 Jan 2026 |
| Mission sub-cap | 10 days/year, **inside** the 40% | Same avenant; interpretative agreement 29 April 2026 |
| Mission cap proration | Proportional for part-time and partial years, **rounded up** | Amicable agreement 30 June 2023 |
| Social ceiling | 49.9%, conditional on a valid A1 | EU framework agreement, art. 16 reg. 883/2004 |
| Simplified denominator | 240 days/year full-time | Circular no. 45 of 12 June 2019, pt 7.5.1 |
| Day classification | >4h = 1 day; 2–4h = ½ day | Circular no. 45, pt 7.5.1 |
| Same 40% ceiling in 1983-accord cantons | Yes — frontalier status preserved | Amicable agreement on the 11 April 1983 accord |

Primary sources with fetch dates live in `docs/regulatory-sources.md`. Every constant carries a source comment. **A magic `0.4` or `240` anywhere in the code is a review rejection.** All figures must be verified against admin.ch, the AFC, and impots.gouv.fr before the fixtures are frozen — advisory sources are how this spec was drafted, not how the engine ships.

### 7.2 The calculation

**Step 1 — Regime.** Derived from canton, never asked.

```
regime = canton ∈ {BE, SO, BS, BL, VD, VS, NE, JU} → 'residence-1983'
                                              else → 'source'
```

Same 40% ceiling either way; different consequence on breach. Under `'source'`: French tax on the excess days. Under `'residence-1983'`: the frontalier status itself is at risk. The engine reports which; the wording lives in the UI layer.

**Step 2 — Denominator.** The employer chooses the method and must apply it uniformly; the engine mirrors, never invents.

```
'simplified240': totalWorkDays = ceil(240 × employmentRate/100 × periodFraction)
'exact':         totalWorkDays = suppliedByUser   // validated, not derived
```

Under `simplified240` there is no calendar arithmetic and no holiday table — leave, holidays, and sickness are absorbed into the 240. `periodFraction` covers mid-year starts as a fraction of the calendar year.

**Step 3 — Granularity.** Converting hours into countable days; the rule lives here so it exists once.

| Method | Rule |
|---|---|
| `day` | 1 day if >4h, else 0 |
| `halfDay` | 1 if >4h; ½ if 2–4h; 0 if <2h |
| `hours` | Every hour counted |

Mission travel days: no work performed → not counted; work mostly in Switzerland → not counted; work mostly abroad → counted. On-call without intervention → not counted; with intervention in France → counted by duration.

**Step 4 — Mission cap.** `missionCap = ceil(10 × employmentRate/100 × periodFraction)` — rounded **up**, the one rule that favours the user (30 June 2023 agreement).

**Step 5 — The waterfall.** The core; not a threshold test.

```
fiscalCeiling = totalWorkDays × 0.40

if teleworkDays > fiscalCeiling:
    ── regime does not apply ──
    declarableRate  = teleworkDays / totalWorkDays
    swissTaxedDays  = totalWorkDays − teleworkDays − missionDaysTotal
    frenchTaxedDays = teleworkDays + missionDaysTotal
    regimeApplies   = false
else:
    headroom = fiscalCeiling − teleworkDays
    budget   = min(missionCap, headroom)

    # France missions are imputed before third-state missions
    creditedFrance     = min(missionDaysFrance, budget)
    creditedThirdState = min(missionDaysThirdState, budget − creditedFrance)
    creditedMissions   = creditedFrance + creditedThirdState

    declarableRate  = (teleworkDays + creditedMissions) / totalWorkDays
    swissTaxedDays  = totalWorkDays − missionDaysTotal + creditedMissions
    frenchTaxedDays = missionDaysTotal − creditedMissions
    regimeApplies   = true
```

Two details that are easy to get wrong and both matter. **When telework alone exceeds 40%, mission days are excluded from the declared rate** — Geneva is explicit: the regime does not apply, so missions must not be folded into the rate filed with the AFC, even though they are taxed in France. **France missions are imputed before third-state missions** — the order changes who pays how: excess France missions are collected by French withholding via the Swiss employer; excess third-state missions are declared and paid by the employee directly. So mission days are two fields, never one.

**Step 6 — Headroom.**

```
remainingToFiscal = floor((totalWorkDays × 0.40  − daysCountedAgainstCeiling) × 2) / 2
remainingToSocial = floor((totalWorkDays × 0.499 − daysCountedAgainstCeiling) × 2) / 2
```

Negative values are reported, never clamped. "Vous êtes 6 jours au-dessus" beats "0 jours restants".

### 7.3 Rounding — two different rules, on purpose

**The declarable rate truncates to 2 decimals.** Geneva publishes 39.16% for 94/240 (39.1666…) and 4.16% for 10/240; rounding would give 39.17% and 4.17%. The engine reproduces truncation because this number must match the employer's filing — matching the authority beats being conservative. **Advisory headroom rounds down** (floor to the half-day): a user must never be told they have more room than they do. The two rules conflict by design and live in separate files so they cannot be accidentally unified. Every rounding site carries a comment naming its rule: `// truncate — must match AFC filing`, `// floor — never overstate headroom`.

### 7.4 API

```ts
export type Canton =
  | 'AG' | 'AI' | 'AR' | 'BE' | 'BL' | 'BS' | 'FR' | 'GE' | 'GL' | 'GR'
  | 'JU' | 'LU' | 'NE' | 'NW' | 'OW' | 'SG' | 'SH' | 'SO' | 'SZ' | 'TG'
  | 'TI' | 'UR' | 'VD' | 'VS' | 'ZG' | 'ZH';

export type Regime = 'source' | 'residence-1983';
export type Granularity = 'day' | 'halfDay' | 'hours';

export type DenominatorMethod =
  | { readonly kind: 'simplified240' }
  | { readonly kind: 'exact'; readonly totalWorkDays: number };

export interface TeleworkInput {
  readonly canton: Canton;
  readonly employmentRate: number;           // 1–100
  readonly periodFraction: number;           // 0 < f ≤ 1
  readonly denominator: DenominatorMethod;
  readonly granularity: Granularity;
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
}

export interface TeleworkResult {
  readonly regime: Regime;
  readonly regimeApplies: boolean;
  readonly totalWorkDays: number;
  readonly missionCap: number;
  readonly fiscalCeilingDays: number;
  readonly declarableRate: number;           // truncated, 2 dp — for the AFC
  readonly rawRate: number;                  // rounded up, 1 dp — for display
  readonly swissTaxedDays: number;
  readonly frenchTaxedDays: number;
  readonly creditedMissionDays: number;
  readonly remainingToFiscal: number;        // may be negative
  readonly remainingToSocial: number;        // may be negative
  readonly warnings: readonly Warning[];
}

export type Warning =
  | { readonly code: 'FISCAL_CEILING_EXCEEDED'; readonly regime: Regime }
  | { readonly code: 'MISSION_CAP_EXCEEDED'; readonly cap: number; readonly excess: number }
  | { readonly code: 'MISSIONS_EXCEED_HEADROOM'; readonly excess: number }
  | { readonly code: 'SOCIAL_CEILING_EXCEEDED' }
  | { readonly code: 'A1_REQUIRED' }
  | { readonly code: 'FRONTALIER_STATUS_AT_RISK' }        // residence-1983 only
  | { readonly code: 'EXACT_METHOD_UNVERIFIED' };         // user-supplied denominator

export type ValidationError =
  | { readonly code: 'RATE_OUT_OF_RANGE' }
  | { readonly code: 'PERIOD_OUT_OF_RANGE' }
  | { readonly code: 'NEGATIVE_DAYS'; readonly field: keyof TeleworkInput }
  | { readonly code: 'GRANULARITY_MISMATCH'; readonly field: keyof TeleworkInput }
  | { readonly code: 'DAYS_EXCEED_TOTAL' }
  | { readonly code: 'TOTAL_WORK_DAYS_NOT_POSITIVE' };

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function calculateTelework(input: TeleworkInput): Result<TeleworkResult, readonly ValidationError[]>;
export function allowedTeleworkDays(
  input: Omit<TeleworkInput, 'teleworkDays' | 'missionDaysFrance' | 'missionDaysThirdState'>
): Result<{ readonly atFiscal: number; readonly atSocial: number; readonly missionCap: number }, readonly ValidationError[]>;
export function classifyTeleworkHours(hours: number, granularity: Granularity): number;
export function regimeFor(canton: Canton): Regime;
```

`rawRate` and `declarableRate` are both returned because they legitimately differ — Geneva case (c): 45.0% of days outside Switzerland, 39.16% declarable. Showing only one would mislead. `ValidationError` codes map one-to-one onto input error messages in `lib/fr` — a test enumerates the union and fails on any gap.

### 7.5 Fixtures — the Geneva cases

`tests/fixtures/geneva-cases.ts` encodes the official worked examples verbatim, all on `totalWorkDays = 240`. **If any fails, nothing ships.** These are the single most valuable file in the repository.

| Case | TT | MT | Expected Swiss | Expected France | Expected rate |
|---|---|---|---|---|---|
| a | 72 | 0 | 240 | 0 | 30.00% |
| b | 91 | 8 | 237 | 3 | 40.00% |
| c | 84 | 24 | 226 | 14 | 39.16% |
| d | 94 | 12 | 230 | 10 | 40.00% |
| e | 144 | 5 | 91 | 149 | 60.00% |
| special | 0 | 30 | 220 | 20 | 4.16% |

`reviewer-cases.ts` holds cases signed off by the expert reviewer, including at least one `residence-1983` canton and one part-time mid-year start.

### 7.6 Engine testing

100% statement and branch coverage — not an aspiration. Unit tests isolate every function, with attention to: employment rate at 1/50/80/100 and mission-cap round-up at each; `periodFraction` for mid-year starts; boundaries at exactly 40.0% and 49.9%; `totalWorkDays = 0` → validation error, never a division; all three granularities at 1.9h, 2h, 4h, 4.1h.

Property tests (`fast-check`, 10,000 cases each) assert invariants over all valid inputs:

1. `swissTaxedDays + frenchTaxedDays === totalWorkDays`
2. `declarableRate ≤ 40` whenever `regimeApplies === true`
3. `creditedMissionDays ≤ missionCap` and `≤ fiscalCeilingDays − teleworkDays`
4. `remainingToSocial ≥ remainingToFiscal` — always
5. Increasing `teleworkDays` never decreases `rawRate` (monotonic)
6. `declarableRate ≤ rawRate`
7. `declarableRate` is never above the exact unrounded value (truncation holds)
8. Swapping France and third-state mission days never increases `creditedMissionDays`

**No snapshot tests in this module** — a snapshot records what the code did, not what the rule requires; it would bless a wrong interpretation of the 40% rule and then defend it against correction. (Snapshots are fine in `lib/ui`, where they lock intended appearance.)

### 7.7 Rule versioning (D29)

The constants in `constants.ts` become a `RuleSet`:

```ts
export interface RuleSet {
  readonly taxYear: number;              // 2026
  readonly fiscalCeiling: number;        // 0.40
  readonly socialCeiling: number;        // 0.499
  readonly missionCapDays: number;       // 10
  readonly simplifiedBasisDays: number;  // 240
  readonly residence1983Cantons: readonly Canton[];
  readonly sources: readonly string[];   // citations, one per constant
}
export function ruleSetFor(taxYear: number): RuleSet;   // falls back to the latest known set with a warning
```

`TeleworkInput` gains `readonly taxYear: number`. `calculateTelework` resolves the rule set from it; nothing else in the engine reads a bare constant. A dossier for year *Y* is always computed under `ruleSetFor(Y)`, so a 2027 document remains reproducible after the 2028 rules ship.

Two guards: **the Geneva fixtures are pinned to `taxYear: 2026` and are unchanged** by this refactor — if any fixture moves, the refactor is wrong; and adding a rule set for a new year requires a new fixture file for that year, sourced and reviewed, before it can be the default. `RuleSet` is the only place a threshold may appear; a bare `0.4` anywhere else is still a review rejection.

---

## 8. Data model

Prisma, PostgreSQL. Auth.js standard tables (`Account`, `Session`, `VerificationToken`) omitted for brevity.

```prisma
model User {
  id                 String    @id @default(cuid())
  organizationId     String?                       // D33 — reserved, no features built
  email              String    @unique
  emailVerified      DateTime?
  name               String?
  canton             String?                       // Canton code; null until onboarding
  employmentRate     Int       @default(100)       // 1–100
  denominatorKind    DenominatorKind @default(SIMPLIFIED240)
  exactTotalWorkDays Int?                          // required iff EXACT
  granularity        LogGranularity @default(DAY)  // DAY | HALF_DAY (tracker; D9)
  loggingMode        LoggingMode @default(MANUAL)   // MANUAL | AUTO_DETECT (D15/D19)
  detectionConsentAt DateTime?                      // when background-location consent was given
  activityStartDate  DateTime?                     // sets periodFraction for the year
  reminderTime       String    @default("17:30")   // HH:mm, Europe/Paris
  reminderEnabled    Boolean   @default(false)     // true only after push permission granted
  createdAt          DateTime  @default(now())
  entries            Entry[]
  entryEvents        EntryEvent[]
  devices            Device[]
}

model Entry {
  id               String     @id @default(cuid())
  userId           String
  dayDate          DateTime   @db.Date             // interpreted in Europe/Paris
  portion          EntryPortion @default(FULL)     // FULL | AM | PM (AM/PM only when granularity = HALF_DAY)
  kind             EntryKind                       // CH | HOME | MISSION_FR | MISSION_THIRD | ABSENT (D28)
  absenceReason    AbsenceReason?                  // CONGE | MALADIE | FERIE | AUTRE — required iff kind = ABSENT
  clientMutationId String    @unique               // client-generated UUID (D30)
  note             String?
  provenance       Provenance @default(MANUAL)     // MANUAL | DETECTED_CONFIRMED | DETECTED_CORRECTED (D17)
  detectedKind     EntryKind?                      // what detection proposed; set whenever a proposal existed
  detectedAt       DateTime?                       // when the proposal was produced on-device
  clientClaimedAt  DateTime?                       // what the offline client asserted
  firstRecordedAt  DateTime   @default(now())      // server clock at first receipt — IMMUTABLE
  updatedAt        DateTime   @updatedAt
  user             User       @relation(...)
  @@unique([userId, dayDate, portion])
  @@index([userId, dayDate])
}

model EntryEvent {                                  // append-only audit trail — never updated, never deleted
  id           String    @id @default(cuid())
  userId       String
  entryId      String
  action       EntryAction                          // CREATED | MODIFIED
  kind         EntryKind
  provenance   Provenance
  detectedKind EntryKind?
  dayDate      DateTime  @db.Date
  portion      EntryPortion
  recordedAt   DateTime  @default(now())            // server clock
  clientClaimedAt DateTime?
}

model AlertSubscriber {
  id             String    @id @default(cuid())
  email          String    @unique
  source         String                             // 'calculateur' | 'comparateur' | 'alertes' | 'guide'
  confirmedAt    DateTime?                          // double opt-in; unconfirmed rows purged after 30 days
  unsubscribedAt DateTime?
  createdAt      DateTime  @default(now())
}

model Device {                                     // replaces PushSubscription (D21)
  id         String   @id @default(cuid())
  userId     String
  fcmToken   String   @unique
  platform   String   @default("android")
  appVersion String?
  lastSeenAt DateTime @default(now())
  createdAt  DateTime @default(now())
}
```

**Timestamp rules — the evidence model, non-negotiable:**

- `firstRecordedAt` and every `EntryEvent.recordedAt` are **server-assigned**. A client clock is trivially changed, which would make the entire evidence claim hollow. No API path accepts a client-supplied value for these fields.
- When an offline entry syncs late, the server stores **both** the client-claimed date/time and the server receipt time, and the dossier shows both.
- Edits update `Entry.kind` (latest wins for calculation) but append an `EntryEvent` — the audit trail is append-only. `firstRecordedAt` never changes.
- **Late flag** (`saisie tardive`): derived, `firstRecordedAt − dayDate > 7 days`. Rendered as a gray `Tag` in the calendar and carried into the dossier. Uncomfortable by design: honesty about record quality is the product's whole value; hiding it would make the document worthless in exactly the situation it exists for.
- Day boundaries and reminder times are computed in **Europe/Paris** — the frontalier lives in France. A UTC day-boundary bug here is a wrong record.

**Provenance rules (D17), equally non-negotiable:**

- Every entry carries a `provenance`. `MANUAL` when the user chose it outright; `DETECTED_CONFIRMED` when they accepted the proposal unchanged; `DETECTED_CORRECTED` when they overrode it.
- Whenever a proposal existed, `detectedKind` is stored **even when the user overrode it**. Deleting the overridden detection to make the record look tidier is a review rejection: an audit that discovers the app had a contradicting signal is worse than a document that discloses it.
- **No entry may be created with a provenance of detection alone.** There is no code path that writes an `Entry` without a user action (D16). A proposal that is never confirmed produces no row — the day stays *non renseigné*.
- Provenance is rendered wherever an entry is shown: the calendar cell, the edit sheet, the annex, the CSV, and the PDF. Never as an icon alone.
- **The API rejects any payload containing latitude, longitude, accuracy, altitude, speed, or a location provider name** (D18). This is enforced by schema validation and covered by a test that posts such a payload and expects a 400.
- **`ABSENT` never reaches the engine.** The aggregation that builds `TeleworkInput` filters absences out before counting; a test asserts that a year with and without absence rows yields identical engine output. Absences exist for the record — calendar, annex, CSV, PDF — not for the calculation.
- **`clientMutationId` is the deduplication key for retries** (D30): a replayed batch containing an already-seen id is acknowledged and ignored, and no second `EntryEvent` is written for it.

---

## 9. Public site

### 9.1 Zones and route map

| Zone | Prefix | Auth | Indexed |
|---|---|---|---|
| Public | `/` | No | Yes |
| API | `/api/v1/*` | Bearer token | No |
| PDF source | `/releve/print` | Signed token | No (`noindex`) |

**There is no signed-in web area** (D14). The whole web surface is public and anonymous.

**Same domain, no subdomain** — every public page accumulates domain authority the product will spend for years; `app.` would split it. French URLs throughout; the keywords in the slug are part of the SEO strategy. **Guide slugs and URL params are permanent once published**; renaming requires a 301 forever.

Public routes at launch: `/`, `/calculateur-teletravail-frontalier`, `/calculateur-lamal-cmu`, `/guides` + articles (§9.5), `/application`, `/releve-annuel`, `/tarifs`, `/sources`, `/a-propos`, `/alertes`, `/mentions-legales`, `/confidentialite`, `/cgu`.

`/application` is new in v2: what the Android app does, both logging modes explained plainly, the privacy position stated up front (no coordinates stored, no map, nothing shared with the employer), and the Play Store link. Before the app is live it carries the waiting-list form instead. **The web CTA `Suivre mes jours` points here**, not to a signup.

`/sources` and `/a-propos` are not filler. For a product whose entire value is credibility, a dated source list and a named expert reviewer are competitive advantages most competitors lack. The footer carries the standing disclaimer in `$legal-01` and a visible "vérifié le DD.MM.YYYY" date of last regulatory review.

### 9.2 Header and footer

Header (white, 1 px bottom border), four items maximum:

```
[Logo]  Calculateurs ▾   Guides   Le relevé   Tarifs        Connexion  [Suivre mes jours]
```

`Calculateurs ▾` is a menu with two children. `Suivre mes jours` is the single primary CTA → `/application`. On mobile, collapse into a hamburger; the CTA stays visible outside it.

Footer: full sitemap in four columns (Outils / Guides / Le produit / Légal) — the crawler-facing link density lives here — plus disclaimer and review date.

### 9.3 The calculator — `/calculateur-teletravail-frontalier`

One free page answering: **combien de jours de télétravail me reste-t-il avant les 40 % ?** No account, no paywall, no cookie. The result is always free and always immediate. Success looks like: a frontalier pastes the link in a Facebook group, five people adjust the numbers in place, two join the alert list.

**The form.** The engine needs seven inputs; asking a stranger seven questions is how a calculator gets abandoned. Resolution: three visible fields, everything else disclosed progressively with sane defaults. Single form inside a white card (radius 16), 8 columns centered on the grey canvas.

Visible:

| Field | Pattern | Default | Why visible |
|---|---|---|---|
| Canton de travail | select | — | Determines the regime; changes the explanation |
| Taux d'activité (%) | number input, step 5 | 100 | Scales ceiling and mission cap |
| Jours de télétravail déjà pris | number input, step 0.5 | — | The number they came to enter |

Under the simplified 240-day basis, **paid leave and sick days are not asked at all** — the 240 already absorbs them. That is a real UX win the regulation hands us and why three fields suffice.

Progressive disclosure — an accordion, collapsed:

| Field | Default | Notes |
|---|---|---|
| Jours de mission en France | 0 | Imputed before third-state |
| Jours de mission dans un pays tiers | 0 | Different collection mechanism if in excess |
| Méthode de calcul | `simplified240` | Alternative: exact, user supplies the total |
| Décompte | `day` | Alternatives: half-day, hours |
| Début d'activité en cours d'année | — | Sets `periodFraction`, prorates the mission cap |

**One exception to burying things.** Mission days materially change the result, and a user with missions who never opens the accordion gets a silently wrong answer. A single always-visible line sits above the accordion: *« Avez-vous effectué des missions hors de Suisse cette année ? »* — a visible question, not a hidden field. "Non" costs one line of reading; "Oui" steers to the fields that matter.

Method helper text (verbatim, it is also advice nobody else gives): *« Par défaut, nous utilisons la base simplifiée de 240 jours par an (circulaire n° 45). Votre employeur peut utiliser un décompte exact — demandez-lui laquelle s'applique, la méthode doit être la même pour tout le personnel. »*

Recalculate on every `input` event, no debounce — the engine runs in under 0.1 ms, so debouncing only adds perceived lag. Static HTML renders the full explanatory content server-side: the *calculation* needs JavaScript; the *page* must be meaningful without it.

**The result panel.** Below the form, never replacing it — users iterate. Order is decision-relevance:

1. `ZoneBadge` — status, icon + label + one-line explanation
2. `RateDisplay` — the declarable rate, Display 48/56 tabular, zone-coloured
3. `ThresholdRail` — position on 0–100
4. `MetricTile` ×4 — jours restants avant 40 %, avant 49,9 %, jours imposés en Suisse, en France
5. Warnings — one banner per engine `Warning`
6. `LegalNote` — the standing disclaimer, `$legal-01`
7. Contextual link — exactly one, chosen by status
8. Email capture — one input + secondary button; offer: change-alert, not a newsletter; **never gates the result**
9. Share — copy-URL, plus native Share API where available

**The two-rate problem.** In Geneva case (c) the rates differ sharply: 39,16 % declarable against 45,0 % of days actually outside Switzerland. Showing only the declarable rate hides real exposure; showing only the raw rate contradicts the payslip. Both appear: primary, large — `declarableRate`, labelled *Taux à déclarer à l'AFC*; secondary, smaller — `rawRate`, labelled *Part de jours hors de Suisse*; when they differ, an explanatory line states that mission days above the 10-day cap fall outside the telework regime and are taxed in France. The rail is positioned by `declarableRate`.

**Contextual links** — one per status; turns one tool into four entry points at the moment the question becomes personal:

| Status | Destination |
|---|---|
| `compliant` | `/releve-annuel` — « gardez une trace datée » |
| `mission-exposure` | `/guides/jours-de-mission-hors-suisse` |
| `regime-lost` | `/guides/teletravail-frontalier-40-pourcent` |
| `social-switch` | `/guides/seuil-social-49-9-pourcent` |

**E2E gate:** reproduce Geneva case (c) through the UI and assert the displayed strings read `39,16 %` and `45,0 %`. This one test proves the whole chain — engine, formatter, DOM — agrees with the tax administration.

### 9.4 URL parameters — a public contract

The growth mechanic: someone pastes their scenario into a group; others adjust it in place.

| Param | Type | Default | Maps to |
|---|---|---|---|
| `canton` | 2-letter code | — | `canton` |
| `taux` | 1–100 | 100 | `employmentRate` |
| `tt` | ≥0, step 0.5 | — | `teleworkDays` |
| `mfr` | ≥0, step 0.5 | 0 | `missionDaysFrance` |
| `mtiers` | ≥0, step 0.5 | 0 | `missionDaysThirdState` |
| `methode` | `240` \| `exact` | `240` | `denominator.kind` |
| `total` | >0 | — | `denominator.totalWorkDays`, exact only |
| `decompte` | `j` \| `dj` \| `h` | `j` | `granularity` |
| `debut` | `YYYY-MM-DD` | — | `periodFraction` |

Rules: **names are frozen once published** — links live in Facebook threads for years and a renamed param breaks them silently. **No personal data, ever** — days and rates only, never a name, salary, or employer. Unknown params ignored; invalid values fall back to default and surface a dismissible notice, never a blank page (Facebook mangles URLs; degrading beats 404). Every param-bearing URL carries `noindex` and a canonical to the bare path. `?` present but empty behaves exactly like the bare path. **Round-trip property test:** for any valid `TeleworkInput`, `decode(encode(input)) === input`, 10,000 generated cases — the one test protecting every link ever shared.

### 9.5 Guides

MDX, statically generated, desktop layout: 4-column sticky table of contents left, 8-column prose right, max ~70 characters per line. Components carrying weight: a bordered summary block for rule summaries (reads as reference, not marketing); comparison tables with hairline rules only, no zebra; warning banners for the traps (40 vs 49.9 confusion, the 3-month irrevocable option, missions counting *inside* the ceiling); an accordion for FAQ blocks with FAQ structured data. Every article ends with the same card CTA to the calculator — one CTA, repeated everywhere, no variants. Every guide carries a "dernière vérification" date and links `/sources` in its footer.

Launch content (all written before release — the mesh only works complete):

| Route | Role |
|---|---|
| `/guides/teletravail-frontalier-40-pourcent` | **Pillar** — the definitive page on the 40% rule |
| `/guides/seuil-social-49-9-pourcent` | Cluster — 49.9% and the A1 certificate |
| `/guides/jours-de-mission-hors-suisse` | Cluster — missions inside the 40% |
| `/guides/attestation-employeur-teletravail` | Cluster — what employers must certify, why yours may not suffice |
| `/guides/droit-option-lamal-cmu` | Cluster — the 3-month irrevocable choice |
| `/guides/declaration-impots-frontalier` | Cluster — April declaration season |
| `/guides/geneve` | Canton long-tail — Genève only at launch (D8); thin canton pages are worse than none |

**Linking mesh — this determines whether the SEO strategy works:** pillar ↔ every cluster, bidirectional, non-negotiable. Cluster ↔ cluster only where genuinely related (49.9 ↔ missions: yes; 49.9 ↔ LAMal/CMU: no — forced cross-links dilute the signal). Every guide → a calculator, twice: inline at the moment the reader realises they can't do the math, and the end `Tile`. Every calculator → `/releve-annuel`, after the result, never before.

### 9.6 LAMal/CMU comparator — `/calculateur-lamal-cmu`

Same shell as the calculator. Inputs: revenu fiscal de référence, taille du foyer, canton. Output: two-column table of estimated annual cost either way, a badge on the cheaper option, and a prominent error banner stating the choice is **irrevocable** and the window is **three months**. Single-use by nature: its job is acquisition and email capture at the moment of highest need, not retention — design it as a funnel entrance. Same `LegalNote`, same email capture, no gating.

### 9.7 Offer, tarifs, alertes, legal

- `/releve-annuel` — what the dossier is: a card with a summary list of exactly what the document contains (working days, days in Switzerland, telework, missions, annualised %, per-entry timestamps, late flags). The offer page every calculator links to.
- `/tarifs` — one page, one product, no tier grid: gratuit en 2027, payant dès 2028 (D3).
- `/alertes` — standalone signup landing for Facebook posts. Double opt-in via Resend; consent timestamp stored; one-click unsubscribe in every send; unconfirmed rows purged after 30 days.
- `/cgu` must state explicitly: record-keeping tool, not tax advice. `/confidentialite` covers nLPD + GDPR, names the data (email, canton, rate, day logs, timestamps), the retention, and the export/deletion rights (D11).

---

## 10. Auth

Passwordless throughout (D6, D23). Auth.js v5 with the Resend email provider, `trustHost: true`.

**Android sign-in:** the user enters an email in the app; the magic link opens an **Android App Link** back into the app; the callback issues a short-lived access token and a long-lived refresh token stored in `EncryptedSharedPreferences`. A daily-use tax app must not demand a login every session, so the refresh token is only invalidated by sign-out, account deletion, or a server-side revoke.

**Web never authenticates.** No `/connexion`, no `/inscription`, no session cookie on any public route — the v1 cookie exception (D12) is withdrawn, and the "zero cookies on the public surface" guarantee is total again.

**Carrying calculator state into the app.** The web can no longer pre-fill a signup form, so the equivalent hand-off is: the calculator offers `Continuer dans l'application`, which opens the Play Store listing (or the app, if installed) with the canton, taux, and telework days attached as install-referrer parameters; the app pre-fills onboarding from them on first run. **Never a result gated behind it** — the answer is always shown first.

---

## 11. The Android app

Single activity, Compose Navigation, four destinations in a Frontier bottom navigation (80 dp incl. safe area, 24 dp icons, active = brand colour): **Aujourd'hui, Calendrier, Relevé, Paramètres.** Four screens is the whole app; adding a fifth requires deleting one. `FrontierTheme` throughout (D35/D37) — token radii, no shadows on cards, no FAB. Minimum touch target 48 dp; the primary confirm action is a 56 dp large primary button. Header: greeting (`Bonjour Camille`) + date, no notification bell, no avatar (D36).

**The web site never depends on the app or the API** — public routes are static/ISR, so a backend outage must not take down the SEO surface.

### 11.1 Onboarding — mode and consent

Three linear screens, back arrow only, no bottom bar (design prompt D5):

1. **Choix du mode** — two visually identical cards, *Saisie manuelle* pre-selected as the safe default (D19). Neither carries a "recommandé" tag, a highlight, or a lock icon. Copy states plainly that both modes produce the same annual statement.
2. **Avant l'autorisation** — shown only if auto is chosen, before the system dialog. Three plain statements: what the app does, what it records (*une conclusion par jour ; ni trajet, ni adresse, ni historique*), what it never does (*aucun partage avec votre employeur ni avec une administration*). It warns in advance that Android will ask twice — in-use, then background — because an unexplained second dialog is the main reason background grants get revoked. Actions: `Autoriser la localisation` and, equally weighted, `Rester en saisie manuelle`.
3. **Autorisation refusée** — neutral grey, no warning icon, no error colour. States that manual mode produces exactly the same annual statement, offers one link to Android settings, and **never asks again**. No banner afterwards, no periodic prompt, no red dot.

Consent is recorded as `User.detectionConsentAt` and is revocable at any time from Paramètres; revoking stops sampling immediately and deletes local tallies.

### 11.2 Aujourd'hui (default)

Seen roughly 200 times a year; must answer one question in under a second.

- Hero: annualised `declarableRate` in Display 48/56 tabular, zone-coloured, inside the Frontier status card (radius 20); days remaining below it in plain language, because early in the year the percentage is small and the day count is the useful number.
- The threshold rail, identical to the web calculator's.
- A **mode strip** at the top of the content, always visible: *Mode automatique* or *Saisie manuelle*, with a `Changer` link. The user must always be able to see which mode is recording their days.
- **Manual mode** — three 56 dp large primary/secondary buttons (radius 14/12), full width, each with its country dot (D38): « En Suisse », « Domicile », « Mission ». Mission reveals the required destination choice, « En France » / « Pays tiers », nested inline rather than in a dialog. With `granularity = HALF_DAY` the set renders twice (Matin / Après-midi). Beneath the three buttons, a tertiary text action « Déclarer une absence » opens the reason choice (congé, maladie, jour férié, autre) — visibly secondary, because it changes no figure (D28).
- **Auto mode** — three states: *détection en cours* during the day (a quiet strip, no spinner, no animated pulse, with a `Saisir maintenant` escape hatch); *à confirmer* in the evening, a proposal card showing the detected kind, a one-line reason, the detection window, **the confidence tier in words** (« Détection fiable » / « Détection incertaine — vérifiez »), and the actions `Confirmer` (primary) / `Corriger`, under the line **« Rien n'est enregistré tant que vous n'avez pas confirmé »**. A `LOW`-tier day never produces a card; it is offered for manual entry with a plain explanation (D27); *confirmé*, the same confirmation row as manual plus its provenance line.
- Once logged, a confirmation row shows what was recorded, **the server entry timestamp**, the provenance in words, and a tertiary « Modifier ».
- Unlogged past days: an inline strip — « 3 jours non renseignés » linking to the calendar. **Never a dialog, never blocking.**

### 11.3 Calendrier

Month grid inside a white card (radius 16), cells ≥ 44 dp, date 14/500. **The cell encoding separates what from how well** (design prompt D6), because the threshold palette means proximity to a ceiling and a single day has no zone:

- **A letter plus a 6 dp country dot** carry the kind: `S` Suisse (Switzerland red), `D` Domicile (France blue), `M` Mission (neutral), `A` Absence (tertiary); nothing when unrecorded (D38).
- **A 4dp bottom bar carries the record quality**: green *à temps*, amber *saisie tardive*, grey *non renseigné*, no bar for weekends, holidays, and future days.
- **A small corner triangle** marks a day where the detection was corrected by the user.
- A legend is therefore mandatory, sitting directly under the grid, plus a month summary of the four counts.

Tapping a day opens a Frontier bottom sheet (radius 24 top, drag indicator): the three-way choice (+ destination, + AM/PM when relevant), the absence option with its reason, a note field, and the **provenance block in plain text** — what was detected, what was corrected, when the first entry was recorded. For a detected day the sheet also shows **« Base de la détection »** (D34): the number of fixes, the minutes attributed to Switzerland and elsewhere, the confidence tier, and whether fixes near the frontier were discarded — all read from the device's own tally, never from the server, and never printed in the dossier. Backfilling beyond 7 days is allowed but flagged, and the sheet states out loud that the flag will appear in the annual document.

Cantonal holidays are display-only styling from a bundled dated table (D10) and are never used in calculation.

### 11.4 Relevé

The dossier, computed server-side and rendered natively — see §12. Provisional until the year closes, and it says so in grey.

### 11.5 Paramètres

Mode d'enregistrement (with consent revocation), canton, taux d'activité, méthode (240 / exact + total), décompte, début d'activité, heure de rappel + notification opt-in, adresse e-mail, alert-list opt-in, **export de mes données (JSON + CSV)**, **suppression du compte** (D11 — removes user, entries, events, devices, and all local Room data; the confirmation names what is destroyed and that the dossier cannot be regenerated).

---

## 12. The dossier — Relevé annuel de télétravail

The artifact the whole product exists to produce. The Android *Relevé* screen and the PDF are the same document at two widths — the app renders natively from a server-computed payload, and the PDF is produced server-side, so the two cannot disagree.

Structure, top to bottom:

1. Header: name, canton, taux d'activité, méthode de calcul, période couverte, date de génération.
2. Four `MetricTile`s: jours ouvrés, jours en Suisse, télétravail, missions.
3. Zone panel: annualised percentage, large, with the explicit sentence naming **both** thresholds; badge with icon + label; the rail.
4. `DataTable`: monthly breakdown — Suisse / Domicile / Mission FR / Mission tiers / cumul % déclarable. Sortable **off** — chronological is the only order that makes sense.
5. **Evidence annex** (collapsed on screen, always fully expanded in the PDF): every entry with its date, portion, kind, note, **first recording timestamp**, last-modified timestamp when different, client-claimed time when it was synced offline, the « saisie tardive » flag, and **its provenance in words** — *Saisie manuelle*, *Détection confirmée*, or *Détection corrigée* (D17). Days with no entry are printed as *Non renseigné* rather than skipped: a document that silently omits dates invites the question of what else it omits. Absences are printed as *Absence — congé* (or maladie, jour férié, autre) with their timestamp and provenance like any other row, and counted once in the identification block as *Absences déclarées*; they appear in no other figure (D28). This is the layer that makes the document evidence rather than assertion; it must be inspectable.
6. Footer, `$legal-01`: each entry carries a server recording timestamp; document established on user declaration for record-keeping purposes; not tax advice.

Export: primary → PDF; secondary → CSV. CSV columns, exact and stable: `dayDate, portion, kind, absenceReason, provenance, detectedKind, note, firstRecordedAt, lastModifiedAt, clientClaimedAt, late`.

**Vocabulary is constrained.** The document never uses *certifié*, *attesté*, *conforme*, *validé*, or *approuvé*. It says *déclaré*, *enregistré*, *horodaté*. Auto-detection makes overclaiming tempting and overclaiming is the fastest way to make the file worthless in front of an administration.

**It must survive a monochrome photocopy.** Every status is carried by a word as well as a colour, and the three status tokens are the only colour in the file.

**PDF generation:** the API handler drives headless Chromium (Playwright, installed in the runtime image) to print `/releve/print?year=` — a signed-token route rendering the document with print CSS (Inter, black rules on white, the three status colours plus the two country colours for dots only; radius does not apply to print), then returns the file to the app, which hands it to the Android share sheet. A4, no logo larger than 24 px. It should look like something a fiduciaire would file. Because the print route renders `renderRailSvg` and the same formatters, the browser, the PDF, and the OG image cannot drift.

---

## 13. Detection, offline, and notifications (Android)

### 13.1 The detection model — on-device, coordinate-free

The single hard rule: **coordinates never leave the sampling function** (D18). There is no movement history in the database, no reverse-geocoding call, no Maps SDK, and nothing to hand over if the app or the user is ever compelled to produce records.

How a day is produced:

1. **Sampling.** During the user's declared working window (default 07:00–19:00 Europe/Paris, editable), WorkManager takes balanced-power location fixes at a low frequency. Geofencing around the border region is used where it reduces the sampling budget.
2. **Classification, in memory.** Each fix is tested against a **bundled, versioned, dated Swiss border polygon** shipped in the APK. The function returns one of three values — inside Switzerland, outside, or **within the 150 m border buffer** (D25) — and the coordinate is discarded immediately. It is never written to Room, never logged, never sent. Buffer fixes contribute to neither tally; they are counted and lower the tier.
3. **Tally, with hysteresis.** Room stores only, per day: minutes attributed to Switzerland, minutes attributed elsewhere, the number of fixes, the number of buffer fixes, and the tier. **Temporal stability** (D26): a change of side is provisional until it has persisted 10 minutes and is only significant after 30; shorter excursions are folded back into the preceding side. No location, no place name, no employer address.
4. **Proposal, with a tier.** At the end of the working window, the tally is classified through the same granularity rules as the engine (>4h = 1 day; 2–4h = ½ day) into *En Suisse* or *Domicile*, and assigned a tier (D27): `HIGH` when fixes are numerous, consistent, and clear of the buffer; `MEDIUM` when the tally is decisive but thin or partly in the buffer; `LOW` otherwise. **`LOW` withholds the proposal.** `HIGH` and `MEDIUM` both require the confirmation tap — no tier writes an entry. **Missions are never auto-detected** — a trip abroad is a business fact, not a geographic one, so mission days are always entered manually. Absences are never detected either.
5. **Confirmation.** The proposal is presented on Aujourd'hui and, if reminders are enabled, in the daily notification. **Nothing is written until the user taps** (D16). An unconfirmed proposal expires; the day remains *non renseigné* and appears in the unlogged-days strip.

**Low confidence is disclosed, not guessed.** If fixes are too few or contradictory — permission revoked mid-day, airplane mode, a phone left at home — the proposal is withheld and the day is presented for manual entry with a plain explanation. The app never fabricates a day from a thin signal.

**Background mechanics are a spike decision, not an assumption.** WorkManager periodic work runs no more often than every 15 minutes and is deferred under Doze; geofence transitions are reliable but bounded to 100 per app and need a location to place them; a foreground service is continuous but shows a persistent notification. AN6 measures which combination meets the accuracy and battery budgets and records the choice — the UX cost of a persistent notification, if it comes to that, is a design question routed back before AN7.

**Contingency (D31).** If polygon-only detection fails the Checkpoint G threshold, the fallback is user-defined *domicile* and *lieu de travail* geofences (radius 150–300 m) **stored in the device's encrypted storage only, never synced, never logged, deleted in one tap and on sign-out or account deletion**. Classification then tests each fix against the two circles before the polygon. Nothing about D18 changes: the server still never sees a coordinate, and the API rejection test stays. This path is built only if the gate triggers it.

`docs/detection-model.md` records the polygon source and date, the buffer distance, the hysteresis constants, the tier thresholds, the sampling and background mechanics chosen, the battery measurements, and — if activated — the geofence contingency parameters.

### 13.2 Offline (D22)

- **Offline-first for logging** — border-crossers lose signal in tunnels, and a failed log is a lost record. Entries are written to Room first and enqueued as pending mutations; WorkManager replays them on connectivity. The queue survives process death and reboot.
- `POST /api/v1/entries` accepts a batch; the **server assigns `recordedAt` on receipt** and stores `clientClaimedAt` alongside (§8). The device's clock is never trusted for the evidence timestamp, and the app displays a pending state until the server value comes back.
- Conflict rule: latest server receipt wins for `Entry.kind`; every attempt lands in `EntryEvent` regardless.
- The dossier is server-computed; the app caches the last payload for offline viewing and marks it with its computation date. **PDF export requires connectivity** and says so plainly.

### 13.3 Notifications (D21)

One daily reminder, exactly one: FCM, scheduled by pg-boss at the user's chosen time, default 17:30 Europe/Paris, sent only if today is unconfirmed. In auto mode it carries the proposal — *« Journée détectée : Domicile. Confirmer ? »* — with confirm and correct actions. Opt-in; expired tokens are pruned on 404/410. **A compliance tool that nags gets uninstalled**, so there is no second reminder, no weekly digest, and no streak.

---

## 14. SEO and technical routing

- Target query for the calculator: *calcul télétravail frontalier 40%* and near variants. **Confirm keyword difficulty before freezing slugs — slugs are permanent.** Same check for the pillar ("télétravail frontalier 40%" vs the broader "frontalier télétravail").
- `<title>`/description name the 40% threshold and the year. JSON-LD: `WebApplication` on both tools, `FAQPage` on the calculator's inline FAQ (the 40 vs 49.9 confusion; do missions count; do sick days count).
- `hreflang="fr-FR"`, self-referencing canonicals. Do not add `fr-CH` without genuinely different Swiss-resident content.
- `sitemap.xml`: public routes only. `robots.txt`: disallow `/app/`, `/connexion`, `/inscription`, `/dev/`.
- Trailing slashes: pick one, enforce with 301 — inconsistency splits link equity.
- Generic OG card via `opengraph-image.tsx`; per-result cards rejected (§6.6).

---

## 15. Analytics

Umami, self-hosted, cookieless, same-origin script. Events:

| Event | Why |
|---|---|
| `page_view` | Baseline |
| `calculated` | Real usage, not bounces |
| `result_status` (compliant / mission-exposure / regime-lost / social-switch) | **Whether the pain is real** — if nobody lands outside `compliant`, the premise is weak |
| `accordion_opened` | Whether progressive disclosure works |
| `missions_declared` | How common missions actually are |
| `email_submitted` | Acquisition conversion |
| `share_clicked` | Whether the growth mechanic works |
| `contextual_link_clicked` | Appetite for deeper content |
| `comparator_calculated` | Second-tool usage |
| `app_cta_clicked` | Web → app hand-off (replaces `signup_completed`) |

`result_status` is the most valuable signal — the closest thing to a direct test of whether frontaliers are actually near these thresholds.

**In-app analytics are first-party and minimal.** No Firebase Analytics, no advertising ID, no third-party SDK beyond FCM. The app reports to our own API, in aggregate, only: mode chosen at onboarding, permission granted or refused, proposals confirmed vs corrected, days logged, dossier exported. **The correction rate is the single most important number the product measures** — it is the accuracy of detection, stated by users, and if it is high the auto mode is a liability rather than a feature. It is reported **per confidence tier**: a high correction rate on `HIGH` days means the tiering is wrong; on `MEDIUM` days it means the threshold for withholding should move. Nothing about *where* a user was is ever reported.

---

## 16. Accessibility

The design system's components carry the basics; four items need explicit attention, and the bar is higher than usual because a misread has financial consequences:

- Zone/status is **never colour-only** — icon + text label on every surface including the PDF.
- Warning `#B7791F` never as body text colour on white; enforced by lint plus an automated contrast audit over every foreground/background token pair in use.
- Touch targets on the daily log ≥ 48px — a one-handed, on-a-train interaction. Verified at 320px with no horizontal scroll.
- `aria-live="polite"` on the calculator result so recalculation is announced; full keyboard paths through the form, the accordion, and the mobile hamburger. `jest-axe`: zero violations, every web component, every state.
- **Android:** every composable carries a `contentDescription` where meaning is not textual; the calendar grid is navigable by TalkBack, and a day cell announces kind *and* record quality *and* provenance — colour and shape convey nothing on their own. Touch targets ≥ 48 dp on Android, ≥ 44 px on web (D40), verified by tests. Text scales to 200% without truncation or overlap; the app respects the system font scale and never hardcodes `sp` overrides. Warning text is never set in `#B7791F` at body sizes; it uses `#111827` on the warning soft background.

---

## 17. Performance budgets (replaces the 15/60/200 tiers — D2)

| Surface | Budget | Gate |
|---|---|---|
| Web public: calculator, comparator, guides, home | ≤ 100 KB first-load JS (gzip) | size-limit, CI-blocking |
| Android APK download size | ≤ 12 MB | Gradle check, CI-blocking |
| Android cold start to Aujourd'hui interactive | ≤ 1.2 s on a mid-range device | Macrobenchmark, CI-blocking |
| **Detection battery cost** | **≤ 3% of a full charge per working day** | measured on device, recorded in `docs/detection-model.md` |

The battery figure is a product requirement, not an optimisation target. Background location that visibly drains a phone gets the app uninstalled and the permission revoked, which removes the feature and the user in one step. If the sampling schedule cannot meet it, reduce sampling frequency and accept lower-confidence days — the app is designed to withhold a proposal rather than guess.

- LCP < 2.5s on simulated slow 4G for the calculator — frontaliers read this on trains. Lighthouse CI blocking.
- **Week-one spike, unchanged in spirit:** build one component-heavy page with our own library, Inter variable font, and `lucide-react`, and measure. Lucide is tree-shakeable per icon; the variable font is the largest single asset and must be subset and preloaded. If the budgets can't hold, escalate before more pages exist — discovering it in week one is a config change; later, a rewrite.
- Zero third-party network requests on any web page, asserted from a network trace. Fonts self-hosted, analytics same-origin.
- The Android app makes **no network call in the detection path** — asserted by a test that runs a full sampling-to-proposal cycle with the network stubbed to fail.
- A budget not enforced in CI is a budget that silently disappears.

---

## 18. Deployment

Coolify on the OVH VPS, alongside the existing sites — **never touch saharadesertguide.com's containers or ports.**

- Multi-stage Dockerfile, Next.js `output: 'standalone'`. **`ENV HOSTNAME="0.0.0.0"` in the runner stage** — without it the container answers on localhost only and the proxy returns 502.
- **`trustHost: true`** in the Auth.js config — required behind Coolify's reverse proxy or callback URLs break.
- Chromium + fonts installed in the runner stage (Debian slim base, not Alpine) for PDF printing; Inter copied into the image so the PDF renders identically to the web.
- pg-boss started once in `instrumentation.ts` behind a `globalThis` guard — otherwise dev hot-reload and multiple workers duplicate the reminder scheduler.
- PostgreSQL as a Coolify-managed service; automated daily dumps — the entries table **is** the product; losing it is losing every user's evidence.
- Env: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_UMAMI_*`, `TZ=Europe/Paris`.
- Umami as a separate Coolify service, proxied same-origin.
- Health check endpoint `/api/health` (DB ping) wired into Coolify.
- Env additions for v2: `FCM_SERVICE_ACCOUNT_JSON`, `PDF_TOKEN_SECRET`, `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_CERT_FINGERPRINTS` (for the App Links `assetlinks.json` served at `/.well-known/`).
- **Error monitoring (D32):** GlitchTip as a Coolify service; the backend reports to it with request bodies scrubbed of email and any entry payload. **The Android app carries no monitoring SDK** — crashes are read from Play Console only.

### 18.1 Android release

- Play Console: internal testing → closed testing → production. **The API is versioned (`/api/v1`) from the first build**, because an app in the field cannot be redeployed like a server: old versions keep calling, so no breaking change to a shipped endpoint, ever.
- **Data safety form** must match §13 exactly: location collected but **not** stored or shared, processed on-device only; email and day records collected and stored; nothing shared with third parties; deletion available in-app.
- **Background location declaration** — Play requires a written justification and a demo video showing the in-app flow. The prominent-disclosure screen (§11.1 screen 2) exists partly to satisfy this and must appear *before* the system dialog.
- Signing via Play App Signing; release builds are minified with R8 and shipped as an App Bundle; mapping files uploaded.
- A forced-update mechanism: the API can flag a minimum supported version, and the app shows a plain update screen rather than failing silently.

---

## 19. Testing strategy — whole project

**Engine** — §7.6: Geneva fixtures (ship-blocking), 100% coverage, eight property invariants × 10,000 cases, no snapshots.

**UI** — unit tests on every component; formatters exhaustively including 0, negatives, half-days, and **codepoint assertions** on separators, identical across Node 20/22; `renderRailSvg` byte-identical between Node and browser for the same input; visual baselines for every rail variant × zone, all four badge states, and the 200px thumbnail; snapshots allowed here.

**Params** — round-trip property test; malformed, missing, and hostile values; exhaustiveness tests: every `ValidationError` and every `Status` has French copy — a test enumerates each union and fails on any gap.

**E2E (Playwright)**
- Calculator: three fields → result; **Geneva case (c) through the UI displaying `39,16 %` and `45,0 %`**; accordion + missions → status change; param URL pre-fills and matches; email submit leaves the result visible; 320px, no horizontal scroll, targets ≥ 48px.
- Auth: magic-link round trip; `/inscription` pre-filled from calculator localStorage.
- Tracker: log today → confirmation row with server timestamp; edit via calendar modal → original timestamp still displayed, `EntryEvent` appended; backfill 8+ days → « saisie tardive » tag; **offline log → reconnect → entry syncs with both timestamps** (Playwright offline mode).
- Dossier: monthly table matches engine output for a seeded year; evidence annex rows carry timestamps and late flags; PDF route returns A4 with the rail; CSV columns exact.
- Account: full export contains every entry and event; deletion removes all rows.

**Android** — the Kotlin engine passes `fixtures/geneva-cases.json`, the same file the TS engine consumes, in CI on both projects (D20); a conformance test fails the build if either implementation diverges on any case. Detection: unit tests for the border polygon (points inside, outside, inside the 150 m buffer, and within 500 m of the frontier), **hysteresis** (a 9-minute excursion is folded back, a 31-minute one is not), **tier assignment** at each boundary, `LOW` withholding, and a full sampling-to-proposal cycle with the network stubbed to fail. **Rule versioning:** the Geneva fixtures pass unchanged under `taxYear: 2026`; a synthetic 2027 rule set with a different ceiling changes a synthetic case and leaves the 2026 fixtures untouched. **Absence isolation:** engine output is identical for a year with and without `ABSENT` rows. **Idempotency:** a replayed batch with a seen `clientMutationId` writes no new row and no new event. Room + WorkManager: queue survives process death, replays on reconnect, and both timestamps land. Compose UI tests for the four screens including TalkBack semantics and 48dp targets. Screenshot regression (Paparazzi/Roborazzi) for the rail, the badge, the day cell in every state, and the calendar legend. **A test posts a payload containing coordinates and expects the API to reject it** (D18).

**A11y** — jest-axe zero violations on web; keyboard paths (§16); Compose semantics and 200% text scale on Android.
**Performance** — size-limit + Lighthouse CI, blocking (§17); network trace asserts zero third-party requests and zero cookies on public routes.

---

## 20. Boundaries

**Always:**
- Run the full test suite before any commit touching `lib/calc-engine`; cite a primary source for any new constant or rule; add a fixture whenever an interpretation is clarified; name the rounding rule at every rounding site; emit `EXACT_METHOD_UNVERIFIED` for user-supplied denominators.
- Reference `DESIGN-SYSTEM.md` tokens; render status as colour **plus** icon **plus** text; route every number through `format/`; keep `zones.ts` the single source and generate `_zones.scss`; normalise `Intl` separators explicitly; add a visual baseline with any component change.
- Show the result before asking for anything; keep every user-facing string in `lib/fr`; canonical + `noindex` on param URLs; show both rates when they differ.
- Assign entry timestamps on the server; append an `EntryEvent` for every write; show the original entry timestamp wherever an entry is edited; carry « saisie tardive » into the dossier.

**Ask first:**
- Any runtime dependency in `calc-engine`; changing a constant, a rounding rule, or the engine's public API; building the exact-method calendar path; supporting Germany or Italy.
- Adding a component to `lib/ui`; changing a zone/status colour or label (they appear in the PDF, the OG image, and every screen); raising a size budget; shipping the dark theme; adding a radius, colour, or type token outside `DESIGN-SYSTEM.md`; instantiating any component listed as "not instantiated" in `DESIGN-SYSTEM.md` §2.
- A fourth visible calculator field; adding or renaming a URL param; any third-party script; changing a target keyword or slug; a fifth app screen.

**Never:**
- Engine: perform I/O or read the clock; throw for invalid user input; clamp negative headroom; return a monetary amount; fold mission days into the declarable rate when telework alone exceeds 40%; unify the two rounding rules; invent a denominator the employer did not use.
- UI: import React inside `lib/ui/core`; hardcode a colour, spacing, radius, or font size outside the token set; set warning text in `#B7791F` at body sizes; load fonts from a third-party CDN; use a flag emoji; draw a map, a live location dot, or a day timeline; duplicate the rail's drawing logic; colour the rail by `Status`; trust `Intl` codepoints unnormalised.
- Product: gate the result behind email, signup, or share; set a cookie on a public route or add a consent banner; put personal data in a URL param; display a monetary amount or a recommendation; ship a percentage without its status badge; rename a published param or slug.
- Evidence: accept a client-supplied `recordedAt`; update or delete an `EntryEvent`; hide the late flag; let the public site depend on the app's runtime.
- **Detection (v2): write an entry without a user confirmation; store, log, or transmit a coordinate; auto-detect a mission day; guess a day from a low-confidence signal; discard an overridden `detectedKind`; render a map, pin, route, or location history anywhere; nag for the location permission after a refusal; present manual mode as degraded; use a radius, colour, or spacing value that is not a token; add a shadow to a card.**
- **v2.1: auto-confirm at any confidence tier; let an `ABSENT` row reach `TeleworkInput`; read a threshold from anywhere but the year's `RuleSet`; sync, log, or print a device-only geofence or the detection tally; put a monitoring SDK in the app.**

---

## 21. Success criteria

**Technical**
- [ ] All six Geneva fixtures reproduce exactly, including 39,16 % and 4,16 %; Geneva case (c) also reproduced end-to-end through the UI
- [ ] 100% statement and branch coverage on `lib/calc-engine`; all eight property invariants pass × 10,000 cases; zero runtime deps; median execution < 0.1 ms
- [ ] Param round-trip property test passes over 10,000 inputs
- [ ] `renderRailSvg` byte-identical Node vs browser; all rail/badge baselines pass; 200px thumbnail legible to a human reviewer
- [ ] `formatPercent(34.6)` → `"34,6 %"` with U+00A0 and `formatDays(1234.5)` → `"1 234,5"` with U+202F, asserted by codepoint, identical on Node 20 and 22
- [ ] Zero raw hex, radius, or spacing literal outside the token set in web `src/` and Android `ui/`; zero React imports in `lib/ui/core`; all lint-enforced
- [ ] Rail parity: the Compose rail and the web SVG rail match pixel-for-pixel at the same width in screenshot tests
- [ ] Budgets in §17 green in CI; LCP < 2.5s slow 4G on the calculator; zero third-party requests; zero cookies on public routes
- [ ] Zero jest-axe violations; usable at 320px; calculator page meaningful with JS disabled
- [ ] Every `ValidationError` and `Status` has French copy, exhaustiveness-tested
- [ ] Offline log queued and synced with both timestamps, proven in E2E; `EntryEvent` audit append-only, proven in E2E
- [ ] PDF renders A4 with the same rail and formatters as the web; CSV schema exact
- [ ] Account export and deletion work end-to-end
- [ ] Expert reviewer signed off on the reviewer cases, including one `residence-1983` canton and one part-time mid-year start
- [ ] **Both engines pass `fixtures/geneva-cases.json` identically**; a deliberate one-digit divergence fails CI on both projects
- [ ] **No coordinate anywhere outside `detection/`** — proven by a lint rule, an API rejection test, and a full-database inspection after a simulated month of auto-mode use
- [ ] Detection battery cost ≤ 3% per working day, measured on a real device and recorded
- [ ] Sampling-to-proposal cycle completes with the network unavailable
- [ ] Manual mode reaches an identical dossier to auto mode from the same days — asserted by a test running both paths
- [ ] Play Store data safety form matches §13 line by line; background-location justification accepted
- [ ] Geneva fixtures unchanged after the `RuleSet` refactor, byte for byte
- [ ] Engine output identical with and without absence rows; a replayed `clientMutationId` produces no new event
- [ ] Hysteresis and buffer tests pass; the proposal card shows the tier in words and never auto-confirms

**Product gates — these matter more than the technical ones**
- [ ] ≥ 40% of calculator visitors trigger `calculated`
- [ ] ≥ 15% of those who calculate submit an email or click through to the app
- [ ] **Correction rate below 10%** — if users override more than one detection in ten, auto mode is producing work rather than removing it, and the default should change
- [ ] Location permission granted by a meaningful share of those who choose auto mode; if most refuse at the system dialog, the priming screen is failing
- [ ] `result_status` shows a meaningful share outside `compliant` — if essentially everyone is comfortably compliant, the premise needs rethinking
- [ ] At least one organic share in a frontalier group not posted by us
- [ ] First real users logging daily within two weeks of launch; first dossier exported during the first declaration season

A perfect 90 KB page nobody shares has still failed.

---

## 22. Open questions

Merged from all six documents, deduplicated, ordered by lethality.

1. **Is the employer's attestation sufficient?** *The one that can kill the product.* From 2026 Swiss employers must certify each frontalier's telework percentage; if they reliably hand over a clean signed document, the employee has no reason to keep their own. Ask 10 frontaliers what their employer actually issued for 2026 — before more is built on top.
2. **Is the pain felt or anticipated?** Search frontalier groups for anyone already reassessed or audited. Zero hits means selling insurance against an invisible risk.
3. **The 29 April 2026 interpretative agreement** — held second-hand. Read the PDF and confirm the waterfall order before the fixtures are frozen.
4. **Truncation vs rounding of the declarable rate.** Both Geneva examples are consistent with truncation, which is strong but not conclusive. Confirm with the AFC or the reviewer; if it is rounding, invariant 7 inverts.
5. **Who is the named expert reviewer**, and what do they want — fee, revenue share, referral flow? A tax-adjacent product with no expert name attached is a liability; `/a-propos` depends on the answer.
6. **Does the timestamp column need tamper-evidence** (hash chain, third-party timestamping) to hold up, or is a server-side receipt enough? Legal weight — ask the reviewer. The append-only `EntryEvent` table is designed so a hash chain can be added without a migration.
7. **Under `granularity: 'hours'`, what is the denominator unit?** Presumably annual contractual hours, not 240 days; if the combinations are mutually exclusive, validation should reject rather than compute something meaningless.
8. **Does a `residence-1983` breach cost the status for the whole year or only the excess days?** Affects warning copy severity, not arithmetic.
9. **Do users know their employer's denominator method?** The single biggest calculator UX risk — test the disclosure copy with ten frontaliers.
10. **Does the two-rate display confuse more than it informs?** Watch the same ten conversations; a collapsed « pourquoi deux taux ? » disclosure may beat showing both.
11. **Does the `mission-exposure` badge need its own rail tick** marking where the mission cap sits? Prototype both; decide with the 200px test.
12. **Keyword targets** for the calculator slug and the pillar — check difficulty before anything is indexed; slugs are permanent.
13. **Domain: `.fr`, `.ch`, or `.com`?** `.ch` reads as Swiss authority; `.fr` may rank better for French-resident searches. Decide before anything is indexed.
14. **Entity for the venture** — sole trader in Morocco vs a Swiss/French entity affects payments later, credibility now, and whether advisors refer clients.

### v2 questions — detection

15. **Does detection actually work at the border?** Geneva's frontier runs through suburbs; a worker living in Ferney-Voltaire and working in Meyrin may be 3 km apart. Balanced-power location has an accuracy envelope of tens to hundreds of metres, which is fine there but marginal for someone living in a border commune. **Measure before building the UI on top of it** — a week of real fixes on both sides, comparing the proposal against a hand-kept log.
16. **Is the polygon good enough, and who maintains it?** Border geometry from a public dataset, its licence, its accuracy near enclaves, and what happens when it changes. Also: the app ships it, so a correction requires a release.
17. **Does the employer's declared workplace need to be part of the model?** Resolved in principle by D31: if polygon-only fails the gate, *domicile* and *lieu de travail* geofences are built **on the device only, never synced**. What remains open is the radius (150 m vs 300 m) and whether a user should be able to define a third place.
18. **What is the legal weight of a corrected detection?** The dossier discloses that the app proposed X and the user recorded Y. That is more honest than hiding it, but ask the expert reviewer whether it strengthens or weakens the document in front of an administration — the answer might change how prominently provenance is printed.
19. **Does background location survive Play review**, and how long does it take? Assume it is a schedule risk, not a formality. Manual mode existing as a complete product is the mitigation.
20. **Is iOS a fast follow or a rewrite?** iOS background location is more restrictive and the review posture is different. Deciding early affects whether the engine port is treated as one-off or as a shared-core problem.

---

## Standing caveat

The regulatory figures throughout (40% fiscal, 49.9% social, 10 mission days inside the 40%, 3-month irrevocable LAMal/CMU option, the 240-day basis, the five-case waterfall) were compiled from advisory and news sources plus Geneva's published examples. **Verify every constant against admin.ch, the Swiss Federal Tax Administration, and impots.gouv.fr before the fixtures are frozen.** These rules change annually — that maintenance burden is also the moat, and the visible « vérifié le » date in the footer is the promise that it is being carried.

---

*Consolidated 18 August 2026 from SPEC-calc-engine v2, SPEC-ui-foundation v2, SPEC-calc-web, design.md, architecture.md, and the frontalier-telework-dossier one-pager. Section 2 lists every deviation; everything else is carried over unchanged.*
