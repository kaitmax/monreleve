# DESIGN-SYSTEM.md — Frontier Work v1.0, adapted for frontalier

Adopted 03.09.2026, replacing IBM Carbon v11 across web, Android, and the PDF. This document is the single source for visual tokens. The external *Frontier Work Design System v1.0* is adopted **in full for tokens, type, radius, colour, iconography, components, motion, and accessibility**. The sections marked **Override** record where a product decision already taken (spec D16–D34) constrains how a component is instantiated. Overrides are few, and each states its reason.

Paste the **Token block** (§1) at the top of any design prompt.

---

## 1. Token block (paste into every prompt)

```
DESIGN SYSTEM — Frontier Work v1.0 (frontalier adaptation)

Personality: trustworthy, calm, precise, private, minimal. Reference: Apple + Linear + Stripe Dashboard. Never GPS-tracker aesthetics, never gamification, no neon, no heavy shadows, no large illustrations.

FONT: Inter everywhere (web + Android; Roboto only as system fallback). All figures, percentages, dates and timestamps use Inter with TABULAR NUMERALS (tnum) so columns align.
TYPE: Display 48/56 600 (large statistics only) · H1 32/40 700 · H2 24/32 700 · H3 20/28 600 · Body-L 17/26 400 · Body 15/22 400 · Body-M 15/22 500 · Caption 13/18 400 · Micro 11/14 500 (sparingly). Weights 400/500/600/700 only.

SPACING: 4 px base. 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 64 · 80. Screen horizontal padding 20 px (mobile), 32 px (desktop).

HEADER + HAIRLINE (ruling R68, R69): `size-header-height` 64 · `size-header-height-mobile` 56 · `size-button-compact-height` 40 · `size-rule` 1. The two header heights settle FD1/FD11 (desktop, 64) against FD2 (mobile, 56); the compact CTA is FD2:31. **Distinct names even where values coincide** — 56 is also the large button's height and 40 the text button's, and borrowing either would couple the header to a button, so changing the large button to 60 would silently move the mobile header. `size-rule` is a hairline: six sites were aliasing the *card* border for it.

BREAKPOINTS (ruling R68): `$breakpoint-md` 768 — **Sass only, never a custom property, and that is a mechanism constraint rather than a preference.** A media query *condition* cannot read `var()`: a custom property is resolved per element at compute time, while a media query is evaluated before and outside any element, so `@media (width >= var(--breakpoint-md))` never matches. Emitting one would publish something that looks available and fails silently at the one place anyone would reach for it. It lives in `_breakpoints.scss`, which emits no CSS, and `tokens.scss` `@forward`s it — measured: `@use "tokens"` from a CSS Module emitted a full `:root` block and 4 386 bytes into that one component, and again into every other that needed the breakpoint.

TYPE PAIRS (ruling R70): `label` 13/18/500 · `wordmark` 17/26/600. The scale gives each size one weight, and these two pairings were previously **composed across families** — the input label took Caption's size and Body-M's weight. That means a change to Body-M silently restyles every label, and the two halves of one decision sit on lines a reviewer never sees together. No cross-family composing; a test scans the component stylesheets and fails on any rule taking its size from one family and its weight from another.

LAYOUT WIDTHS (ruling R64): Desktop padding 32; public content max 1200. 1440 is Frontier's dashboard bound, reserved, not tokenised until a consumer exists. The three named widths are `public` 1200 · `narrow` 720 (the calculator column) · `article` 680 (the prose measure, ~70 characters per line). `Container` maps its `'public' | 'narrow' | 'article'` union to these three tokens and nothing else — there is no arbitrary-width escape. Issued after FW9 stopped at Container: this clause used to read "max content 1440", which contradicted FD1, FD11 and FD13 all specifying 1200, and the conflict was not mine to resolve.

SIZES — icons, dots and tick marks (ruling R62): `icon-sm` 16 · `icon` 20 · `icon-lg` 24 · `dot` 6 · `dot-lg` 8 · `tick` 2. Added because three components had otherwise borrowed a token that meant something else — a spinner's height for a chip icon, a spacing step for a legend dot — and a semantic alias is exactly what §4.1 removed from the radius scale. Sizes that a component measures in code (the rail's geometry) mirror these by test rather than referencing them, because an SVG geometry attribute resolves `var()` to zero when no cascade is present.

RADIUS — a closed set of nine token names, never arbitrary (see §4.1):
  xs 4 · checkbox 6 · sm 8 · md 12 · button-lg 14 · lg 16 · xl 20 · 2xl 24 · pill 999.
  Component mapping (this is where it lives; there are no CSS aliases): Buttons and inputs md · Large primary button button-lg · Small badge sm · Checkbox checkbox · Card lg · Large status card xl · Bottom sheet 2xl (top corners) · Skeleton sm · Toast md · Chips/progress/confidence bars pill.

COLOUR — LIGHT:
  Background primary (canvas) #F7F8FA · Surface / card #FFFFFF
  Text primary #111827 · secondary #667085 · tertiary #98A2B3 · disabled #C4C8D0
  Border default #E4E7EC · strong #D0D5DD
  Brand (Deep Alpine Blue) #173B63 — primary CTA, active nav, links, selected states. Not everywhere.
  France #315FA8 (soft #EAF1FB, text #244A82) · Switzerland #D84B4B (soft #FCECEC, text #A93636) — small indicators, dots, chips only; never flags across the interface.
  Success #15803D on #EAF7EE · Warning #B7791F on #FFF7E6 · Error #C53030 on #FDECEC · Info #2563EB on #EDF4FF

ICONS: Lucide, 1.75 px stroke, 20 px default (16 small, 24 large). Never mix filled and outlined at random.

BUTTONS: Primary 48 h, radius 12, brand fill, white label 15/600, min width 120. Large primary 56 h, radius 14 (onboarding, major actions). Secondary 48 h, radius 12, surface fill, 1 px border. Destructive 48 h, radius 12, error fill. Text button 40 h. Icon button 44 × 44, radius 12. Loading: label hidden, 20 px spinner, size unchanged.
INPUTS: 48 h, radius 12, 1 px border, 14 px padding; label 13/500 6 px above; focus 2 px brand border; error 2 px error border + 13 px message.
CARDS: #FFFFFF, 1 px #E4E7EC, radius 16, padding 16. No shadow by default. Status card radius 20, padding 24.
SHADOWS: none on cards. 0 1px 3px (subtle) · 0 4px 12px (floating) · 0 12px 32px (modal). Borders preferred.
BOTTOM SHEET: radius 24 top, 36 × 4 px drag indicator centred, options ≥ 52 px tall.
BOTTOM NAV: 4 items, 80 px incl. safe area, 24 px icons, 11–12 px labels, active = brand colour, inactive = neutral. No oversized pill.
CONTROLS: radio 22 px (10 px inner), checkbox 22 px radius 6, switch 52 × 32 thumb 24. Touch targets ≥ 44 px (web/iOS), ≥ 48 dp (Android).
PROGRESS: 8 px tall, radius 999, never taller. CONFIDENCE BAR: 6 px, radius 999.
OFFLINE BANNER: 36 px. TOAST: 320–420 w, radius 12, 3–5 s. SKELETON: radius 8, subtle shimmer — never a page spinner.
MOTION: 200 ms standard · 250 enter/modal · 300 bottom sheet · numbers animate over 300 ms. No bounce, no parallax, no animated maps.
DARK MODE tokens exist (bg #0B0F14, surface #111827, elevated #18202C, border #273244, text #F9FAFB/#98A2B3, brand #6EA1D7, France #6B93D6, Switzerland #E97878) — designed later; ship light first.

STATUS IS NEVER COLOUR ALONE: colour + icon + text, always. WCAG AA minimum. French copy throughout.
```

