# FD9 — Écran « Paramètres » (app, Android 360 dp + iOS 390 pt)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the settings screen of a signed-in mobile app for cross-border workers living in France and employed in Switzerland. The app records where the user worked each day and produces an annual tax document from that record.

Settings here are not preferences. Several of them **recompute the whole year**, and one of them destroys a year of tax evidence. The screen must make that difference legible without becoming alarming.

Deliver **four frames in a 2 × 2 grid**, 48 px apart, on a `#F7F8FA` canvas:

- **Top row — Android, 360 × 800 dp:** `A1 — PARAMÈTRES` · `A2 — SUPPRESSION DU COMPTE`
- **Bottom row — iOS, 390 × 844 pt:** `I1 — PARAMÈTRES` · `I2 — SUPPRESSION DU COMPTE`

Captions above each frame in Caption 13 / 18 `#98A2B3`, uppercase, tracking 0.04 em. Same content both rows; only platform chrome differs.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; **tabular numerals** for dates, times, percentages and version numbers.
- **Type:** H2 24 / 32 700 · H3 20 / 28 600 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18 · Micro 11 / 14 500.
- **Spacing:** 4 · 8 · 12 · 16 · 20 · 24 · 32. **Side padding 20** → content 320 dp / 350 pt.
- **Radius — tokens only:** buttons and inputs 12 · large primary 14 · destructive 12 · card 16 · **bottom sheet 24 top** · banner 12 · switch 999.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` / disabled `#C4C8D0` · Border `#E4E7EC` · strong `#D0D5DD` · Brand `#173B63` · Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC`. Warning **text** is `#111827` on `#FFF7E6`.
- **Icons:** Lucide, 1.75 px stroke, 20 in rows, 16 in chevrons.
- **Buttons:** large primary 56 h radius 14 · secondary 48 h radius 12 white fill 1 px border · **destructive 56 h radius 12 `#C53030` fill white label** · text button 40 h brand. Targets ≥ 48 dp / 44 pt.
- **Switch:** 52 × 32, thumb 24, on = brand fill, off = `#D0D5DD`.
- **Inputs:** 48 h, radius 12, 1 px border; error state 2 px `#C53030` border.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, **padding 0** for settings groups — rows run edge to edge inside the card, separated by 1 px `#E4E7EC` rules inset 16 from the left. No shadow.
- **Bottom sheet:** radius 24 top, white, 36 × 4 drag indicator `#D0D5DD` radius 999, padding 20, scrim `#111827` at 40 %.
- **Bottom navigation:** 4 items, active brand; Android 80 dp incl. gesture bar, iOS 49 pt + 34 pt.
- **Status is never colour alone.** French copy throughout.
- **Never draw:** an avatar, a profile photo, a display-name header, a bell, a badge on the settings tab, a red dot, a shadow on a card.

## Platform chrome

**Android:** status bar on the canvas, dark icons; no app bar — the title row is the top of the content; gesture bar inside the 80 dp navigation.
**iOS:** status bar with Dynamic Island; no navigation bar; tab bar 49 pt + home indicator 34 pt.

## The row pattern (Frontier settings list)

Every settings row: **56 tall**, 16 horizontal padding. Left: a Lucide icon 20 `#667085`, then the label Body 15 / 22 `#111827` with an optional helper Caption 13 / 18 `#667085` beneath (the row grows to 72). Right: the current value Body 15 / 22 `#667085` tabular where numeric, then Lucide `chevron-right` 16 `#98A2B3`. Rows with a switch have no chevron and no value text; the switch sits at the right edge.

Section headings sit **outside** their card, 24 above it and 8 below: Caption 13 / 18 500 `#667085`, uppercase, tracking 0.04 em, left-aligned at the 20 gutter.

---

## Frames A1 / I1 — PARAMÈTRES

### Title row — 16 below the safe area, 48 tall
H2 24 / 32 700 `#111827` **Paramètres**

### ENREGISTREMENT — card with two rows

1. `radar` **Mode d'enregistrement** — value `Détection automatique`
   Helper: *Localisation autorisée le 12.01.2027*
2. `bell` **Rappel quotidien** — switch **on**, and to its left the value `17:30` tabular `#667085`
   Helper: *Un seul rappel par jour, uniquement si la journée n'est pas confirmée.*

### SITUATION PROFESSIONNELLE — a warning banner, then a card with five rows

Between the heading and the card, a banner: full width, radius 12, `#FFF7E6` fill, 4 px `#B7791F` accent inside the left edge, 12 padding, Lucide `triangle-alert` 16 `#B7791F`, Caption 13 / 18 `#111827`:
*Ces réglages recalculent l'ensemble de l'année en cours. Ils doivent correspondre à la méthode appliquée par votre employeur.*

