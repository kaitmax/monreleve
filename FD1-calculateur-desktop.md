# FD1 — Calculateur télétravail frontalier (web, desktop 1440 px, état « résultat »)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design one screen: the public calculator page of a French-language product for cross-border workers living in France and employed in Switzerland. It is the front door of the product and the page people paste into Facebook groups. Desktop viewport, 1440 px wide.

The page must feel **trustworthy, calm, precise and private** — the register sits between Apple, Linear and the Stripe Dashboard. It answers a question with money attached, so nothing on it may look like a startup launch page or a GPS tracker.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter** everywhere. Every figure, percentage, date and timestamp uses **Inter with tabular numerals**.
- **Type:** Display 48 / 56 weight 600 (large statistics only) · H1 32 / 40 700 · H2 24 / 32 700 · H3 20 / 28 600 · Body-L 17 / 26 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18 · Micro 11 / 14 500. Weights 400 / 500 / 600 / 700 only.
- **Spacing:** 4 px base — 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80. Desktop side padding 32, content max width 1200, centred.
- **Radius — tokens only:** buttons and inputs 12 · large primary button 14 · small badge 8 · card 16 · large status card 20 · chips, progress and confidence bars 999. Nothing else is rounded; nothing exceeds its token.
- **Colour — exactly these:**
  - Canvas `#F7F8FA` · Surface / card `#FFFFFF`
  - Text primary `#111827` · secondary `#667085` · tertiary `#98A2B3` · disabled `#C4C8D0`
  - Border `#E4E7EC` · strong `#D0D5DD`
  - Brand (Deep Alpine Blue) `#173B63` — primary CTA, links, selected states; used sparingly
  - France `#315FA8` (soft `#EAF1FB`) · Switzerland `#D84B4B` (soft `#FCECEC`) — small dots and chips only, never flags
  - Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC` · Info `#2563EB` on `#EDF4FF`
  - Warning colour is for accents, icons and the rail band; warning **text** is `#111827` on `#FFF7E6`.
- **Icons:** Lucide, 1.75 px stroke, 20 px default.
- **Buttons:** primary 48 h, radius 12, brand fill, white 15 / 600 label, min width 120 · secondary 48 h, radius 12, white fill, 1 px `#E4E7EC` border, `#111827` label · text button 40 h, brand colour.
- **Inputs:** 48 h, radius 12, 1 px `#E4E7EC` border, 14 px padding, label 13 / 500 six px above, helper 13 / 18 secondary six px below.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 24 on desktop, **no shadow**.
- **Progress / rail:** 8 px tall, radius 999 — never taller.
- **Status is never colour alone:** colour + icon + text, always. WCAG AA. French copy throughout.
- **Never draw:** a map, a pin, a flag emoji, an avatar, a notification bell, an illustration, a gradient, a shadow on a card.

## Page structure, top to bottom

### 1. Header — 64 px, `#FFFFFF`, 1 px `#E4E7EC` bottom border, content width 1200

Left: product wordmark, `#111827`, 17 / 600 — a small geometric mark (two short horizontal lines meeting a vertical stroke, suggesting a frontier) at 20 px, then the name.
Centre-right, nav in Body-M 15 / 500 `#667085`, 32 px apart: `Calculateurs ▾`  `Guides`  `Le relevé`  `Tarifs`.
Right: one primary brand button, 48 h: `Suivre mes jours`.

### 2. Page heading — 720 px column, centred, 64 px top margin

- H1, 32 / 40 700: **Calculateur de télétravail frontalier**
- Body-L 17 / 26 `#667085`, 12 px below: *Estimez votre pourcentage de télétravail annuel et le nombre de jours qu'il vous reste avant les seuils de 40 % et 49,9 %.*

### 3. The form — one card, 720 px wide, radius 16, 32 px padding, 32 px below the heading

Three fields stacked, full card width, 24 px apart. Each: label 13 / 500 `#111827`, input 48 h radius 12, helper 13 / 18 `#667085`.

1. **Canton de travail** — select showing `Genève`, Lucide `chevron-down` at the right.
   Helper: *Le canton détermine votre régime d'imposition.*
2. **Taux d'activité (%)** — number input, value `100`, Lucide `minus` / `plus` stepper buttons inside the field at the right, each a 44 × 44 tap area.
   Helper: *Un temps partiel réduit proportionnellement le plafond de 40 % et le quota de missions.*
3. **Jours de télétravail déjà pris** — number input with the same stepper, value `83`.
   Helper: *Comptez une demi-journée pour toute journée de 2 à 4 heures.*

Then, **always visible**, 24 px below the third field:

- Label 15 / 500 `#111827`: **Avez-vous effectué des missions hors de Suisse cette année ?**
- Two radios on one line, 22 px outer / 10 px inner, 32 px apart: `Non` (selected, brand fill) and `Oui`.
- Helper 13 / 18 `#667085`: *Les jours de mission sont comptés à l'intérieur des 40 %, et non en plus.*

