# FD7 — Écran « Relevé » (app, Android 360 dp + iOS 390 pt)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the annual-statement screen of a signed-in mobile app for cross-border workers living in France and employed in Switzerland.

This screen **is** the product. Everything else in the app exists to fill it. It previews a document — the *Relevé annuel de télétravail* — that the user exports as a PDF and hands to an accountant or a tax administration. It must read like a record, not like a dashboard: calm, precise, complete.

Deliver **four frames in a 2 × 2 grid**, 48 px apart, on a `#F7F8FA` canvas:

- **Top row — Android, 360 × 800 dp:** `A1 — LE RELEVÉ` · `A2 — DÉTAIL DES SAISIES`
- **Bottom row — iOS, 390 × 844 pt:** `I1 — LE RELEVÉ` · `I2 — DÉTAIL DES SAISIES`

Captions above each frame in Caption 13 / 18 `#98A2B3`, uppercase, tracking 0.04 em. Same content both rows; only platform chrome differs.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; **tabular numerals** for every number, percentage, date and timestamp on this screen without exception.
- **Type:** Display 48 / 56 600 (the hero only) · H2 24 / 32 700 · H3 20 / 28 600 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18 · Micro 11 / 14 500.
- **Spacing:** 4 · 8 · 12 · 16 · 20 · 24 · 32. **Side padding 20** → content 320 dp / 350 pt.
- **Radius — tokens only:** buttons 12 · large primary 14 · badge 8 · card 16 · status card 20 · chips and rail 999 · tiles 12.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` / disabled `#C4C8D0` · Border `#E4E7EC` · strong `#D0D5DD` · Brand `#173B63` · **France `#315FA8`** · **Switzerland `#D84B4B`** · Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC` · Info `#2563EB` on `#EDF4FF`.
- **Icons:** Lucide, 1.75 px stroke.
- **Buttons:** large primary 56 h radius 14 · secondary 48 h radius 12 white fill 1 px border · text button 40 h brand. Targets ≥ 48 dp / 44 pt.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 16, **no shadow**. Status card radius 20, padding 24.
- **Rail:** 8 px, radius 999. **Bottom navigation:** 4 items, active brand; Android 80 dp incl. gesture bar, iOS 49 pt + 34 pt.
- **Status is never colour alone.** French copy throughout.
- **Never draw:** a chart of any kind (bar, donut, line, sparkline, ring), a map, a pin, a flag emoji, an avatar, a bell, a shadow on a card.

## Platform chrome

**Android:** status bar on the canvas, dark icons; no app bar — the title row is the top of the content; gesture bar inside the 80 dp navigation.
**iOS:** status bar with Dynamic Island; no navigation bar; tab bar 49 pt + home indicator 34 pt.

---

## Frames A1 / I1 — LE RELEVÉ

### 1. Title row — 16 below the safe area, 48 tall

Left: H2 24 / 32 700 `#111827` **Relevé annuel**. Right: a **year selector chip** — pill, 36 h, radius 999, white, 1 px `#E4E7EC` border, 12 px padding: Body-M 15 / 500 tabular `#111827` `2027` + Lucide `chevron-down` 16 `#667085`.

### 2. Provisional banner — 12 below

Full width, radius 12, `#FFFFFF` fill, 1 px `#E4E7EC` border, **4 px `#D0D5DD` grey accent** inside the left edge — grey, not amber: a partial year is the normal state for eleven months a year. 16 padding, Lucide `hourglass` 20 `#667085`.
Body-M 15 / 500 `#111827` **Relevé provisoire** · Caption 13 / 18 `#667085` *Année en cours au 18.06.2027. Le relevé sera complet après le 31 décembre 2027.*

### 3. Identification card — 16 below. White, radius 16, padding 16.

Seven rows, 44 tall, 1 px `#E4E7EC` rules between them (none under the last). Each: label Caption 13 / 18 `#667085` left, value Body 15 / 22 `#111827` right-aligned, tabular where numeric.

