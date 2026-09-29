# Home page and public shell — design (FW33, FW34)

- **Date:** 29.09.2026
- **Status:** design approved section by section (H1–H6). It was then verified against the repository by twelve independent reviewers: six finders and six adversarial checkers, 96 findings. This revision folds in every confirmed finding. The four decisions that verification raised (§2.2) were then put to the user and ruled (H7–H10), each as recommended. It awaits the user's review before an implementation plan is written.
- **Inputs:** the user's Carbon-style mockup and request ("improve the home page the navigation the spacing"), `home.png` (repo root, 06.09.2026), `prompts/design-frontier/FD11-accueil-desktop.md`, the live site, `DESIGN-SYSTEM.md`, SPEC.
- **Scope:** `web/` only. Nothing in `android/`, the calculation engine, the database schema or the deployment changes.

---

## 1. Goal

Replace the placeholder home page (`web/app/(public)/page.tsx`: one heading, one intro, two "doors") with the full FD11 page, and fix the public shell's navigation and footer on the way. The home page has one job: route a visitor to the calculator, the guides or the app, and be believed while doing it.

It must stay true on the day it ships. Every sentence that depends on a product capability derives from the flag that owns that capability (R172, R186). Nothing on the page claims more than the record supports.

---

## 2. Decisions

### 2.1 Recorded, as made

| # | Question put to the user | Answer, verbatim |
|---|---|---|
| H1 | Which visual direction should the home page follow? | "Frontier Work, as home.png (Recommended)" |
| H2 | While the app doesn't exist yet, how should the page treat everything that depends on it? | "Honest now, flips itself (Recommended)" |
| H3 | Which approach should the design take? | "A: two slices, shell first (Recommended)" |
| H4 | Section 1, the shell | "yes its look right / go" |
| H5 | Section 2, the home body, **and** SPEC §20's ask-first item *"Adding a component to lib/ui"* for `Button`, `Card` and `IconTile` | "yes" |
| H6 | Section 3, tests and execution | "yes" |
| H7 | Where FD11 conflicts with DESIGN-SYSTEM.md, which wins? (nav colour; Display type for the 01/02/03 numerals) | "DESIGN-SYSTEM wins (Recommended)" |
| H8 | Buttons: 15/600 (no such type token) or 15/500? | "Body-M 15/500 (Recommended)" |
| H9 | May I add `--size-icon-tile: 44px`? (SPEC §20 ask-first token) | "Add --size-icon-tile (Recommended)" |
| H10 | Footer Guides column: all seven, FD11's three, or today's one? | "All seven guides (Recommended)" |

- **H5 is the SPEC §20 ruling** for the three new `lib/ui/react` components, and **H9 the SPEC §20 ruling** for the one new token. Both go verbatim into REPORT-FW34; H7 and H10 go verbatim into REPORT-FW33.
- **H1 keeps D35.** The mockup's IBM Carbon visuals were declined.
- **H1 reverses FW20's "no hero theatre" (`tasks/todo.md:405`, the phrase's only site in todo.md).** The placeholder's two equal doors were that decision's answer; FD11's hero with one repeated primary action replaces them. The reversal is the user's and is recorded here, so that a later reader does not find the old line and "restore" it.
- **H2 and the *Pourquoi* band.** The option text said card 3 *and* the *Pourquoi* band would describe the app as coming. Section 2 instead kept *Pourquoi* as general reasoning about records, which claims nothing about the product, and asked the user to say if they wanted otherwise. The user approved Section 2 as presented.

### 2.2 Raised by verification, then ruled (H7–H10)

These surfaced in verification. Each is either a conflict between FD11 and a normative document, or an ask-first item. None was resolved in code; each was put to the user, and the last column is the ruling.

| # | Decision | Options | Ruling |
|---|---|---|---|
| **H7** | Where FD11 conflicts with `DESIGN-SYSTEM.md`, which wins? Two instances: (a) nav colour, DESIGN-SYSTEM §4 `#111827` versus FD11 `#667085`; (b) DESIGN-SYSTEM:17 limits Display type to "large statistics only", while FD11 sets the ornamental 01/02/03 in Display. | DESIGN-SYSTEM wins; or FD11 wins and DESIGN-SYSTEM.md is amended under a recorded ruling | **H7: DESIGN-SYSTEM wins.** It is normative (D35, SPEC §6), and FW9 already settled the nav colour its way. The nav stays `text-primary`; the numerals use the H2 triple. H7 supersedes H4 on the nav colour: H4 approved `text-secondary` before this conflict was shown. |
| **H8** | Button label type. DESIGN-SYSTEM:53 and FD11 say 15/600, but no 15/600 type triple exists. Composing `--type-body-m-size` with `--weight-semibold` is the cross-family defect R70 removed, and the R70 scan cannot see it. | Body-M 15/500, which every shipped button uses; or a new `--type-button-*` triple 15/22/600 (a new token, ask-first) | **H8: Body-M 15/500**, recorded as a deviation from DESIGN-SYSTEM:53 |
| **H9** | IconTile's 44 × 44 size. GuideCta already borrows `--size-icon-button` for the same square, and its comment says a second site "needs a token rather than a third alias". IconTile is that second site. | Add `--size-icon-tile: 44px` (ask-first); or alias `--size-icon-button` a second time under a ruling that overrides GuideCta's note | **H9: add `--size-icon-tile`** |
| **H10** | The footer's Guides column. SPEC §9.2 asks for the footer to be "the full sitemap" (seven live articles); FD11 §7 curates three (*Règle des 40 %*, *Seuil social*, *Droit d'option*). Today the column has one. | All seven (SPEC §9.2); FD11's three; or keep today's one | **H10: all seven**, as FW9's precedence rule reads: "the spec wins on conflict" (`lib/fr/shell.ts:103-110`) |

### 2.3 What changed after each section was approved

The user approved Sections 1–3 as presented. Verification then showed these parts of them to be wrong or unbuildable. Each correction is made below and summarised here, so the approval is not read as covering text the user never saw.