---

## 2. Product overrides

These are the only places where the adopted system is constrained by a spec decision. Everything not listed here follows Frontier Work v1.0 as written.

| Frontier Work item | Override | Why (spec reference) |
|---|---|---|
| §21/§31/§32 **Live location indicator**, pulsing dot, "Current location: France, since 08:14" | **Not instantiated.** The status card shows the *day's proposal or record*, never a live position. No pulse animation. | The app shows a conclusion per day, not movements (D18, §1 non-goals). A live dot is the GPS-tracker aesthetic the system itself warns against. |
| §33/§34 **FrontierMap**, map markers | **Not instantiated.** No map anywhere. | No map, pin, route, or history in any interface (spec §1). |
| §76 **"Today" timeline** (08:14 work started · 12:30 lunch · 17:42 expected end) | **Not instantiated.** | A movement history. Nothing of the kind is stored (D18). |
| §41/§42 **Evidence**: "GPS accuracy 18 m", "Home zone", "France geofence" | Component adopted; **content replaced** by the coordinate-free tally — number of fixes, minutes per side, buffer fixes discarded, tier in words. Device-only, never synced, never printed. | D34. Accuracy in metres and named zones require data the app never keeps. |
| §22/§23 **Confidence percentage** (97 %) and 6 px bar | Tier **in words** with icon (`Détection fiable` / `Détection incertaine — vérifiez`) and a 3-segment indicator. **No percentage.** | The on-device tier is not a calibrated probability; a percentage would be false precision (D27). |
| §25 **Threshold states** (safe < 30, attention 30–37.9, near 38–40, exceeded > 40) | **Regulatory bands are kept**: 0–40 / 40–49.9 / ≥ 49.9 on the rail, with ticks at both. Frontier's early-warning steps become **in-band alerts** at 30 % and 38 % (replacing the old 30/35), coloured warning, in addition to the bands. | Frontier Work omits the **49.9 % social-security threshold entirely**. It is a legal fact with a different consequence and cannot be dropped. Status enum unchanged. |
| §25 "Never present 40 % as universal legal advice — organisation config decides" | Thresholds come from the year's `RuleSet`, cited to primary sources, and every calculating surface carries the disclaimer. There is no organisation configuration. | D29; B2C product. |
| §28 **Bottom navigation labels** Home / Calendar / Statistics / Profile | `Aujourd'hui` · `Calendrier` · `Relevé` · `Paramètres`. Four items, in this order. | The dossier is the product; "Statistics" is not. Four screens is the whole app (§11). |
| §30 **Home header** greeting + notification bell | Greeting **adopted** (`Bonjour Camille` + date). **Bell not instantiated** — there is no notification centre; the app sends one daily reminder. | Warmth is welcome; a bell implies an inbox that does not exist. |
| §44/§45 **Onboarding** (4 screens ending "Enable location") | Frontier's *sequence* (explain → act → OS dialog) is adopted. The *content* is the spec's: mode choice first with manual pre-selected and cards visually equal, priming screen, refusal screen that never re-asks. Maximum 4 screens kept. | D19: manual mode is a peer; the location permission is never the finale of onboarding. |
| §61 **Toasts** | Allowed for settings feedback only (`Réglage enregistré`). **A pending sync is never a toast** — it is a persistent state on the entry until the server confirms. | Evidence semantics (§13.2). |
| §69/§70 **Motion**: success scale animation | Durations adopted. **No success animation on logging.** Number changes animate over 300 ms. | No gamification, no celebration on a tax record (§11). |
| §66 **Avatars** | Not instantiated in the app or on the web. | The product knows an email and a canton; no profile photo, no display name chrome. |
| §50–§59 **HR dashboard components** | Not built. Tokens reserved. | Out of scope (spec §1 non-goals; D33 keeps `organizationId` nullable). |
| §26 **Country chips with flag emoji** | Chips adopted **without flag emoji**; a 6–8 px country-coloured dot plus the word. | Frontier's own rule: never flags across the interface. Emoji render inconsistently across OEMs and never in the PDF. |
| §12 **Dark mode** | Tokens adopted; **light ships first**, dark after launch. | The dossier and the PDF are always light; dark doubles QA on the least valuable surface. |
| §68 **Touch targets 44 px** | 44 px on web/iOS; **48 dp on Android**. | Android platform guideline. |
| Language | All copy in **French**. Frontier's examples are English. | Single-locale product. |

