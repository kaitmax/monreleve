# FD4 — Écran « Aujourd'hui » (app, Android 360 dp + iOS 390 pt)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the home screen of a signed-in mobile app for cross-border workers living in France and employed in Switzerland. The app records where the user worked each day and produces an annual tax document from that record. It has two logging modes, chosen by the user: **saisie manuelle** (the user taps in the day) and **détection automatique** (the phone detects the day and **proposes** it in the evening; the user confirms or corrects — the app never records a day by itself).

This is the screen opened two hundred times a year, one-handed, often on a train. It must answer *combien de jours me reste-t-il ?* in under a second and let the user log today in one tap.

Deliver **six frames in a 3 × 2 grid**, 48 px apart, on a `#F7F8FA` canvas:

- **Top row — Android, 360 × 800 dp:** `A1 — MANUEL, AVANT SAISIE` · `A2 — AUTO, À CONFIRMER` · `A3 — CONFIRMÉ`
- **Bottom row — iOS, 390 × 844 pt:** `I1 — MANUEL, AVANT SAISIE` · `I2 — AUTO, À CONFIRMER` · `I3 — CONFIRMÉ`

Captions above each frame in Caption 13 / 18 `#98A2B3`, uppercase, tracking 0.04 em. The two rows show the **same content**; only platform chrome differs.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter** on both platforms; **tabular numerals** for every figure, date and time.
- **Type:** Display 48 / 56 600 (the hero only) · H2 24 / 32 700 · H3 20 / 28 600 · Body-L 17 / 26 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18 · Micro 11 / 14 500.
- **Spacing:** 4 base — 4 · 8 · 12 · 16 · 20 · 24 · 32. **Side padding 20**, so content is 320 dp (Android) / 350 pt (iOS). Bottom content padding: 16 above the navigation.
- **Radius — tokens only:** buttons and inputs 12 · large primary button 14 · badge 8 · card 16 · **status card 20** · chips, rail and segments 999.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` · Border `#E4E7EC` · Brand `#173B63` · **France `#315FA8`** · **Switzerland `#D84B4B`** · Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC`. Warning **text** is `#111827` on `#FFF7E6`. Country colours appear only as 8 px dots.
- **Icons:** Lucide, 1.75 px stroke, 20 default / 24 in navigation / 16 in chips.
- **Buttons:** large primary 56 h radius 14 brand fill white 15 / 600 · secondary 48 h radius 12 white fill 1 px border `#111827` label · text button 40 h brand. **Touch targets ≥ 48 dp Android, ≥ 44 pt iOS.**
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 16, **no shadow**. Status card: radius 20, padding 24.
- **Rail:** 8 px tall, radius 999, never taller.
- **Confidence:** words + icon + three 6 px-tall pill segments, **never a percentage**.
- **Bottom navigation:** 4 items. Android: 80 dp incl. gesture bar, 24 dp icons, 12 sp labels. iOS: standard tab bar 49 pt + 34 pt home indicator, 24 pt icons, 11 pt labels. Active item brand colour, inactive `#667085`. No pill.
- **Status is never colour alone.** French copy throughout.
- **Never draw:** a map, a pin, a route, a **live location dot**, a **timeline of the day**, a flag emoji, an avatar, a notification bell, a streak, a badge, a confetti or celebratory state, a spinner, a shadow on a card.

## Platform chrome

**Android frames:** status bar on the canvas colour with dark icons; no app bar — the greeting is the top of the content; system gesture bar 24 dp at the bottom inside the 80 dp navigation.
**iOS frames:** status bar with the Dynamic Island cut-out, dark icons; no navigation bar — the greeting is the top of the content; tab bar 49 pt with the 34 pt home-indicator area beneath; labels 11 pt.

## Content, top to bottom (identical on both rows)

### 1. Greeting header — 16 below the safe area, 56 tall

Left: **Bonjour Camille** H3 20 / 28 600 `#111827`, and beneath it Caption 13 / 18 `#667085` *Vendredi 18 juin 2027*.
Right: nothing. No bell, no avatar.

### 2. Mode chip — 12 below

A pill chip, 32 h, radius 999, `#FFFFFF` fill, 1 px `#E4E7EC` border, 12 px padding: Lucide `radar` 16 px `#667085` (frames A2/I2/A3/I3) or `hand` (A1/I1), then Body-M 15 / 500 `#667085` *Mode automatique* (or *Saisie manuelle*), then a 1 px vertical rule, then `Changer` in Body-M 15 / 500 brand `#173B63`. Always visible: the user must see which mode is recording their days.

### 3. The status card — 16 below. **Radius 20, padding 24, white, 1 px border.** This is Frontier's status card and the visual centre of the screen.

- Caption 13 / 18 `#667085`, uppercase, tracking 0.04 em: **TAUX ANNUALISÉ 2027**
- Hero, Display 48 / 56 600 tabular `#15803D`, 8 below: **18,33 %**
- Caption 13 / 18 `#667085` beneath: *Taux à déclarer à l'AFC*
- 16 below, Body-L 17 / 26 `#111827`: **52 jours** *de télétravail restants avant 40 %* — `52 jours` weight 600 tabular, the rest 400.
- Caption 13 / 18 `#667085`: *75,5 jours avant le seuil social de 49,9 %*
- 20 below, the **rail**: track 8 px radius 999 `#E4E7EC`; fill 0 → 18,33 % `#15803D`; two 2 px `#111827` ticks at 40 % and 49,9 % extending 4 px above and below; tick labels Caption 13 / 18 tabular `#111827`, anchored outward (`40 %` ends at its tick, `49,9 %` starts at its tick). No band names at this width.