- **Shell (Section 1):**
  - The nav colour and the 69-baseline reason's *"caret"* both change: see H7 and §4.1.
  - The collapsed *Calculateurs* link takes its child's label.
  - The CTA keeps its own style: its migration to `Button` is deferred (§5.2).
  - The footer changes more than the two links first described (§4.2).
- **Home body (Section 2):**
  - The lead's social sentence gains the A1 condition and the modal *peut basculer*.
  - Card 3 is rewritten in the future tense, manual entry first, one clause per flag.
  - *Pourquoi* 02 and 03 headings are corrected.
  - The trust band's three body lines are rewritten, because each overclaimed.
  - The hero column is 680 px (the nearest token), not 640.
  - The text button is 44 px, not 40 (D40).
- **Tests (Section 3):**
  - The proposed 320 px check already exists (dropped).
  - The claim patterns are tagged by capability, not by `appExists`.
  - `/application`'s copy needs a small release-branch fix to keep the scan honest (§5.6).
  - The list of existing tests that change is made explicit (§7.3).

---

## 3. Non-goals

- One new token only: `--size-icon-tile` (H9), added in FW34 to `tokens.scss` and to `DESIGN-SYSTEM.md`'s token block under that ruling. Nothing else in `DESIGN-SYSTEM.md` changes.
- No client JavaScript in the home body. It stays a Server Component. FW33's chevron enters the shared client shell; its cost is measured on every route (§4.3).
- No change to the calculator, the guides' bodies, `/releve-annuel`, or any route's URL. `/application` changes only in one release-state branch that does not render today (§5.6).
- The header CTA *Suivre mes jours* keeps its own `.cta` rule and its `appExists` gating. It does **not** move onto `Button` (§5.2).
- No migration of other pages onto the new components (approach C was declined).

---

## 4. Slice 1 — FW33: the public shell

It changes the header and footer, which render on every public page.

### 4.1 Header (FD11 §1, FD2 for mobile)

- **Alignment, per breakpoint.**
  - Below `bp.$breakpoint-md`, the nav is `display: none` and `.cta` keeps `margin-left: auto`, which is FD2's "right, always visible outside the menu".
  - From `bp.$breakpoint-md`, `.nav` takes `margin-left: auto` and `.cta` resets to `margin-left: 0`, relying on `.bar`'s gap. The nav then sits centre-right, with the 12 px wordmark-to-nav gap gone (`PublicShell.module.scss:184`), and the CTA follows it when shown.
- **Spacing:** nav items are 32 px apart (`--space-8`; today `--space-5`, 20 px, at `PublicShell.module.scss:94`), set in Body-M 15/500.
- **Colour:** unchanged, `--colour-text-primary` (`PublicShell.module.scss:108`), as DESIGN-SYSTEM §4 fixes it (H7).
- **A disclosure with exactly one live child renders as a plain link to that child, labelled with the child's label.** Today that is *Calculateur de télétravail* → `/calculateur-teletravail-frontalier`, because `/calculateur-lamal-cmu` is `planned` (`routes.ts:117-122`).
  - A plural *Calculateurs* over one destination would misname it. The mobile panel already flattens to the child's label, so desktop and mobile then agree.
  - The rule lives in a **new pure function applied after `visibleNav`** in `lib/content/routes.ts`. `visibleNav` itself is unchanged, so `regulatory-gate.test.ts:195-205` stays green.
  - The menu returns on its own the day the second child goes live.
- **The chevron renders only on a real disclosure** (two or more live children), never on the plain-link form, because a caret on a link promises a menu. It appears on no page today, so its proof is a component render plus a gallery specimen, not a page baseline (§7.1).
- **Icons** are Lucide, with `strokeWidth` 1.75 (DESIGN-SYSTEM); the chevron is 16 px (`--size-icon-sm`).
- **SPEC §9.2 gains a correction line,** in the commit that ships the rule, recording the single-link rule (derived from R85 and `visibleNav`, approved H4). This is the repo's practice for SPEC lines the product has moved past (SPEC:674, R209).
- The header CTA is unchanged: gated on `appExists` through `ctaHrefIfOffered` (`PublicShell.tsx:147`), still styled by `.cta`: compact 40 px below the breakpoint, 48 px above.

### 4.2 Footer (FD11 §7, SPEC §9.2)

- **Grid:** the four columns become `repeat(4, 1fr)` from `bp.$breakpoint-md`, instead of `justify-content: space-between` over intrinsic widths (`PublicShell.module.scss:281-285`).
- **Mobile:** two columns below the breakpoint. The 44 px link rows are D40 touch targets and cannot shrink, so halving the column count is the only honest way to shorten the footer. This deviates from FD2:102's four stacked sections (§4.4).

Column contents, against FD11 §7:

| FD11 entry | Decision | Reason |
|---|---|---|
| Outils: *Calculateur 40 %* | Keep today's *Calculateur de télétravail* | R147/R153: a label names the tool, not a figure |
| Outils: *Calculateur LAMal/CMU* | Hidden while `planned` (unchanged) | R85 |
| Outils: *Alertes e-mail* → `/alertes` | **Added** | Live (`routes.ts:213`) |
| Guides: *Tous les guides* | Kept | — |
| Guides: *Règle des 40 %*, *Seuil social 49,9 %*, *Droit d'option* | **All seven live articles (H10)**, each labelled with its own `breadcrumbLabel` (*Le plafond fiscal*, *Le seuil social*, …) | SPEC §9.2 full sitemap. The labels are names (R153), and each is the article's own name for itself (R181) |
| Le produit: *L'application*, *Le relevé annuel*, *Tarifs* | Kept, as *L’application*, *Le relevé*, *Tarifs* | *Le relevé* is the nav's label for the same page |
| Le produit: *À propos* → `/a-propos` | **Added** | Live (`routes.ts:212`) |
| Le produit: *Sources réglementaires* | **Moved** from Légal to Le produit, keeping the label *Sources* | FD11's grouping; *Sources* is not a legal page |
| Légal: *CGU* | Kept as *Conditions d’utilisation* | The page's own name |