---

## 3. Component mapping — Frontier → frontalier screens

| Frontier component | Where it lives here | Notes |
|---|---|---|
| FrontierStatusCard (radius 20, padding 24) | *Aujourd'hui* hero: today's record or proposal | Content: kind, tier in words, timestamp/provenance. No live position, no pulse. |
| FrontierProgress (8 px pill) | **The threshold rail** on calculator, Aujourd'hui, Relevé, PDF | Fill coloured by regulatory band; two tick markers at 40 and 49.9 protruding 4 px above and below the bar with tabular labels. |
| FrontierConfidence | Tier line on the proposal card and in the edit sheet | Words + icon + 3-segment indicator; no %. |
| FrontierCountryChip | Kind indicator: `Suisse` (CH dot), `Domicile` (FR dot), `Mission` (neutral), `Absence` (tertiary) | Dot + word; letter `S/D/M/A` kept in calendar cells for density. |
| FrontierWorkdayChip (28 h, radius 8) | Record-quality tags: `À temps`, `Saisie tardive`, `Non renseigné`, `Corrigé` | Colour + text. |
| FrontierCalendar (≥ 44 cells, 6 px dot) | *Calendrier* | Cell: date 14/500, kind letter, country dot, 4 px quality bar at the bottom edge (kept — it is the product's signature), corner triangle for corrected. |
| FrontierBottomSheet (radius 24) | Day edit sheet, mission destination, absence reason, export unavailable, account deletion | 36 × 4 drag indicator. |
| FrontierBanner (36 px offline; card-style for others) | Offline, unlogged days, detection interrupted, provisional relevé, section warnings | Left accent 4 px in the status colour, surface fill, text primary. |
| FrontierEvidence | « Base de la détection » in the edit sheet | Coordinate-free content (D34). |
| FrontierEmptyState | Relevé vide, Calendrier vide | Illustration optional in Frontier → **none here**; text + one button, left-aligned. |
| FrontierSkeleton (radius 8, shimmer) | All loading states | Never a page spinner. |
| FrontierButton / IconButton / Input / Radio / Switch / Toast | Everywhere | Per token block. |
| FrontierCard (radius 16) | Calculator form card, result panel, tiles, guide summary blocks | No shadow. |
| FrontierMap, FrontierAvatar, live dot, timeline, dashboard components | **Not instantiated** | See §2. |

---

## 4. Screen-level consequences

- **Canvas is grey (`#F7F8FA`), cards are white.** This inverts the Carbon layering (white canvas, grey tiles). Every surface that was a grey tile on white becomes a white card with a 1 px border on the grey canvas.
- **Headers are light.** No dark app bar, no dark web header. Web header: `#FFFFFF`, 1 px `#E4E7EC` bottom border, wordmark and nav in `#111827`, brand-colour primary button. Android app bar: canvas colour, title `#111827`.
- **The rail is now the Frontier progress primitive** — 8 px, pill — with our two regulatory ticks. Its zone colours are Frontier's status colours: success / warning / error.
- **Kind gains a country colour.** Suisse = Switzerland red dot, Domicile = France blue dot, Mission = neutral, Absence = tertiary grey. Never colour alone: the word or the letter always accompanies the dot.
- **Numbers are Inter tabular, not a monospace face.** Same alignment guarantee, one font family.
- **The PDF** uses Inter, black rules on white, the three status colours plus the two country colours for dots only; radius does not apply to print. Monochrome-survival rule unchanged.
- **Web components** are ours, built on these tokens (Sass + CSS variables, Lucide via `lucide-react`). `@carbon/react` and `@carbon/styles` are removed.
- **Android** uses Compose `MaterialTheme` **wrapped in `FrontierTheme`** (Frontier §73). Material components are now permitted, themed to these tokens; the former blanket ban on `RoundedCornerShape` becomes a rule that **every radius must be a token** (a lint check rejects any `.dp` radius not in {4, 8, 12, 14, 16, 20, 24, 999}).

---

## 4.1 How the radius rule is enforced (ruling R8)

The radius scale is closed at both ends, by two independent checks. One alone is not enough: token-name enforcement without a definition check lets a tenth token be invented, and a numeric-set check without use-site enforcement lets a raw length that happens to be in the set past.

**At the point of use — token names only.** `border-radius` and its longhands accept `var(--radius-*)` drawn from the nine names above, plus `0` and `50%` (circles). Enforced by stylelint (`declaration-property-value-allowed-list`).

- A raw length is rejected **even when its value is in the set**: `border-radius: 6px` fails, and `var(--radius-checkbox)` is how you say six.
- A `var()` from another token family is rejected: `border-radius: var(--space-2)` fails.
- Multi-value corners compose token names: the bottom sheet is `border-radius: var(--radius-2xl) var(--radius-2xl) 0 0`.

**At the point of definition — the closed numeric set.** A unit test compiles `lib/ui/core/styles/tokens.scss` and asserts that exactly the nine `--radius-*` properties exist, that each equals its documented value (4, 6, 8, 12, 14, 16, 20, 24, 999 px), and that **no other `--radius-*` property exists**. Adding `--radius-foo: 7px` fails both the name assertion and the numeric-set assertion.

**Consequence: the semantic aliases were removed.** `--radius-card`, `--radius-button`, `--radius-input`, `--radius-sheet`, `--radius-badge`, `--radius-card-status`, `--radius-skeleton` and `--radius-toast` no longer exist, because an alias is a tenth name and the definition check counts names, not values. `--radius-button-large` is now `--radius-button-lg`. The component-to-token mapping that those aliases used to carry lives in the §1 token block instead — a document a designer reads, rather than a CSS file only a build reads.

## 5. What did not change

The zone/status distinction; the rail's two ticks; provenance in words everywhere; the late flag; the four screens; manual as a peer; detection proposes and the user disposes; no map, no history, no coordinates; French copy; tabular figures; the monochrome-survival rule for the PDF; the disclaimer on every calculating surface; the vocabulary constraint (*déclaré / enregistré / horodaté*, never *certifié*).
