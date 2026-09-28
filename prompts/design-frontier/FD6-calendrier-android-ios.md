# FD6 — Écran « Calendrier » (app, Android 360 dp + iOS 390 pt)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the calendar screen of a signed-in mobile app for cross-border workers living in France and employed in Switzerland. The app records where the user worked each day and produces an annual tax document from that record.

This screen is where the user reviews the month, completes missing days, and corrects entries. Its job is to make the **quality of the record** visible — not just where the user worked, but whether each day was recorded in time, and whether it was detected, confirmed, or corrected.

Deliver **four frames in a 2 × 2 grid**, 48 px apart, on a `#F7F8FA` canvas:

- **Top row — Android, 360 × 800 dp:** `A1 — LE MOIS` · `A2 — FEUILLE D'ÉDITION`
- **Bottom row — iOS, 390 × 844 pt:** `I1 — LE MOIS` · `I2 — FEUILLE D'ÉDITION`

Captions above each frame in Caption 13 / 18 `#98A2B3`, uppercase, tracking 0.04 em. Same content in both rows; only platform chrome differs.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; **tabular numerals** for every day number, count, date and time.
- **Type:** H2 24 / 32 700 · H3 20 / 28 600 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18 · Micro 11 / 14 500. Day numbers **14 / 500**.
- **Spacing:** 4 · 8 · 12 · 16 · 20 · 24 · 32. **Side padding 20** → content 320 dp / 350 pt.
- **Radius — tokens only:** buttons 12 · large primary 14 · badge 8 · card 16 · **bottom sheet 24 top corners** · chips and bars 999 · day cells 8.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` / disabled `#C4C8D0` · Border `#E4E7EC` · strong `#D0D5DD` · Brand `#173B63` · **France `#315FA8`** · **Switzerland `#D84B4B`** · Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC`. Warning **text** is `#111827` on `#FFF7E6`.
- **Icons:** Lucide, 1.75 px stroke.
- **Buttons:** large primary 56 h radius 14 · secondary 48 h radius 12 white fill 1 px border · text button 40 h brand. Targets ≥ 48 dp / 44 pt.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 16, no shadow.
- **Bottom sheet:** radius 24 top corners, white, **36 × 4 px drag indicator** `#D0D5DD` radius 999 centred 8 px from the top, padding 20, options ≥ 52 px tall, scrim `#111827` at 40 %.
- **Bottom navigation:** 4 items, active brand, inactive `#667085`; Android 80 dp incl. gesture bar, iOS 49 pt + 34 pt.
- **Status is never colour alone.** French copy throughout.
- **Never draw:** a map, a pin, a route, a flag emoji, an avatar, a bell, a streak, a completion ring, a "% du mois rempli" meter, a shadow on a card.

## Platform chrome

**Android:** status bar on the canvas, dark icons; no app bar — the month navigation is the top of the content; gesture bar inside the 80 dp navigation. Sheet opens over the scrim with the drag indicator.
**iOS:** status bar with Dynamic Island; no navigation bar; tab bar 49 pt + home indicator 34 pt. Sheet is a standard iOS sheet with the same 24 pt corners and grabber.

---

## Frames A1 / I1 — LE MOIS

### 1. Month navigation — 16 below the safe area, 48 tall

Lucide `chevron-left` 24 `#111827` in a 48 × 48 tap area at the left; centred H3 20 / 28 600 **Juin 2027**; `chevron-right` at the right. No year picker, no "aujourd'hui" shortcut.

### 2. The calendar card — 12 below. White, radius 16, padding 12.

**Weekday header:** seven columns, Caption 13 / 18 `#98A2B3`, centred, French week from Monday: `L M M J V S D`.

**Grid:** 7 columns × 5 rows. Cells **44 wide × 56 tall** (Android) / 46 × 58 (iOS), 2 px gutters, each cell radius 8. June 2027 begins on a Tuesday: row 1 is 31 (May) then 1–6; the last row is 28–30 then 1–4 (July).

**How a cell is built** — four layers, the heart of the screen:

1. **Day number**, top-left, 6 px inset, 14 / 500 tabular `#111827`.
2. **Kind**, centred in the lower half of the cell: a **6 px country dot** followed by a **letter** in Micro 11 / 14 500 `#111827`, 3 px apart:
   - `S` with a `#D84B4B` dot — journée en Suisse
   - `D` with a `#315FA8` dot — journée à domicile
   - `M` with a `#98A2B3` dot — mission
   - `A` with a `#C4C8D0` dot — absence
   - nothing when the day is not recorded
3. **A 3 px bar along the bottom edge of the cell, inset 6 px each side, radius 999 — this encodes record quality, not kind:**
   - `#15803D` — enregistrée à temps
   - `#B7791F` — saisie tardive (recorded more than 7 days after the day)
   - `#D0D5DD`, and the cell fill becomes `#F7F8FA` — jour ouvré non renseigné
   - no bar — weekend, jour férié, or future day
4. **Corrected day** — the detection was overridden by the user: a **4 px `#111827` dot** in the top-right corner of the cell.

Colour means *record quality*; the letter + dot mean *where*. Do not swap them and do not add a second colour dimension.

**Cell states to draw, exactly:**

- Out-of-month (31 May; 1–4 July): day number `#C4C8D0`, nothing else.
- Weekends (5, 6, 12, 13, 19, 20, 26, 27): day number `#98A2B3`, nothing else.
- `S` green bar: 1, 2, 8, 11, 14, 15, 18
- `D` green bar: 4, 10, 17
- `D` **amber** bar **and** the corner dot: **3**
- `M` green bar: 9
- `A` green bar (jour férié): **7**
- Grey bar, `#F7F8FA` fill, no letter: **16**
- **Today is 18**: cell fill `#EDF4FF`, day number weight 600 brand `#173B63`, plus its letter and bar.
- 21–30: future weekdays — day number `#111827`, nothing else.