- **The guide labels must be derived, not typed** (R181), and `PublicShell` is a client module that cannot read the guide registry (`node:fs`). The implementation plan must choose how the labels reach it. The existing typed *Le plafond fiscal* entry is itself a transcription (§10).
- The `$legal-01` disclaimer and the derived review date are unchanged.

### 4.3 Constraints

- No new client state.
- **Size:** FW33's chevron enters the client shell on every route. The calculator's GATE A headroom (3.7 KiB, measured) is the binding figure, not home's (17.5 KiB). `pnpm size` is not in `gate:changed`'s base chain, so it is run explicitly on every FW33 commit that touches `PublicShell`. REPORT-FW33 records the before and after figures for the calculator and for home.

### 4.4 FW33 deviations, each with its reason

| Source says | This design | Why |
|---|---|---|
| FD11 §1: nav `#667085` | `text-primary` | DESIGN-SYSTEM §4 is normative (H7) |
| FD11 §1 / SPEC §9.2: *Calculateurs ▾* menu | A plain link while one child is live | A one-item menu is a wasted interaction (H4). SPEC §9.2 is annotated |
| FD2:102: footer in four stacked sections | Two columns below the breakpoint | The D40 rows cannot shrink (H4) |
| FD11 §7 footer entries | As in §4.2's table | R85, R147, R153, R181, SPEC §9.2 |

---

## 5. Slice 2 — FW34: the home body

### 5.1 Layout and outline

All values are existing tokens, named below. FD11's internal spacings apply by default: lead 20 below the H1 (`--space-5`), actions 32 below (`--space-8`) and 12 apart (`--space-3`), columns 40 below the *Pourquoi* H2 (`--space-10`). A value the scale cannot express goes to the nearest token and is listed in §5.5.

| Band | Element and heading | Surface | Spacing | Content |
|---|---|---|---|---|
| Hero | `section`, `h1` | canvas | `--space-20` top and bottom | Text column at `max-width: var(--layout-article)` (680 px), left-aligned. The right half stays empty canvas. |
| Destination cards | `section` with a visually hidden `h2`; card titles are `h3` set in `--type-h3-*` | three `Card`s | 24 px gaps (`--space-6`), equal height | `IconTile`, `h3`, Body, `text` Button pinned to the bottom |
| *Pourquoi une trace datée* | `section`, `h2`; items are `h3` | canvas, no card | `--space-20` top and bottom | Numeral, `h3` and Body in three columns |
| Trust band | `section` with a visually hidden `h2`; each column's eyebrow is an `h3` set in `--type-eyebrow-*` | one `Card`, padding `--space-8` | — | Three columns split by 1 px `--colour-border-default` rules |
| Closing strip | `section`, no heading | one `Card`, padding `--space-8` | `--space-16` above, `--space-20` before the footer | One Body-L `p` and one `primary` Button |

- **Outline:** h1 → h2 (cards, visually hidden) → h3 ×3 → h2 (*Pourquoi*) → h3 ×3 → h2 (trust, visually hidden) → h3 ×3, then the footer's existing h2 column heads. No level is skipped; the existing assembled-page heading-order test enforces it.
- **Type:** name the triples, never a shorthand:
  - H1: `--type-hero-size/-line/-weight` (40/48/700, R88)
  - numerals: `--type-h2-*` with tabular figures, not Display, which DESIGN-SYSTEM:17 keeps for statistics (H7)
  - trust-band eyebrows: `--type-eyebrow-*` with `--tracking-eyebrow` and uppercase (R89)
  - the review date: a `p` in `--type-h2-*` with tabular figures, **not** an `h2` element
  - lead and closing line: `--type-body-l-*`
- **Colour:** brand blue only where FD11 allows it: the hero and closing primary buttons, the three icon tiles, the `text` links. Numerals in `--colour-text-secondary`, because FD11's `#D0D5DD` measures 1.39:1 and fails R76.
- **Breakpoint:** the three-column grids, the trust band's columns and the closing strip's side-by-side layout apply from `bp.$breakpoint-md`.
- **Below the breakpoint**, one column:
  - the hero actions stack full width, as FD2:58 and :94 draw buttons
  - the cards stack
  - the trust band's columns stack, with horizontal 1 px rules in place of vertical ones
  - the closing strip stacks line over button

  Card padding stays 24 on mobile, as the existing brief cards do. The mobile gutter comes from `Container`.
- **Scoping hooks:** each band carries a `data-band` attribute (`hero`, `cards`, `pourquoi`, `trust`, `closing`). Every test that measures or reads text scopes to its band. The footer also prints the review date, so an unscoped check would pass from the footer alone.

### 5.2 Components (SPEC §20 ruling H5)

New directories under `web/lib/ui/react/`, each with `<Name>.tsx` and `<Name>.module.scss`. All three are Server-Component-safe (no `'use client'`).

- **`Button`** renders as a link or a button. All variants have `--radius-md` except where noted.

  | Variant | Height | Fill | Label | Min-width |
  |---|---|---|---|---|
  | `primary` | 48 (`--size-button-height`) | brand, white label | Body-M 15/500 (H8) | `--size-button-min-width` |
  | `primaryLarge` | 56 (`--size-button-large-height`) | as `primary`; radius `--radius-button-lg` (14) | as `primary` | `--size-button-min-width` |
  | `secondary` | 48 | white, 1 px `--colour-border-default` | as `primary` | `--size-button-min-width` |
  | `text` | `min-height: var(--size-touch-target-web)` (44), inline-flex, centred | none | brand, Body-M | none |

  - The `text` variant takes its trailing `arrow-right` (16 px, stroke 1.75) **as a child** passed by the page, so `Button` imports no icon.
  - `Button` never pairs `--type-body-m-size` with `--weight-semibold` or a raw `600` (R70). The R70 scan cannot see that composition, so the rule is stated here.