| | |
|---|---|
| Titulaire | Camille Berger |
| Canton de travail | Genève |
| Taux d'activité | 100 % |
| Méthode de décompte | Base simplifiée, 240 jours |
| Période couverte | 01.01.2027 – 18.06.2027 |
| Absences déclarées | 3 |
| Généré le | 18.06.2027 à 18:04 |

### 4. Four metric tiles — 16 below, 2 × 2 grid, 12 px gaps

Each tile: **white card**, radius 12, 1 px `#E4E7EC` border, 16 padding. Caption 13 / 18 `#667085` above, H2 24 / 32 700 tabular `#111827` below. Tiles for *Suisse* and *Télétravail* carry an 8 px country dot before the figure — `#D84B4B` and `#315FA8` respectively.

`Jours ouvrés (base annuelle)` **240** · `Jours en Suisse` **● 75** · `Jours de télétravail` **● 43** · `Jours de mission` **1**

### 5. Zone card — 16 below. **Status card: radius 20, padding 24.**

- Status chip: pill 32 h `#EAF7EE`, Lucide `circle-check` 16 `#15803D`, Body-M 15 / 500 `#15803D` **Sous les deux seuils**
- Hero, 16 below: Display 48 / 56 600 tabular `#15803D` **18,33 %**
- Caption 13 / 18 `#667085`: *Taux à déclarer à l'AFC*
- Rail, 20 below: track 8 px radius 999 `#E4E7EC`, fill 0 → 18,33 % `#15803D`, two 2 px `#111827` ticks at 40 % and 49,9 % extending 4 px above and below, tick labels Caption 13 / 18 tabular `#111827`, anchored outward (`40 %` ends at its tick, `49,9 %` starts at its tick).
- 16 below, Body 15 / 22 `#111827`: *Au-delà de 40 %, les jours excédentaires deviennent imposables en France. Au-delà de 49,9 %, l'affiliation à la sécurité sociale bascule en France.*

### 6. Monthly table — 16 below. White card, radius 16, padding 0 (rows run edge to edge inside the card).

Card header, 16 padding: H3 20 / 28 600 `#111827` **Détail mensuel**.

Table, 1 px `#E4E7EC` horizontal rules only — **no vertical rules, no zebra, no header shading, no sort icons**. Header row 40 tall, Caption 13 / 18 500 `#667085`; body rows 44 tall, Body 15 / 22 tabular `#111827`; month names Body 15 / 22 `#111827`. First column left-aligned, the other four right-aligned. Column headers carry a country dot where relevant.

`Mois` · `● Suisse` · `● Dom.` · `Miss.` · `Cumul`

| Mois | Suisse | Dom. | Miss. | Cumul |
|---|---|---|---|---|
| Janvier | 13 | 8 | 0 | 3,33 % |
| Février | 12 | 8 | 0 | 6,66 % |
| Mars | 15 | 8 | 0 | 10,00 % |
| Avril | 13 | 7 | 0 | 12,91 % |
| Mai | 14 | 8 | 0 | 16,25 % |
| Juin | 8 | 4 | 1 | 18,33 % |

Total row, 1 px `#D0D5DD` rule above, Body-M 15 / 500: `Total` · **75** · **43** · **1** · **18,33 %**

Under the table, 12 padding, Caption 13 / 18 `#98A2B3`: *La répartition des missions entre la France et les pays tiers figure dans le détail des saisies et dans le PDF.*

### 7. Evidence annex — collapsed, 16 below. White card, radius 16, 16 padding, 56 tall.

Lucide `list` 20 `#667085`, then Body-M 15 / 500 `#111827` **Détail des saisies**, then Caption 13 / 18 `#667085` `119 entrées`, and `chevron-down` 20 `#667085` at the right.

### 8. Export actions — 24 below, stacked 8 apart, full width

