# D4b — « Aujourd'hui » en mode automatique (Android, 375 dp)

Paste everything below into Claude Design as a single prompt.

---

> **Design system: Frontier Work v1.0 (03.09.2026).** This prompt was converted from Carbon. Tokens are in the block below; product rules unchanged.

> **Addendum v2.1 (02.09.2026).** In ÉTAT B, the proposal card gains a fourth line under the detection window, 12 / 16, `#111827`, with a small filled 8 dp dot on its left in `#15803D` for the reliable case: *Détection fiable* — or, for the uncertain case, the dot in `#B7791F` and the text *Détection incertaine — vérifiez*. The tier is stated in words; the coloured dot is confirmation only. Nothing about the actions changes: `Confirmer` is still required whatever the tier. In ÉTAT A, add beneath `Saisir maintenant` a second text button: `Déclarer une absence`.

Design the home screen of a signed-in **Android** app for cross-border workers living in France and employed in Switzerland. The app records where the user worked each day and produces an annual tax document from that record. Viewport 375 dp wide.

The app has two logging modes, chosen by the user in settings:

- **Mode automatique** — the phone detects, from location, whether the working day was spent in Switzerland or at home in France, and **proposes** the day. The user confirms or corrects it. The app never records a day on its own.
- **Mode manuel** — the user taps the day in themselves.

This screen shows **mode automatique**. Deliver **three frames side by side**, 48 dp apart, each 375 dp wide, on a `#F7F8FA` canvas. Above each, a caption in Caption 13 / 18 secondary gray: `ÉTAT A — DÉTECTION EN COURS`, `ÉTAT B — À CONFIRMER`, `ÉTAT C — CONFIRMÉ`.

## Design system — Frontier Work v1.0 (frontalier adaptation). Non-negotiable.

Personality: trustworthy, calm, precise, private, minimal. Reference: Apple + Linear + Stripe Dashboard. Never GPS-tracker aesthetics, never gamification, no neon, no heavy shadows, no large illustrations, no flag emoji.

- **Font: Inter** everywhere. Every figure, percentage, date and timestamp uses **Inter with tabular numerals** so columns align.
- **Type:** Display 48 / 56 weight 600 (large statistics only) · H1 32 / 40 700 · H2 24 / 32 700 · H3 20 / 28 600 · Body-L 17 / 26 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18 · Micro 11 / 14 500 (sparingly). Weights 400 / 500 / 600 / 700 only.
- **Spacing:** 4 px base — 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64. Mobile horizontal padding **20**. Desktop padding 32, content max 1440.
- **Radius — tokens only:** buttons 12 · large primary button 14 · inputs 12 · small badge 8 · card 16 · large status card 20 · bottom sheet 24 (top) · chips, progress and confidence bars 999. Nothing else is rounded, and nothing is more rounded than its token.
- **Colour — exactly these:**
  - Canvas `#F7F8FA` · Surface / card `#FFFFFF`
  - Text primary `#111827` · secondary `#667085` · tertiary `#98A2B3` · disabled `#C4C8D0`
  - Border `#E4E7EC` · strong `#D0D5DD`
  - Brand (Deep Alpine Blue) `#173B63` — primary CTA, active nav, links, selected states; not everywhere
  - France `#315FA8` (soft `#EAF1FB`) · Switzerland `#D84B4B` (soft `#FCECEC`) — 6–8 px dots and chips only, never flags
  - Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC` · Info `#2563EB` on `#EDF4FF`
  - Warning colour is for accents, icons and the rail band; warning **text** is `#111827` on `#FFF7E6`.