- **`Card`**: white, 1 px `--colour-border-default`, `--radius-lg`, no shadow. Padding is `--space-6` (24) by default and `--space-8` (32) when asked. It never uses `--size-card-padding` (16) or `--size-card-status-padding`, which mean other things (R62, R68). The 24 default follows FD11 rather than DESIGN-SYSTEM:55's 16, because the only consumer is FD11's page (§5.5).
- **`IconTile`**: a `--size-icon-tile` square (44, H9), `--colour-info-soft`, `--radius-md`, holding a Lucide glyph at `--size-icon-lg` (24) in `--colour-brand`, stroke 1.75, `aria-hidden`.
  - GuideCta's `.icon` square, the first site, either moves onto `IconTile` in FW34 or the report records why the two stay separate. Either way it stops aliasing `--size-icon-button`, which is what GuideCta's own note asks for.

**The shell CTA does not move onto `Button`.** Four findings showed why:
- `.cta` is FD2's compact 40 px button below the breakpoint, and no `Button` variant is.
- Importing `Button` into the `'use client'` shell puts it in every route's bundle.
- `PublicShell.test.tsx:395-400`'s brand-fill assertion lives on `.cta`.
- None of this can be seen while the CTA is hidden.

Migrating it is deferred until `appExists` makes it visible and testable.

`contrast.test.ts` discovers the three stylesheets automatically. Its exact list of container-nested rules is a deliberate edit (§7.3).

### 5.3 Copy

All strings live in `web/lib/fr`, the home copy in `index.ts`'s `HOME_COPY`, fully accented (R155), with typographic apostrophes (R126). **No figure is typed (R147).**
- Thresholds arrive formatted from `guideScope(currentTaxYear())`: `fiscal`, `social` and `a1Threshold`.
- Counts and labels arrive as arguments computed by `page.tsx` (§5.4).
- New no-break spaces (R91) are built with an `n(mark)` helper from `String.fromCharCode(0x00a0)`, never a raw U+00A0.

The French below is the draft; `lib/fr` is authoritative.

**Shared helpers, one home each (R206).** A new `lib/fr` module holds:
- `n()`
- the cardinal-word map, moved from its private home at `releve-annuel.ts:86-99` and taking a gender, so it gives *Un* or *Une*
- `frenchList`, moved from its private home in `tarifs.ts`

`RELEVE_COPY` and `TARIFS_COPY` then import them. `application.ts`'s and `guides.ts`'s private `n()` stay as they are (§10).

**Every regulatory block carries a typed `readonly SourceId[]`**, which must be non-empty. The type makes a non-`SOURCE_IDS` key a compile error. The blocks are listed with their ids below.

**Repeated actions are one key each** (R206): each `HOME_COPY.actions.*` entry is one `{label, href}` rendered wherever it appears.
- `calculator`: *Calculer mes jours* → `/calculateur-teletravail-frontalier` (hero and closing)
- `guides`: *Lire les guides* → `/guides` (hero secondary before release, and card 2)
- `app`: *Découvrir l’application* → `/application` (hero secondary at release, and card 3)

`HOME_COPY.intro` and `HOME_COPY.doors` are **deleted**, not orphaned.

#### Hero

- **H1:** *Combien de jours de télétravail vous reste-t-il avant {fiscal} ?*, a function of the formatted fiscal threshold.
- **Lead:** three sentences, each with its own scope.

  | # | Text | Sources |
  |---|---|---|
  | 1 | *Depuis le 1er janvier 2026, un frontalier résidant en France et employé en Suisse peut télétravailler jusqu’à {fiscal} de son temps de travail annuel sans changer d’imposition.* | `fiscalCeiling` (the date is the application date, `docs/regulatory-sources.md:117`) |
  | 2 | *Au-delà du maximum publié de {social}, son affiliation à la sécurité sociale peut basculer en France ; dès {a1Threshold}, la garder en Suisse suppose un certificat A1 en cours de validité.* | `socialCeiling`, `a1ThresholdRate` |
  | 3 | While `trackerExists` is false: *Ce site calcule où vous en êtes.* When true: *Ce site calcule où vous en êtes et vous aide à en garder une trace datée.* | — |

  - Sentence 1 fixes FD11's *"doit rester sous"*, which turned a ceiling into an obligation.
  - Sentence 2 fixes three things. It gains the A1 condition that the `socialCeiling` row itself carries (`lib/fr/sources.ts:141-143`): without it, a reader at 30 % with no A1 is told they are covered. It names whose figure {social} is, and says *peut basculer*, the calculator's own modal (`calculateur.ts:69-71`), so it stays true under both readings of the unresolved P2. And splitting the sentences stops *Depuis le 1er janvier 2026* from scoping the social threshold.
- **Actions:** `primaryLarge` → `actions.calculator`. `secondary` → `actions.guides` while `appExists` is false, `actions.app` when true.

#### Three destination cards

| # | Icon | Title | Body | Link |
|---|---|---|---|---|
| 1 | `calculator` | *Calculateur de télétravail* | *Votre part de télétravail annuelle, et les jours qu’il vous reste avant {fiscal} et avant {social}. Trois champs, sans inscription.* Sources: `fiscalCeiling`, `socialCeiling`. | *Ouvrir le calculateur* → `/calculateur-teletravail-frontalier` |
| 2 | `book-open` | *Comprendre les règles* | *{Count} guides, dont {topics}.* | `actions.guides` |
| 3 | `smartphone` | *L’application* | One clause per flag, below | `actions.app` |

- **Card 1.** *Part de télétravail annuelle* is the product's own term: `HOME_COPY.description`, `HOME_COPY.intro` and `A_PROPOS_COPY.lead` use it. *Trois champs* is SPEC §9.3's three visible fields. *Sans inscription* follows `guides.ts:75`.
- **Card 2.**
  - `{Count}` is the masculine cardinal for `publishedGuides().length`, seven today, replacing the typed *Sept guides* at `index.ts:114`.
  - `{topics}` is the `breadcrumbLabel` of FD11's five topics, first letter lowercased and joined with `frenchList`. The five, in FD11's order:
    - `teletravail-frontalier-40-pourcent`
    - `seuil-social-49-9-pourcent`
    - `jours-de-mission-hors-suisse`
    - `attestation-employeur-teletravail`
    - `droit-option-lamal-cmu`

    Today that renders *le plafond fiscal, le seuil social, les jours de mission, l’attestation employeur et le droit d’option*. The attestation topic restores FD11's fifth: the guide is live, and naming its topic asserts no obligation.
  - The count must be at least five, so *Un guides* cannot occur. Above ten the map falls back to digits.
