# FD2 — Calculateur télétravail frontalier (web mobile, 390 px, état « résultat »)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the mobile version of one screen: the public calculator page of a French-language product for cross-border workers living in France and employed in Switzerland. Viewport 390 px wide (iPhone baseline), full scrolling height. The layout must also hold at 360 px, so nothing sits within 8 px of a gutter.

Same page, same copy, same numbers as the desktop version — only the layout changes. The typical reader is on a train, one hand on the phone.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter** everywhere; **tabular numerals** for every figure, percentage and date.
- **Type:** Display 48 / 56 600 (large statistics only) · H1 32 / 40 700 · H2 24 / 32 700 · H3 20 / 28 600 · Body-L 17 / 26 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18 · Micro 11 / 14 500.
- **Spacing:** 4 px base — 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48. **Mobile side padding 20 px** → content 350 px wide at 390.
- **Radius — tokens only:** buttons and inputs 12 · large primary button 14 · small badge 8 · card 16 · status card 20 · chips and progress 999.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` · Border `#E4E7EC` · Brand `#173B63` · France `#315FA8` · Switzerland `#D84B4B` · Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC`. Warning **text** is `#111827` on `#FFF7E6`.
- **Icons:** Lucide, 1.75 px stroke, 20 px default, 16 px inside chips and small buttons.
- **Buttons:** primary 48 h radius 12 brand fill white label · large primary 56 h radius 14 · secondary 48 h radius 12 white fill 1 px border · text button 40 h brand colour. **Every tappable target ≥ 44 px.**
- **Inputs:** 48 h, radius 12, 1 px border, 14 px padding, label 13 / 500 above, helper 13 / 18 below.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, **padding 16 on mobile**, no shadow.
- **Progress / rail:** 8 px tall, radius 999.
- **Status is never colour alone.** French copy throughout.
- **Never draw:** a map, a pin, a flag emoji, an avatar, a bell, an illustration, a gradient, a shadow on a card, a sticky bar, a floating button.

## Page structure, top to bottom

### 1. Header — 56 px, `#FFFFFF`, 1 px `#E4E7EC` bottom border

Left: Lucide `menu` 24 px in `#111827` inside a 44 × 44 tap area, then the wordmark — small geometric frontier mark 20 px + name, 17 / 600 `#111827`.
Right, always visible outside the menu: primary brand button, **compact 40 h**, radius 12, Body-M 15 / 500: `Suivre mes jours`.
All nav links live inside the menu and are not drawn.

### 2. Page heading — 24 px top margin

- H1 **28 / 36 700** (one step down from desktop): **Calculateur de télétravail frontalier**
- Body 15 / 22 `#667085`, 8 px below: *Estimez votre pourcentage de télétravail annuel et le nombre de jours qu'il vous reste avant les seuils de 40 % et 49,9 %.*

### 3. The form — one card, full 350 px, radius 16, 16 px padding, 24 px below the heading

Three fields stacked, 20 px apart. Label 13 / 500 `#111827`, input 48 h radius 12, helper 13 / 18 `#667085`.

1. **Canton de travail** — select showing `Genève`, `chevron-down` right.
   Helper: *Le canton détermine votre régime d'imposition.*
2. **Taux d'activité (%)** — number input `100`, `minus` / `plus` stepper buttons inside the field at the right, each 44 × 44.
   Helper: *Un temps partiel réduit proportionnellement le plafond de 40 % et le quota de missions.*
3. **Jours de télétravail déjà pris** — number input `83`, same stepper.
   Helper: *Comptez une demi-journée pour toute journée de 2 à 4 heures.*

Then, always visible, 20 px below:

- Label 15 / 500 `#111827`: **Avez-vous effectué des missions hors de Suisse cette année ?**
- Two radios on one line, 22 px outer / 10 px inner, each inside a 44 px tap height, 32 px apart: `Non` (selected, brand) and `Oui`.
- Helper 13 / 18: *Les jours de mission sont comptés à l'intérieur des 40 %, et non en plus.*

Then a collapsed accordion row, 1 px `#E4E7EC` top rule, 48 h: `Options avancées` Body-M 15 / 500 with `chevron-down` right. The desktop descriptor line is dropped at this width.

Then the primary action: **large primary button 56 h, radius 14, full width**, 20 px below: `Calculer`.