### 4. Unlogged-days banner — 16 below

Full width, radius 12, `#FFF7E6` fill, 4 px `#B7791F` accent bar on the left edge (inside the radius), 16 px padding. Lucide `calendar-x` 20 px `#B7791F`, then Body-M 15 / 500 `#111827` **3 jours non renseignés**, and beneath, a text link Body-M 15 / 500 brand: `Compléter dans le calendrier` with `arrow-right` 16 px.

Inline only. Never a dialog, never blocking.

### 5. The log block — 20 below. **The only part that differs between the three columns.**

---

#### Column 1 — MANUEL, AVANT SAISIE (A1 / I1)

- Label Body-M 15 / 500 `#111827`: **Où avez-vous travaillé aujourd'hui ?**
- Three buttons, full width, **56 tall, radius 14**, stacked 8 apart, label left-aligned at 16 px padding, Body-M 15 / 500, each with an **8 px country dot** 12 px before the label:
  1. `En Suisse` — dot `#D84B4B`; white fill, 1 px `#E4E7EC` border, `#111827` label
  2. `Domicile` — dot `#315FA8`; same style
  3. `Mission` — dot `#98A2B3`; same style
  None is pre-selected, none is brand-filled. The three are equals.
- 12 below, a text button 40 h, left-aligned, Body-M 15 / 500 brand, Lucide `calendar-off` 16 px: `Déclarer une absence`

---

#### Column 2 — AUTO, À CONFIRMER (A2 / I2)

The day has ended; the app has a proposal.

- Label Body-M 15 / 500 `#111827`: **Journée détectée**
- A **proposal card — status card style**: radius 20, padding 24, white, 1 px border.
  - First line: 8 px dot `#315FA8`, then H2 24 / 32 700 `#111827` **Domicile**
  - Body 15 / 22 `#667085`, 8 below: *Vous êtes resté en France pendant vos heures de travail.*
  - Caption 13 / 18 `#667085`, tabular times: *Détecté le 18.06.2027 entre 08:12 et 17:04*
  - 16 below, the **confidence line**: Lucide `shield-check` 16 px `#15803D`, then Body-M 15 / 500 `#111827` **Détection fiable**, then to the right three pill segments 24 × 6 px, 4 apart, all three filled `#15803D`. (For an uncertain day: `shield-alert` `#B7791F`, *Détection incertaine — vérifiez*, two segments filled `#B7791F` and one `#E4E7EC`. Do not draw that variant here.)
- 16 below the card, two actions stacked 8 apart, full width:
  - **Large primary 56 h radius 14**, brand fill: `Confirmer`
  - **Secondary 48 h radius 12**: `Corriger`
- 12 below, Body 15 / 22 `#667085`: *Rien n'est enregistré tant que vous n'avez pas confirmé.*

That sentence is a promise the product keeps — give it room, it is not fine print.

---

#### Column 3 — CONFIRMÉ (A3 / I3)

The buttons are replaced by a **confirmation banner**: full width, radius 12, `#EAF7EE` fill, 4 px `#15803D` accent bar on the left edge, 16 px padding.

- First line: Lucide `circle-check` 20 px `#15803D`, then 8 px dot `#315FA8`, then Body-M 15 / 500 `#111827` **Domicile** — *enregistré* (the second word 400 `#667085`)
- Caption 13 / 18 `#667085`, tabular: *Enregistré le 18.06.2027 à 18:03*
- Caption 13 / 18 `#667085`: *Détecté automatiquement, confirmé par vous.*
- Right edge, vertically centred: text button 40 h brand `Modifier`

The timestamp and the provenance are the point of the product: plain text, on screen, never a tooltip.

---

### 6. Bottom navigation

Four items, Lucide 24: `sun` `Aujourd'hui` · `calendar` `Calendrier` · `file-text` `Relevé` · `settings` `Paramètres`. Active **Aujourd'hui** in brand `#173B63`, label weight 600; others `#667085`. Android: 80 dp including the gesture bar. iOS: 49 pt tab bar over the 34 pt home indicator.

## Rules for this screen

- **Four screens is the whole app.** No fifth tab, no settings gear in the header, no bell, no avatar.
- **No gamification.** No streak, no "7 jours d'affilée", no badge, no celebratory colour or motion after logging.
- **The app never records a day by itself.** Column 2 must make that unmistakable; column 3 shows who confirmed.
- **No live location, no timeline, no map.** The status card shows the *year's* figure and *today's record*, never a current position.
- **Brand blue** appears only on `Changer`, `Compléter dans le calendrier`, `Déclarer une absence`, `Confirmer`, `Modifier`, and the active tab — never as a fill on the three manual buttons.
- French only, copy exactly as written. French number convention; Swiss dot dates; 24-hour times; tabular numerals.
- Status never colour alone: dot + word, icon + label, always.

Deliver one high-fidelity static sheet with the six frames in a 3 × 2 grid.