- **Card 3** is built from three independent clauses, each owned by its flag's capability (R186). A single flag flip changes the string. This is `RELEVE_COPY.stateBody`'s pattern, not an AND-combined getter.

  | Clause | Flag false (today) | Flag true |
  |---|---|---|
  | Availability (`appExists`) | *En préparation pour Android.* | *Disponible sur Android.* |
  | Recording (`trackerExists`) | *Vous y noterez vos journées en un geste, ou elle vous proposera celles qu’elle aura détectées, que vous confirmerez.* | *Enregistrez vos journées en un geste, ou laissez l’application les détecter et vous les proposer.* (FD11) |
  | Export (`dossierExists`) | *Elle exportera un relevé annuel horodaté.* | *Exportez un relevé annuel horodaté.* (FD11) |

  - Manual entry comes first, as in FD11 and `/application`: manual is a peer and the pre-selected default (D19). Detection proposes and the user confirms (D16).
  - Every flag-false clause is in the future tense. `tests/support/present-tense.ts` flags the first draft's *qu’elle détecte*.
  - *Disponible sur Android* and the mixed states (for example, released but not yet recording) are new copy for the user's review.

#### *Pourquoi une trace datée*

| # | Heading | Body | Sources |
|---|---|---|---|
| 01 | *Le seuil se joue sur l’année entière* (FD11) | *Quelques jours de trop en novembre suffisent à modifier douze mois d’imposition. Le calcul ne se fait pas au mois, mais sur l’ensemble de l’année.* | `fiscalCeiling` |
| 02 | *Un relevé reconstitué reste une affirmation.* | FD11: *Un tableau rempli en décembre est une affirmation. Un relevé dont chaque journée porte sa date d’enregistrement est un document.* | — (reasoning about records) |
| 03 | *Une attestation d’employeur ne dit pas toujours tout.* | *Si votre employeur vous remet une attestation de télétravail, votre propre relevé permet de la vérifier et, si elle omet vos jours de mission, d’en tenir compte vous-même.* | `missionCapDays` |

- **01** takes the pillar's own verb, *modifier* (`teletravail-frontalier-40-pourcent.mdx:76-77`), not FD11's *faire basculer*. The consequence depends on the canton's regime.
- **02**'s heading changes because FD11's *"n’est pas une preuve"* makes proof the benchmark on the product's own page. The site never claims proof: `releve-annuel.ts:174` disclaims it. The site's settled contrast is affirmation against document.
- **03**'s heading drops the presupposition that the reader has an attestation, and the claim that it is always incomplete. The attestation guide concedes that a complete one may suffice (`attestation-employeur-teletravail.mdx:65-67`). The body stays conditional because `UNKNOWN_IDS` lists the employer obligation as unsourced. FD11's *certifie* is forbidden vocabulary.

#### Trust band

Each column, in order:

| Column | Eyebrow (`h3`) | Status (`p`) | Body (`p`, Body) | Link (`text` Button) |
|---|---|---|---|---|
| SOURCES | *Sources* | — | *Chaque règle citée figure sur la page des sources, avec l’éditeur de sa source et son état de vérification. Éditeurs cités : {publishers}.* | *Voir les sources* → `/sources` |
| RELECTURE | *Relecture* | `GUIDES_COPY.expertReview`, by key: *Relecture experte : en attente* (Body-M) | *{transcribed} des {total} constantes de ce site ont été relevées sur leur source primaire et {pending} restent à vérifier ; aucune n’a été relue par un professionnel.* | *Où en est la relecture* → `/a-propos` |
| DERNIÈRE VÉRIFICATION | *Dernière vérification* | The date, `p` in `--type-h2-*` tabular | *Cette date est celle du dernier relevé des seuils appliqués par le calculateur ; la page des sources indique, pour chaque règle, la date de son relevé ou qu’il reste à faire.* | *Recevoir les alertes* → `/alertes` |

- **SOURCES.** `{publishers}` is the distinct `SourceEntry.sourceName` values in registry order, joined with `frenchList`: *admin.ch, ge.ch, bsv.admin.ch et CLEISS* today. The registry holds publishers, not instruments (this corrects Section 2). FD11's instrument names would have to be typed (R181). The body no longer says each rule *renvoie à sa source primaire*: two pending rows link to a page that is not their primary source.
- **RELECTURE.** The counts come from `SOURCE_ENTRIES`: 15 transcribed and 2 pending of the 17 that `/sources`' intro also counts (`SOURCE_IDS.length`). A blanket *"transcrites depuis leurs sources primaires"* would be false for the two pending rows. The line is a different sentence from `A_PROPOS_COPY.reviewBody`, which carries that overclaim (§10). It links `/a-propos`, whose heading reads *Personne n’a validé ces règles*. R160 governs the guides' chip, not this column. FD11's *"relus par un professionnel nommé"* and *"Qui a relu"* are false today.
- **DERNIÈRE VÉRIFICATION** is a pure function of `review: string | null`, like `reviewNotice`. It shows `formatDate(review)` and the sentence above, or `SHELL_COPY.reviewPending` and no second sentence when null (R51). `LAST_REGULATORY_REVIEW` (09.09.2026) dates the calculator's thresholds; the CLEISS pass on 16.09.2026 is later, which is why the sentence names its own scope. FD11's *"Les seuils changent chaque année"* has no source and is dropped.

#### Closing strip

*Estimez votre situation en moins d’une minute.*, then `primary` `actions.calculator`, the same key as the hero's primary: FD11's "One CTA, repeated".

#### Meta description

`HOME_COPY.description` is unchanged. **It and the lead remain different sentences** (R206).

### 5.4 Rendering