- **Icons:** Lucide, 1.75 px stroke, 20 px (16 small, 24 large). Never mix filled and outlined at random.
- **Buttons:** primary 48 h, radius 12, brand fill, white 15 / 600 label · large primary 56 h, radius 14 · secondary 48 h, radius 12, white fill, 1 px `#E4E7EC` border, `#111827` label · destructive 48 h, radius 12, error fill · text button 40 h, brand colour · icon button 44 × 44, radius 12.
- **Inputs:** 48 h, radius 12, 1 px border, 14 px padding, label 13 / 500 six px above; focus 2 px brand border.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 16, **no shadow**. Status card radius 20, padding 24.
- **Bottom sheet:** radius 24 top corners, 36 × 4 px drag indicator centred, options ≥ 52 px.
- **Bottom navigation:** 4 items, 80 px including safe area, 24 px icons, 11–12 px labels, active = brand colour, inactive `#667085`. No oversized pill.
- **Progress / rail:** 8 px tall, radius 999 — never taller. Confidence indicator: words + icon + 3 segments, **no percentage**.
- **Skeletons** radius 8 — never a page spinner. **Offline banner** 36 px. Toast radius 12, only for settings feedback.
- **Touch targets:** ≥ 44 px (web), ≥ 48 dp (Android). Primary confirm actions 56.
- **Status is never colour alone:** colour + icon + text, always. WCAG AA. French copy throughout.
- **Never draw:** a map, a pin, a route, a live location dot, a movement timeline, a flag emoji, an avatar, a notification bell, or a confidence percentage.


## Frame structure, top to bottom (identical in all three frames unless stated)

### 1. App bar — 56 dp, background `#FFFFFF`, 1 px `#E4E7EC` bottom border

Product wordmark in `#111827`, 14 dp weight 600, left-aligned at the 16 dp gutter. Nothing else — no hamburger, no overflow menu, no avatar.

### 2. Mode strip — full width, 40 dp tall, `#FFFFFF`, 1 dp bottom rule `#E4E7EC`

On one line, 16 dp gutters: a small filled location icon in `#667085`, then 12 / 16 secondary gray text *Mode automatique*, then pushed to the right edge a brand `#173B63` 12 / 16 text link `Changer`.

This strip is always visible. The user must be able to see at a glance which mode is recording their days.

### 3. Date line — 24 dp top margin, 14 / 18 secondary gray: *Vendredi 18 juin 2027*

### 4. The answer block — 16 dp below

- Hero, Inter tabular 32 / 40, green `#15803D`: **18,33 %**
- Under it, 12 / 16 secondary gray: *Taux à déclarer à l'AFC*
- 16 dp below, 16 / 24: **52 jours** de télétravail restants avant 40 % — `52 jours` in Inter tabular weight 600, the rest in Inter regular.
- Under that, 14 / 18 secondary gray: *75,5 jours avant le seuil social de 49,9 %*

### 5. Threshold rail — 24 dp above and below, 335 dp wide, 24 dp tall

Track `#E4E7EC`; filled from 0 to 18,33 % of the width in green `#15803D`; two vertical tick marks in `#111827` crossing the full bar height at 40 % and 49,9 % of the width; tick labels below in 12 / 16 tabular, `40 %` and `49,9 %`, left-aligned under their ticks. No zone labels above the bar at this width.

### 6. Unlogged-days strip — full width, 16 dp padding, `#FFFFFF`, 4 dp `#B7791F` left border

- 14 / 18 in `#111827`: **3 jours non confirmés**
- Below, blue 14 / 18 link: `Compléter dans le calendrier →`

Inline only. Never a dialog, never an overlay, never blocking.

### 7. The log block — 32 dp below. **The only part that differs between frames.**

### 8. Bottom navigation — fixed to the bottom, 56 dp, white, 1 dp `#E4E7EC` top rule

Four equal items, line icon 20 dp above a 12 / 16 label: `Aujourd'hui` · `Calendrier` · `Relevé` · `Paramètres`.
Active item **Aujourd'hui**: icon and label `#173B63`, label weight 600, and a 2 dp `#173B63` bar along the top edge of that item. Others `#667085` regular. Active item in brand colour, others `#667085`. Exactly four items.

---

## ÉTAT A — DÉTECTION EN COURS