3. `landmark` **Canton de travail** — value `Genève`
4. `percent` **Taux d'activité** — value `100 %`
5. `calculator` **Méthode de décompte** — value `Base simplifiée — 240 j.`
   Helper: *Demandez à votre employeur laquelle s'applique.*
6. `clock` **Décompte** — value `Journée entière`
7. `calendar` **Début d'activité** — value `01.01.2027`

### COMPTE — card with two rows

8. `mail` **Adresse e-mail** — value `camille.berger@example.fr`
9. `bell-ring` **Alertes réglementaires** — switch **off**
   Helper: *Un e-mail uniquement quand les règles changent.*

### MES DONNÉES — card with two rows

10. `download` **Exporter mes données** — value `JSON et CSV`
    Helper: *Toutes vos saisies et leurs horodatages.*
11. `trash-2` in `#C53030` — **Supprimer mon compte** with the label in **`#C53030`**, no value, no chevron.
    Helper `#667085`: *Supprime définitivement vos 119 saisies.*

### À PROPOS — card with four rows

12. `shield` **Politique de confidentialité** — chevron, no value
13. `file-text` **Conditions générales** — chevron, no value
14. `book-open` **Sources réglementaires** — value `Vérifié le 15.01.2027`
15. `info` **Version** — value `1.0.3 (41)` tabular, no chevron, not tappable, label `#667085`

Below the last card, 24 down, centred, Caption 13 / 18 `#98A2B3`, two lines:
*Cette application enregistre et met en forme vos journées.*
*Elle ne constitue pas un conseil fiscal.*

### Bottom navigation
Lucide 24: `sun` Aujourd'hui · `calendar` Calendrier · `file-text` Relevé · `settings` **Paramètres** (active, brand, label 600).

---

## Frames A2 / I2 — SUPPRESSION DU COMPTE

The settings screen behind a 40 % scrim; a bottom sheet open, radius 24 top, white, drag indicator, padding 20, rising to about 85 % of the screen.

1. H3 20 / 28 600 `#111827`: **Supprimer mon compte**
2. Body 15 / 22 `#111827`, 12 below: *Cette action supprime définitivement :*
3. Four lines, 8 apart, each with Lucide `minus` 12 `#667085` as the bullet, Body 15 / 22 `#111827`:
   - *119 saisies et leurs horodatages d'enregistrement*
   - *l'origine de chaque saisie (détectée, corrigée, manuelle)*
   - *votre relevé annuel 2027*
   - *votre compte et votre adresse e-mail*
4. 16 below, an **error banner**: radius 12, `#FDECEC` fill, 4 px `#C53030` accent inside the left edge, 16 padding, Lucide `circle-alert` 20 `#C53030`, Body 15 / 22 `#111827`: **Cette action est irréversible.** *Votre relevé ne pourra pas être régénéré, même en réinstallant l'application.*
5. 16 below, Body 15 / 22 `#667085` with a brand link: *Vous pouvez d'abord* `exporter vos données`*.*
6. 20 below, label Caption 13 / 500 `#111827`: **Pour confirmer, saisissez SUPPRIMER**
   Input 48 h radius 12, 1 px `#E4E7EC` border, **empty, no placeholder**.
7. Actions pinned at the sheet's bottom, stacked 8 apart, full width:
   - **Destructive 56 h radius 12** `Supprimer définitivement` — rendered **disabled**: `#F7F8FA` fill, 1 px `#E4E7EC` border, `#C4C8D0` label, because the word has not been typed.
   - **Secondary 48 h radius 12** `Annuler`

---

## Rules for this screen

- **The destructive action is guarded, not hidden.** A plain red row in its own section, then a sheet that names what is destroyed with counts and requires the typed word. Never three taps deep, never a small dialog with `Annuler` beside it.
- **Export is offered inside the deletion flow**, not only above it.
- **Turning detection off never needs a confirmation.** Tapping *Mode d'enregistrement* opens the mode chooser; stopping collection is immediate. Stopping data collection should never require persuasion.
- **No nagging.** No badge on the tab, no « profil incomplet », no upsell to automatic mode, no red dot on any row.
- **No identity chrome.** No avatar, no photo, no display-name header — the app knows an email and a canton, and its settings should say so.
- **No toggles for things that are not settings.** No dark theme switch, no language, no analytics switch that does nothing.
- **Brand blue** appears only on the two switches when on, the `exporter vos données` link, and the active tab.
- Colour is never the only signal: the destructive row is red **and** in its own section **and** worded destructively **and** carries the trash icon.
- French only, copy exactly as written. `camille.berger@example.fr` is placeholder data. Swiss dot dates, 24-hour times, tabular numerals.

Deliver one high-fidelity static sheet with the four frames in a 2 × 2 grid.