- `page.tsx` stays a Server Component. It computes, once:
  - `guideScope(currentTaxYear())`
  - `publishedGuides().length` and the five topic labels
  - the publishers
  - the three source counts

  It passes them, with `PRODUCT_STATE` and `LAST_REGULATORY_REVIEW`, into the copy functions. **`lib/fr` imports nothing from `lib/guides` or `lib/content/sources`.** `lib/fr/index.ts` is imported by the client shell, and the guide registry reads `node:fs`.
- `generateMetadata` is unchanged.
- **Stale comments rewritten**, each naming H1 and H5:
  - `page.tsx:3-18` ("A PLACEHOLDER home", "THE TABULAR FIGURE STAYS") and `:49-57`; the JSX comment at `:66-71` goes with the doors
  - `home.module.scss:1-11`
  - `lib/fr/index.ts:36-43` and the `doors` doc comment at `:85-100`
  - `home.spec.ts:2-3`, trimmed to what it still proves: that Inter is served. The FW1 AC1 tabular proof lives at `composants.spec.ts:277`.

### 5.5 FW34 deviations, each with its reason

| Source says | This design | Why |
|---|---|---|
| FD11: hero and *Pourquoi* top padding 96 | `--space-20`, 80 | FD11's own scale stops at 80 |
| FD11: hero column 640 px | `--layout-article`, 680 px | No 640 token; R64 closes the widths at three; 680 is the documented ~70-character measure |
| FD11 / DESIGN-SYSTEM:53: button label 15/600 | Body-M 15/500 (H8) | No 15/600 triple exists; composing one is R70's defect |
| FD11 / DESIGN-SYSTEM:53: text button 40 h | `min-height` 44 (`--size-touch-target-web`) | D40 and DESIGN-SYSTEM:59: every text button here is a tapped link |
| DESIGN-SYSTEM:55: card padding 16 | `Card` defaults to 24, 32 for trust and closing | FD11:20; the component's only consumer is FD11's page |
| FD11: numerals `#D0D5DD` in Display | `text-secondary`, in the H2 triple (H7) | 1.39:1 fails R76; DESIGN-SYSTEM:17 limits Display to statistics |
| FD11: hero secondary *Découvrir l’application* | *Lire les guides* → `/guides` until `appExists` | H2, R172: no offer of an app that does not exist |
| FD11 lead: *doit rester sous*; *Depuis 2026* on both thresholds; no A1 condition | Three scoped sentences (§5.3) | Obligation versus ceiling; date scope; the `socialCeiling` row's own A1 condition; P2 |
| FD11: typed figures | Interpolated | R147, R153 |
| FD11 card 1: *taux annualisé*, *aucun compte* | *part de télétravail annuelle*, *sans inscription* | The product's term; existing wording |
| FD11 card 2: five topics with figures | Derived count, five derived topic names | R153, R181 |
| FD11 card 3: present tense, one block | Three flag-owned clauses, future until each flag | H2, R172, R186, D16, D19 |
| FD11 Pourquoi 01: *faire basculer* | *modifier … d’imposition* | The pillar's verb; the consequence depends on the canton |
| FD11 Pourquoi 02 heading: *n’est pas une preuve* | *reste une affirmation* | The site never claims proof (`releve-annuel.ts:174`) |
| FD11 Pourquoi 03: *L’attestation … ne dit pas tout*; *votre employeur certifie* | *Une attestation … ne dit pas toujours tout*; conditional body | `UNKNOWN_IDS`; the guide's own concession; forbidden vocabulary |
| FD11 SOURCES: instrument names; *renvoie à son texte d’origine* | Derived publishers; *figure sur la page des sources* | The registry holds publishers; two pending rows |
| FD11 RELECTURE: a named professional | `expertReview` plus derived counts | R160; no reviewer exists; two rows pending |
| FD11 date *15.01.2027*; *Les seuils changent chaque année* | `LAST_REGULATORY_REVIEW`, a scoped sentence, a null branch | R51; no source for an annual change |

### 5.6 Scope additions in FW34, for the user's review

- **`APPLICATION_COPY.description`'s release branch** (`application.ts:93-96`) reads *"Enregistrez vos journées et exportez un relevé daté"* on `appExists` alone. That is the same defect card 3 had: recording belongs to `trackerExists` and export to `dossierExists`.
  - The new claim patterns (§7.2 item 2), tagged by their true capability, find it on their first run. That is a live instance (R178).
  - FW34 recomposes that one branch per flag and wires it. The branch does not render today, so no baseline changes.
  - The alternatives are to tag the patterns `appExists`, which is wrong about what they detect, or to exempt `application.ts`, which is dishonest. Both are rejected.
- **The cardinal map and `frenchList`** move into the shared helper module (§5.3). Their current consumers render character for character the same.

---

## 6. Rulings this design leans on

R51, R62, R64, R66, R68, R70, R71, R76, R85, R88, R89, R91, R126, R127, R133, R135, R147, R153, R154, R155, R160, R165, R172, R175, R176, R177, R178, R180, R181, R186, R206, R207, R267, R268; D16, D19, D35, D40; SPEC §9.2, §9.3, §20. Where this document and a ruling disagree, the ruling wins, and the disagreement is raised rather than resolved in code.

---

## 7. Tests

Every new guard is written first. Each report shows its RED run and the reason. A check expected to pass on its first run is labelled a **regression pin** and says so (R133).

### 7.1 FW33 (shell)

1. **Measured on the desktop shell** (Playwright):
   - The nav's right edge meets the bar's content edge, and its left edge is well clear of the wordmark. RED: today it sits 12 px after it.
   - Nav items are 32 px apart. RED: 20.
   - The nav colour stays `text-primary` (H7). **Regression pin.**
   - The lone-child entry is a link named *Calculateur de télétravail*. RED: a button today.
   - The footer has four equal columns on desktop and two below the breakpoint. RED.
   - *Alertes e-mail*, *À propos* and the seven guide links (H10) are present in their columns and answer 200. RED: absent.
   - *Sources* sits under *Le produit*. RED.
   - The bar (`header > div`) is 64 px. **Regression pin**: already true. The `<header>` box is 65 px because of its 1 px rule.