### 3. Legend — inside the same card, 12 below the grid, 1 px `#E4E7EC` rule above, two columns, Caption 13 / 18 `#667085`

Left column (dot + letter samples): `● S` Suisse · `● D` Domicile · `● M` Mission · `● A` Absence
Right column (16 × 3 bar samples): green *À temps* · amber *Saisie tardive* · grey *Non renseigné*
One line below both, with the corner-dot sample: *Détection corrigée par vous*

### 4. Month summary — 16 below the card, a row of four figures, no card

Each: Caption 13 / 18 `#667085` above, H3 20 / 28 600 tabular `#111827` below, separated by 1 px `#E4E7EC` vertical rules:
`Suisse` **7** · `Domicile` **4** · `Mission` **1** · `Non renseigné` **1**

(*Absence* is not counted here — it is not a working-day figure.)

### 5. Missing-day banner — 16 below

Full width, radius 12, `#FFF7E6` fill, 4 px `#B7791F` accent bar inside the left edge, 16 padding, Lucide `calendar-x` 20 `#B7791F`: Body-M 15 / 500 `#111827` **1 jour ouvré non renseigné en juin**, then a text link Body-M brand with `arrow-right` 16: `Compléter le 16 juin`

### 6. Bottom navigation

Lucide 24: `sun` Aujourd'hui · `calendar` **Calendrier** (active, brand, label 600) · `file-text` Relevé · `settings` Paramètres.

---

## Frames A2 / I2 — FEUILLE D'ÉDITION

The month behind a 40 % scrim; a bottom sheet open on **jeudi 3 juin 2027** — the late, corrected entry. Sheet: radius 24 top, white, drag indicator, padding 20, rising to about 80 % of the screen.

Contents, top to bottom:

1. H3 20 / 28 600 `#111827`: **Jeudi 3 juin 2027**
   Beneath, a **badge**: 24 h, radius 8, `#FFF7E6` fill, Caption 13 / 18 500 `#111827`, Lucide `clock` 14 `#B7791F`: `Saisie tardive`

2. Body-M 15 / 500 `#111827`, 20 below: **Où avez-vous travaillé ?**
   Four option rows, full width, **52 tall**, radius 12, 8 apart, each with a 6 px country dot, a label Body 15 / 22 `#111827`, and a radio at the right (22 px, 44 × 44 target):
   - `En Suisse` — dot `#D84B4B`
   - `Domicile` — dot `#315FA8` — **selected**: 2 px `#173B63` border, radio filled
   - `Mission` — dot `#98A2B3`
   - `Absence` — dot `#C4C8D0`
   Unselected rows: white fill, 1 px `#E4E7EC` border.

3. Note field, 16 below: label Caption 13 / 500 `#111827` *Note (facultatif)*, input 48 h radius 12 containing *Réunion annulée, journée à domicile*.

4. **Provenance**, 20 below — 1 px `#E4E7EC` rule, then a heading Caption 13 / 18 500 `#667085` uppercase **ORIGINE DE LA SAISIE**, then three lines Caption 13 / 18 `#667085`, timestamps tabular:
   - *Détecté automatiquement : En Suisse*
   - *Corrigé par vous en Domicile le 15.06.2027 à 21:08*
   - *Première saisie enregistrée le 15.06.2027 à 21:08*

5. **Base de la détection**, 16 below — heading Caption 13 / 18 500 `#667085` uppercase **BASE DE LA DÉTECTION**, then three lines Caption 13 / 18 `#667085`, figures tabular, and on the right of the third line the confidence tier — Lucide `shield-check` 14 `#15803D` + Micro 11 / 14 500 `#111827` *Détection fiable* + three 16 × 4 px pill segments filled `#15803D`:
   - *38 relevés, dont 2 à moins de 150 m de la frontière (ignorés)*
   - *7 h 52 en France · 0 h 14 en Suisse*
   - *Fiabilité de la détection*

   No map, no coordinates, no place names, no percentage.

6. **Late-entry notice**, 16 below — banner radius 12, `#FFF7E6`, 4 px `#B7791F` accent inside the left edge, 16 padding, Lucide `clock` 20 `#B7791F`: Body-M 15 / 500 `#111827` **Saisie tardive** — Body 15 / 22 `#111827` *enregistrée 12 jours après la journée concernée. Cette mention figure dans votre relevé annuel.*

7. Actions pinned at the sheet's bottom, stacked 8 apart, full width: **large primary 56 h radius 14** `Enregistrer` · **secondary 48 h radius 12** `Annuler`.

---

## Rules for this screen

- **The late flag is never hidden.** It is on the cell, as a badge under the sheet title, and in the notice that says it will appear in the annual document. Never softened, never behind an info icon.
- **Provenance is plain text.** Both the detection and the correction are shown; the original timestamp never disappears when a day is corrected.
- **The grid is never replaced** by a summary, a list, or an illustration. It is the interface.
- **Colour is never the only signal.** Kind = dot + letter, quality = bar + legend, correction = corner dot + provenance text.
- **No gamification.** No streak line, no completion ring, no "mois complet" celebration.
- **Brand blue** appears only on today's cell, the selected option row, the link in the banner, `Enregistrer`, the iOS grabber-adjacent controls if any, and the active tab.
- French only, copy exactly as written. Swiss dot dates, 24-hour times, tabular numerals.

Deliver one high-fidelity static sheet with the four frames in a 2 × 2 grid.