Then a collapsed accordion row, full card width, 1 px `#E4E7EC` top rule, 48 h: `Options avancées` in Body-M 15 / 500 with `chevron-down` at the right, and a caption to its right in `#98A2B3`: *méthode de calcul, décompte, début d'activité*.

Then the single primary action, 24 px below: brand button 48 h `Calculer`. Nothing beside it.

### 4. The result panel — a second card, 720 px, radius 16, 32 px padding, 24 px below the form. It appears **below** the form and never replaces it.

In this exact order:

**a. Status badge** — a pill chip, radius 999, `#EAF7EE` fill, 32 h, 12 px horizontal padding: Lucide `circle-check` 16 px in `#15803D`, then **Sous les deux seuils** in Body-M 15 / 500 `#15803D`. Under the chip, 8 px, Body 15 / 22 `#667085`: *Votre imposition et votre sécurité sociale restent suisses.*

**b. The hero number** — 24 px below: Display 48 / 56 600, Inter tabular, `#15803D`: **34,58 %**
Directly under it, Caption 13 / 18 `#667085`: *Taux à déclarer à l'AFC*

**c. The threshold rail** — 24 px below, full card width. This is the product's signature element.

- Track: 8 px tall, radius 999, `#E4E7EC`.
- Fill: from 0 to 34,58 % of the width, `#15803D`, radius 999.
- Two tick markers at 40 % and 49,9 % of the width: 2 px wide, `#111827`, extending 4 px above and 4 px below the track (16 px total).
- Tick labels below in Caption 13 / 18 tabular `#111827`, left-aligned to their ticks: `40 %` · `49,9 %`.
- Above the track, Micro 11 / 14 500 `#98A2B3`, centred over each band: `Conforme` (0–40) · `Imposition France` (40–49,9) · `Sécurité sociale France` (49,9–100).

**d. Four metric tiles** — 24 px below: a 4-across row, 16 px gaps. Each tile: `#F7F8FA` fill (the canvas colour, so it reads as recessed inside the white card), radius 12, 16 px padding, **no border**. Caption 13 / 18 `#667085` on top, figure H2 24 / 32 700 tabular `#111827` below.

| Label | Value |
|---|---|
| Jours restants avant 40 % | 13 |
| Jours restants avant 49,9 % | 36,5 |
| Jours imposés en Suisse | 240 |
| Jours imposés en France | 0 |

**e. Legal note** — 24 px below, a 1 px `#E4E7EC` rule, then Caption 13 / 18 `#98A2B3`: *Estimation fournie à titre informatif. Ce calculateur n'est pas un conseil fiscal. Vérifiez la méthode de décompte appliquée par votre employeur.*

**f. One contextual link** — 16 px below, text button 40 h, brand `#173B63`, Body-M 15 / 500, Lucide `arrow-right` 16 px: `Gardez une trace datée de vos jours`

### 5. Email capture — a third card, 720 px, radius 16, 24 px padding, 24 px below

- H3 20 / 28 600: **Être prévenu quand les règles changent**
- Body 15 / 22 `#667085`: *Les seuils et les accords évoluent chaque année. Un e-mail uniquement en cas de changement — pas de newsletter.*
- 16 px below, one line: input 48 h radius 12 with placeholder `votre@email.fr` taking the remaining width, 12 px gap, secondary button 48 h `M'alerter`.

### 6. Share row — 16 px below, no card, left-aligned in the 720 column

Two secondary buttons side by side, 12 px gap, 40 h, Body-M 15 / 500 `#111827`, each with a Lucide icon at 16 px: `link` `Copier le lien` · `share-2` `Partager`.

### 7. Footer — `#FFFFFF`, 1 px `#E4E7EC` top rule, 64 px vertical padding, content width 1200

Four columns of links, Body 15 / 22 `#667085`, column heads Body-M 15 / 500 `#111827`:

- **Outils** — Calculateur 40 %, Calculateur LAMal/CMU, Alertes e-mail
- **Guides** — Tous les guides, Règle des 40 %, Seuil social 49,9 %, Droit d'option
- **Le produit** — L'application, Le relevé annuel, Tarifs, À propos, Sources réglementaires
- **Légal** — Mentions légales, Confidentialité, CGU

Below the columns, 32 px down, one line Caption 13 / 18 `#98A2B3`: left *Informations à caractère général, sans valeur de conseil fiscal.* · right-aligned *Dernière vérification réglementaire : 15.01.2027*

## Rules for this screen

- **French only.** Copy exactly as written — it is doing the work Inter and grey cannot.
- Numbers use French convention: comma decimal separator, non-breaking space before `%`; tabular numerals everywhere a figure appears.
- **The result never sits above or inside the form.** Users iterate, so the form stays visible.
- **Nothing is gated:** no overlay, no modal, no blur, no "créez un compte pour voir".
- **Brand blue is used exactly three times** on the whole page: the header CTA, `Calculer`, and the contextual link. Everything else is neutral or a status colour.
- No hero image, no testimonials, no trust badges, no pricing, no cookie banner, no chat widget.

Deliver one high-fidelity static mockup of the full page, top to bottom.