### 4. Result panel — second card, full width, radius 16, 16 px padding, 16 px below the form

In this exact order:

**a. Status chip** — pill, `#EAF7EE`, 32 h, 12 px padding: `circle-check` 16 px `#15803D` + **Sous les deux seuils** Body-M 15 / 500 `#15803D`. Under it, 8 px, Body 15 / 22 `#667085`: *Votre imposition et votre sécurité sociale restent suisses.*

**b. Hero number** — 20 px below: Display **44 / 52** 600 tabular `#15803D` (one step down from desktop, still the largest thing on the page): **34,58 %**
Caption 13 / 18 `#667085` beneath: *Taux à déclarer à l'AFC*

**c. Threshold rail** — 20 px below, full card width:

- Track 8 px, radius 999, `#E4E7EC`; fill 0 → 34,58 % in `#15803D`.
- Two 2 px `#111827` tick markers at 40 % and 49,9 % extending 4 px above and below the track.
- Tick labels below in Caption 13 / 18 tabular `#111827`, **anchored outward**: `40 %` ends at its tick (right-aligned), `49,9 %` starts at its tick (left-aligned), so they can never collide at any width.
- **No band labels above the rail at this width** — the chip already names the current zone. Do not substitute abbreviations or a legend.

**d. Four metric tiles — 2 × 2 grid**, 12 px gaps, 20 px below. Each: `#F7F8FA` fill, radius 12, 12 px padding, no border. Caption 13 / 18 `#667085` (wraps to two lines), figure H2 24 / 32 700 tabular `#111827`.

| Label | Value |
|---|---|
| Jours restants avant 40 % | 13 |
| Jours restants avant 49,9 % | 36,5 |
| Jours imposés en Suisse | 240 |
| Jours imposés en France | 0 |

**e. Legal note** — 20 px below, 1 px rule, Caption 13 / 18 `#98A2B3`: *Estimation fournie à titre informatif. Ce calculateur n'est pas un conseil fiscal. Vérifiez la méthode de décompte appliquée par votre employeur.*

**f. Contextual link** — 12 px below, text button 44 h brand, Body-M 15 / 500, `arrow-right` 16 px: `Gardez une trace datée de vos jours`

### 5. Email capture — third card, full width, radius 16, 16 px padding, 16 px below

- H3 20 / 28 600: **Être prévenu quand les règles changent**
- Body 15 / 22 `#667085`: *Les seuils et les accords évoluent chaque année. Un e-mail uniquement en cas de changement — pas de newsletter.*
- Input 48 h **full width**, placeholder `votre@email.fr`.
- 8 px below, secondary button 48 h **full width**: `M'alerter`.

### 6. Share row — 16 px below, no card

Two secondary buttons side by side, each half width minus a 6 px gap, 44 h, Body-M 15 / 500 `#111827`, Lucide 16 px: `link` `Copier le lien` · `share-2` `Partager`.

### 7. Footer — `#FFFFFF`, 1 px top rule, 32 px vertical padding

Four **stacked** sections, 24 px apart: head Body-M 15 / 500 `#111827`, links Body 15 / 22 `#667085` each with a 44 px tap height.

- **Outils** — Calculateur 40 %, Calculateur LAMal/CMU, Alertes e-mail
- **Guides** — Tous les guides, Règle des 40 %, Seuil social 49,9 %, Droit d'option
- **Le produit** — L'application, Le relevé annuel, Tarifs, À propos, Sources réglementaires
- **Légal** — Mentions légales, Confidentialité, CGU

Below, 24 px down, two stacked lines Caption 13 / 18 `#98A2B3`:
*Informations à caractère général, sans valeur de conseil fiscal.*
*Dernière vérification réglementaire : 15.01.2027*

## Rules for this screen

- **No horizontal scrolling**, and the layout holds at 360 px.
- **Nothing is sticky, nothing floats.** No sticky CTA bar, no floating action button, no bottom tab bar — this is a public page, and the tab bar belongs to the signed-in app.
- **Nothing is gated or collapsed away.** The result is fully visible on scroll.
- **Brand blue appears exactly three times:** header CTA, `Calculer`, contextual link.
- French only, copy exactly as written; French number convention with tabular numerals; status always colour + icon + text.

Deliver one high-fidelity static mockup of the full page at 390 px, scrolled out to full height.