2. **The collapse function, both directions** (unit), using synthetic entries as `regulatory-gate.test.ts:209-214` does, so no signature change is needed:
   - one live child plus one planned child → a link with the child's label and href
   - two live children (`/calculateur-teletravail-frontalier` and `/guides`) → a disclosure
   - no live children → absent
3. **The disclosure keeps its proof.** `NavItem` is exported, or moved to its own file, and rendered directly with a synthetic two-live-child entry. The four disclosure behaviours move onto that render: `aria-expanded`, expand, children only when open, and Escape returning focus to the trigger. It also asserts that the chevron is present, `aria-hidden`, and inside the button. No test prop is added to `PublicShell`, which would give production a second nav channel.
4. **CTA positioning** (structural, on `PublicShell.module.scss`, as `PublicShell.test.tsx` already asserts stylesheet content):
   - base rule: `.cta` has `margin-left: auto`
   - inside the md query: `.nav` has `margin-left: auto` and `.cta` has `margin-left: 0`

   The CTA cannot render while `appExists` is false, so the pixels cannot be tested yet.
5. **Stroke:** the chevron passes `strokeWidth` 1.75.
6. **Gallery:** `/dev/composants` gains a specimen of the two-child `NavItem`, open and closed. Its baselines are new files (§8).
7. **Size:** `pnpm size` runs explicitly, and the calculator and home figures are recorded (§4.3).

### 7.2 FW34 (home body)

1. **State wiring (R172, R186).** `product-state.test.ts` `WIRING` gains:

   | Flag | Rows |
   |---|---|
   | `appExists` | the hero secondary action (label and href joined), card 3 |
   | `trackerExists` | lead sentence 3, card 3 |
   | `dossierExists` | card 3 |
   | per §5.6 | `APPLICATION_COPY.description`, under the flags its recomposed branch reads |

   `appExists` leaves `NOT_YET_WIRED`, and "accounts for every flag" enforces it. RED: the rows reference getters that do not exist.
2. **Claim patterns, tagged by capability** (`tests/support/product-claims.ts`):
   - `enregistrez vos journées` → `trackerExists`
   - `laissez l’application les détecter` → `trackerExists`
   - `exportez un relevé` → `dossierExists`

   Exact stems (`exportez`, not `export\w*`), each short enough to sit inside one source literal, because `scanFr` reads per line. They are proven three ways:
   - The repo's self-test literals go in `PRODUCED_THE_RULE` / `MUST_NOT_FLAG`, by that file's own convention.
   - `claimsIn` runs on card 3's getter rendered in both states: it fires with every flag true and is silent in the shipped state.
   - A source-level assertion runs on the **unfiltered** scan. It must report hits in `index.ts` and `application.ts`, the live instances (R178), which the wiring then permits.
3. **Present tense on the served page.** `home.spec.ts` asserts the precondition `PRODUCT_STATE.appExists === false`, reads the `cards` band's text, requires card 3's body to be present, then requires `presentTenseClaimsIn(...)` to be empty, with a non-vacuity sample. The shape is `application.spec.ts:163-192`'s. RED: the band does not exist.
4. **Vocabulary on the served page.** The existing guard reads only `<head>`s, `/cgu` and `/releve-annuel`, not `/`. `home.spec.ts` reads `main`'s text, establishes presence (the lead is there), and requires `complianceClaims(text)` to be empty, plus a non-vacuity line as in `sources.spec.ts:325`.
5. **Every interpolation delivered (R154)**, scoped per band:
   - the H1 contains `fiscal`
   - the lead contains `fiscal`, `social` and `a1Threshold`
   - card 1 contains `fiscal` and `social`
   - card 2 contains the count word and the five topic labels
   - trust: the date equals `formatDate(LAST_REGULATORY_REVIEW)`, compared by `textContent` codepoint for codepoint (R71)
   - trust: the publishers equal the distinct `sourceName` values
   - trust: the three counts equal the registry's

   Each figure also contains a digit. The trust-date function is unit-tested on both branches (a date, and `null`).
6. **Derived counts and topics.** Card 2's getter called with eight guides changes its word. `publishedGuides().length >= 5`. The topic labels equal the five guides' `breadcrumbLabel`s.
7. **Sources, and the date tripwire.** Every regulatory block's `SourceId[]` is non-empty: lead 1, lead 2, card 1, *Pourquoi* 01 and 03. A tripwire fails if `ruleSetFor(currentTaxYear()).fiscalCeiling` differs from `ruleSetFor(2026).fiscalCeiling`. Its message names both sentences that pair the typed date with `{fiscal}`: this lead and the pillar's opener.
8. **Lead ≠ meta description (R206).** Neither contains the other.
9. **Components.** `accessibility.test.tsx`'s table gains every state:
   - `Button`: four variants, as a link and as a button
   - `Card`: default and padding 32
   - `IconTile`

   Its `toHaveLength` and `NAMES` update to match. `/dev/composants` gains a section for each.
10. **D40, measured per band:**
    - the hero primary is 56 px, the secondary 48
    - the closing primary is 48
    - every `text` link is at least 44
11. **Reachability (R175).** Every internal `main a[href]` on `/` is registered, `live`, and answers 200. The non-vacuity floor is 9 body links: hero 2, cards 3, trust 3, closing 1. RED: today's `main` has 2.
12. **Mobile, below the breakpoint.** The hero actions are full width and stacked, the cards are in one column, and the trust band's rules are horizontal. RED: none of these bands exist yet.
13. **Size:** `pnpm size`. The home body adds no client JS; figures recorded.

### 7.3 Existing tests that change, deliberately