The working day is not over; the app has nothing to propose yet.

- Section label 14 / 20 weight 600: **Journée en cours**
- A quiet strip, `#FFFFFF`, 1 dp `#E4E7EC` border, radius 12, 16 dp padding (grey, not colored — nothing has happened yet):
  - 14 / 18 in `#111827`: *Détection en cours. Votre journée vous sera proposée ce soir.*
  - Below, 12 / 16 secondary gray: *Vous pourrez la confirmer ou la corriger.*
- Below the strip, 16 dp down, a text button, brand `#173B63`, 14 / 18, 48 dp tap height, left-aligned: `Saisir maintenant`

No spinner, no progress bar, no animated pulse. Detection is a background fact, not a performance.

---

## ÉTAT B — À CONFIRMER (l'écran central du mode automatique)

The day has ended and the app has a proposal.

- Section label 14 / 20 weight 600: **Journée détectée**
- A proposal card — the status card: `#FFFFFF`, 1 dp `#E4E7EC` border, **radius 20, 24 dp padding**:
  - First line, 20 / 28 in `#111827` weight 600, with an 8 dp France-blue `#315FA8` dot on the left: **Domicile**
  - Second line, 14 / 18 secondary gray: *Vous êtes resté en France pendant vos heures de travail.*
  - Third line, 12 / 16 secondary gray, timestamps in Inter tabular: *Détecté le 18.06.2027 entre 08:12 et 17:04*
- Below the card, 16 dp down, two actions stacked full width, 8 dp apart:
  - `Confirmer` — primary brand `#173B63`, white label, **56 dp tall**
  - `Corriger` — secondary style: `#FFFFFF` fill, 1 dp `#E4E7EC` border, `#111827` label, 48 dp tall
- Under the actions, 12 / 16 secondary gray: *Rien n'est enregistré tant que vous n'avez pas confirmé.*

That last line is a promise the product keeps, so give it room — it is not fine print.

---

## ÉTAT C — CONFIRMÉ

The three-line proposal is replaced by a confirmation row: `#FFFFFF`, 1 dp `#E4E7EC` border, radius 12, 16 dp padding, 4 dp `#15803D` left accent.

- First line, 16 / 24 in `#111827`, filled green checkmark icon on the left: **Domicile** — *enregistré*
- Second line, 12 / 16 secondary gray, timestamp in Inter tabular: *Enregistré le 18.06.2027 à 18:03*
- Third line, 12 / 16 secondary gray: *Détecté automatiquement, confirmé par vous.*
- On the right of the row, vertically centered, secondary blue text button 14 / 18, 48 dp tap height: `Modifier`

The third line is the provenance of the record and appears wherever this entry is shown, including the annual document. It is never abbreviated to an icon.

---

## Rules for this screen

- **The app never records a day by itself.** No "enregistré automatiquement", no auto-confirm timer, no silent write. Every state must make clear that the user's tap is what creates the record.
- **Manual mode is an equal, not a fallback.** Nothing on this screen may suggest automatic mode is the correct or premium choice — no "recommandé" tag, no upsell, no warning for users in manual mode.
- **No map, ever.** Do not draw a map, a pin, a route, a trace, or a location history. The app shows a conclusion — *Domicile* or *En Suisse* — not the movements behind it.
- **Four screens is the whole app.** No fifth tab, no settings gear in the app bar, no notification bell, no avatar.
- **No gamification.** No streaks, no badges, no celebration state, no progress ring. Logging a tax record is not an achievement.
- No dialogs on this screen. No onboarding, no coach marks, no tooltips.
- Frontier, not Material: radius 12 everywhere, no FAB, no elevation, no pill-shaped navigation indicator.
- French only, copy exactly as written. Numbers French convention (comma decimal, non-breaking space before `%`); dates Swiss dot notation.
- Status is never color alone — the green confirmation row carries its checkmark and the word *enregistré*.

Deliver one high-fidelity static sheet with the three frames side by side.