- **Large primary 56 h radius 14**, Lucide `file-down` 20: `Exporter en PDF`
- **Secondary 48 h radius 12**, Lucide `table` 20: `Exporter en CSV`

### 9. Legal footer — 24 below, Caption 13 / 18 `#98A2B3`, three lines, then 16 above the navigation

*Chaque saisie porte un horodatage d'enregistrement attribué par le serveur.*
*Document établi sur la base des déclarations de l'utilisateur, à des fins de conservation de preuve.*
*Ce document ne constitue pas un conseil fiscal.*

### 10. Bottom navigation

Lucide 24: `sun` Aujourd'hui · `calendar` Calendrier · `file-text` **Relevé** (active, brand, label 600) · `settings` Paramètres.

---

## Frames A2 / I2 — DÉTAIL DES SAISIES

The same screen scrolled to the annex, now **expanded** (`chevron-up`). This is the evidence layer, and it must be inspectable.

Inside the annex card, under the header row, a list of entry rows, 1 px `#E4E7EC` rules between them, 16 padding, each two or three lines:

**Line 1** — date Body-M 15 / 500 tabular `#111827`, then an 8 px country dot, then the kind Body 15 / 22 `#111827`; at the right, only where it applies, a **badge** 24 h radius 8 `#FFF7E6` Caption 13 / 500 `#111827` with Lucide `clock` 12 `#B7791F`: `Saisie tardive`.

**Line 2** — provenance, Caption 13 / 18 `#667085`, timestamps tabular.

**Line 3** — only when a note exists: Caption 13 / 18 `#98A2B3`, italic.

Draw these seven rows, in this order:

1. `18.06.2027` ● `Domicile`
   *Détecté automatiquement, confirmé par vous · Enregistré le 18.06.2027 à 18:03*
2. `17.06.2027` ● `Domicile`
   *Détecté automatiquement, confirmé par vous · Enregistré le 17.06.2027 à 19:12*
3. `16.06.2027` — `Non renseigné`, the whole line in `#98A2B3`, no dot
   *Aucune saisie*
4. `15.06.2027` ● `En Suisse`
   *Détecté automatiquement, confirmé par vous · Enregistré le 15.06.2027 à 18:40*
5. `09.06.2027` ● `Mission — France` (dot `#98A2B3`)
   *Saisie manuelle · Enregistré le 09.06.2027 à 20:22*
   *« Déplacement client Lyon »*
6. `07.06.2027` ● `Absence — jour férié` (dot `#C4C8D0`)
   *Saisie manuelle · Enregistré le 07.06.2027 à 09:15*
7. `03.06.2027` ● `Domicile` with the `Saisie tardive` badge
   *Détecté : En Suisse · Corrigé par vous · Enregistré le 15.06.2027 à 21:08*
   *« Réunion annulée, journée à domicile »*

Below the last row, centred, a text button 44 h brand Body-M 15 / 500: `Afficher les 112 entrées précédentes`

---

## Rules for this screen

- **No charts.** A monthly bar chart is the single most likely unrequested addition here; it adds decoration to a legal record and answers nothing the percentage does not.
- **The annex is never summarised away.** Every entry is reachable with its timestamp and provenance. Gap days are printed as *Non renseigné*, never skipped. Absences are printed like any other row and appear in no other figure.
- **Late entries are shown, not hidden**, with the same badge the calendar uses.
- **Provenance is plain text on every row** — never an icon alone, never a tooltip.
- **Nothing here is editable.** No inline edit, no swipe action, no delete. Corrections happen in the calendar; this is the document.
- **Brand blue** appears only on the export button, the "afficher" link, and the active tab.
- French only, copy exactly as written. `Camille Berger` is placeholder data. Swiss dot dates, 24-hour times, comma decimals, tabular numerals.

Deliver one high-fidelity static sheet with the four frames in a 2 × 2 grid.