| Test | Change |
|---|---|
| `PublicShell.test.tsx:151-159` | The lone-child link now carries the child's label |
| `PublicShell.test.tsx:161-179` | "links every leaf" clicks only entries that still render as disclosures |
| `PublicShell.test.tsx:240-287` | The four disclosure tests move onto the direct `NavItem` render (§7.1 item 3) |
| footer tests in `PublicShell.test.tsx` and the registry test | The new links and the moved *Sources* |
| `e2e/home.spec.ts` heading test | `HOME_COPY.heading` becomes a function |
| `product-state.test.ts` | `WIRING` / `NOT_YET_WIRED` (§7.2 item 1) |
| `tests/unit/tokens/contrast.test.ts` nested-rule list | The two `(public)/home .door` entries go; each nested rule `home.module.scss` produces is added by name with a reason |
| `tests/unit/fr/copy-codepoints.test.ts` (R66) | `index.ts`'s literal U+00A0 count falls by the literals that leave (the heading's, and the deleted intro's). The total moves in step, with the reason in the comment |
| `lib/ui/react/accessibility.test.tsx` | New states, length and `NAMES` |

These stay green unchanged:
- the 44 px panel links (`composants.spec.ts:191-209`)
- the footer review date and the single `h1` (`home.spec.ts`)
- the CTA gating
- `regulatory-gate.test.ts:195-205`
- 320 px coverage of `/` (`guides-narrow.spec.ts:34`, both tests; `composants.spec.ts:222-225`)
- 360 px coverage (`narrow.spec.ts`)
- the assembled-page heading-order test
- R147, R155, R126, R91 and R188 over `lib/fr`

If rewriting tests lowers a count pinned in `scripts/suite-floor.json`, the report says so.

---

## 8. Baselines (R207, R135)

`pnpm test:visual:update` cannot take an expected set or stop part way: it writes every differing baseline, then prints the list. The procedure is therefore:

1. Before regenerating, run `pnpm test:visual` in compare mode. Read the failures from the run's tally and file list, not from retry markers, and compare them file for file with the enumerated set. Any extra stops the task before anything is written.
2. Run `pnpm test:visual:update`, and compare its printed list file for file with the set. Any extra is undone before the commit and investigated: `git checkout --` a tracked baseline, delete an untracked new one.
3. Crop every regenerated image and look at it, including below the fold (R178).

The sets:
- **FW33: 69 regenerated.** 28 `page-*`, 14 `guides-*` and 24 `calculateur-*`, all full-page captures that include the shell, plus 3 `composants-shell-*`. Reason: *shell — nav alignment and spacing; lone Calculateurs child rendered as a link; footer grid, added live links, Sources moved.* No caret appears in any of them. **New:** the two-child `NavItem` specimen (§7.1 item 6). The plan enumerates every name.
- **FW34: 2 regenerated**, `page-accueil-desktop.png` and `page-accueil-mobile.png`. Reason: *home body replaced per FD11.* **New:** the `Button`, `Card` and `IconTile` gallery specimens. Gallery specimens are flex items in per-section rows, so adding sections leaves the existing `composants-*` crops unchanged.

---

## 9. Execution

- **Two sessions, one task each.** FW33 first, then FW34, each ending with `REPORT-FW33.txt` / `REPORT-FW34.txt`. The IDs follow the highest relay (`relay/FW32.txt`); the user may renumber. H7–H10 settle every decision verification raised; nothing blocks FW33.
- **The gate.** `pnpm gate:changed` runs per commit, and its printed selection goes in the commit body.
  - A change under `app/**` or `lib/ui/**` selects `typecheck`, `lint`, `test`, `build`, `test:e2e`, `test:visual` and `test:late`.
  - `test:db` is selected when a changed file is in its import closure, computed from the working tree at gate time. Today that includes `lib/fr/index.ts`, `lib/fr/shell.ts`, `lib/content/routes.ts` and `lib/ui/react/index.ts`, plus anything they import. Other `lib/fr` files select only the browser suites.
  - The printed selection is authoritative.
  - `pnpm gate:clone` runs before every push.
- **Walkthrough (R176, R177)** against `pnpm dev` at 1440 px and 360 px. Read every band against `home.png` and FD11, follow every link, and record it in the report's WALKTHROUGH section.
- **Shared tree.** Another session works in `android/` on `main`, and `gate:clone` clones HEAD. Before either slice's gates run, the tree is confirmed quiet; if it is not, the user decides when to proceed. Only the slice's own files are staged.
- **Deployment** to Coolify happens only when the user asks.

---

## 10. Noticed, not touching

These were found during verification and are outside FW33 and FW34. Each goes into the relevant report's *NOTICED BUT NOT TOUCHING*.

- `A_PROPOS_COPY.reviewBody` (`a-propos.ts:79-81`) says every rule was *"transcrites depuis leurs sources primaires"*. That is false for the two pending rows.
- `/sources`' intro (`lib/fr/sources.ts:92-94`) presents the footer date as the date of a register that also holds 16.09.2026 rows.
- `/sources`' *Source primaire* column labels `ge.ch` for the two pending rows, whose primary texts (circulaire n° 45, the 1983-accord amicable agreement) have not been read.
- The pillar's opener (`teletravail-frontalier-40-pourcent.mdx:71-72`) pairs the typed *1er janvier 2026* with `{fiscal}`. The §7.2 item 7 tripwire names it.
- The header CTA *Suivre mes jours* (`PublicShell.tsx:147`) asserts tracking but is gated on `appExists` alone. That is inherited, and noted for the release task.
- The footer's *Le plafond fiscal* (`shell.ts:147`) is a typed copy of that guide's `breadcrumbLabel`.
- `shell.ts:91` and `:127` type *Calculateur de télétravail* twice.
- `application.ts` and `guides.ts` each define a private `n()`.
- `PublicShell`'s `Menu` and `X` icons omit `strokeWidth` 1.75, so they ship at stroke 2.

## 11. Open items outside this design

- `web/Dockerfile`'s `CHROMIUM_VERSION` pins 153, which Debian no longer serves. Coolify builds with a build-arg override of `154.0.8037.57-1~deb12u1`; bump the file in its own commit.
- The Coolify API token used for deployment is to be rotated by the user, and the Coolify dashboard is still HTTP only.
- PARK31-6: `User.name` is settable by no route, so the PDF returns 422 `titulaire_missing`.
