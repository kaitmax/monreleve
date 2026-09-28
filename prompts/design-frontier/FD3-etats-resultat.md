# FD3 — Les quatre états du panneau de résultat (web, 720 px)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design a **specification sheet showing one component in four states**: the result panel of a French compliance calculator for cross-border workers living in France and employed in Switzerland.

Not a page. Four copies of the same card stacked vertically, each 720 px wide, 48 px apart, on a `#F7F8FA` canvas. Above each card, a caption in Caption 13 / 18 `#98A2B3`, uppercase tracking 0.04 em: `ÉTAT 1 / 4 — SOUS LES DEUX SEUILS`, and so on. No header, no footer.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; **tabular numerals** for every figure.
- **Type:** Display 48 / 56 600 · H2 24 / 32 700 · H3 20 / 28 600 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18 · Micro 11 / 14 500.
- **Spacing:** 8 · 12 · 16 · 20 · 24 · 32. Card padding 32.
- **Radius — tokens only:** card 16 · tiles 12 · chips, rail and bars 999 · banners 12.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` · Border `#E4E7EC` · Brand `#173B63` · Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC`.
- **Warning as text:** allowed **only** inside the warning chip at 15 / 500 on `#FFF7E6`; everywhere else warning text is `#111827`.
- **Icons:** Lucide, 1.75 px stroke — `circle-check`, `triangle-alert`, `circle-x`, `arrow-right`.
- **No shadows, no gradients, no illustrations, no emoji.**

## The structural rule governing this sheet

Two things are shown at once, deliberately **not** the same thing:

- **The rail shows position** — where the rate sits on 0–100. Three bands: 0–40 success, 40–49,9 warning, 49,9–100 error.
- **The chip shows status** — the regulatory situation. Four states.

**State 2 is why the distinction exists: its rate is under 40 %, so the rail fill is green, while its chip is amber.** That pairing is correct. Do not tint the rail amber to match, and do not soften the chip to green. Every card follows the same rule: the rail is coloured by where the number falls, the chip by what the situation is.

## Elements common to all four cards, in this order

1. **Status chip** — pill, radius 999, 32 h, 12 px horizontal padding, soft-colour fill, 16 px Lucide icon, label Body-M 15 / 500 in the status colour. Beneath it, 8 px, Body 15 / 22 `#667085`: the one-line explanation.
2. **Hero number** — 24 px below: Display 48 / 56 600 tabular, coloured by the **rail band** the number falls in. Caption 13 / 18 `#667085` beneath: *Taux à déclarer à l'AFC*.
3. **Threshold rail** — 24 px below, full card width: track 8 px radius 999 `#E4E7EC`; fill from 0 to the rate in the band colour; two 2 px `#111827` tick markers at 40 % and 49,9 % extending 4 px above and below; tick labels Caption 13 / 18 tabular `#111827`, anchored outward (`40 %` ends at its tick, `49,9 %` starts at its tick); band names above in Micro 11 / 14 500 `#98A2B3`, centred over each band: `Imposition Suisse` · `Imposition France` · `Sécurité sociale France`.
4. **Warning banners** — zero or more, 16 px below the rail, 12 px apart: full width, radius 12, soft-colour fill, 16 px padding, a 4 px accent bar on the left edge in the status colour (inside the radius), 16 px Lucide icon in the status colour, text Body 15 / 22 **`#111827`**.
5. **Four metric tiles** — 24 px below: one row, 16 px gaps, each `#F7F8FA` fill, radius 12, 16 px padding, no border. Caption 13 / 18 `#667085` above, figure H2 24 / 32 700 tabular below.
6. **Legal note** — 24 px below: 1 px `#E4E7EC` rule, Caption 13 / 18 `#98A2B3`: *Estimation fournie à titre informatif. Ce calculateur n'est pas un conseil fiscal.*
7. **One contextual link** — 16 px below: text button, brand `#173B63`, Body-M 15 / 500, `arrow-right` 16 px. Exactly one per card; it differs by state.

---

## ÉTAT 1 / 4 — SOUS LES DEUX SEUILS

- Chip: `#EAF7EE` fill, `circle-check` `#15803D`, **Sous les deux seuils** in `#15803D`.
  Explanation: *Votre imposition et votre sécurité sociale restent suisses.*
- Hero **34,58 %** in `#15803D`. Rail filled to 34,58 % in `#15803D`.
- No banners.
- Tiles: `Jours restants avant 40 %` **13** · `Jours restants avant 49,9 %` **36,5** · `Jours imposés en Suisse` **240** · `Jours imposés en France` **0**
- Link: `Gardez une trace datée de vos jours`

---

## ÉTAT 2 / 4 — MISSIONS HORS QUOTA (the important one)

- Chip: `#FFF7E6` fill, `triangle-alert` `#B7791F`, **Missions hors quota** in `#B7791F`.
  Explanation: *Votre télétravail reste sous 40 %, mais 14 jours de mission dépassent le quota de 10 jours et sont imposables en France.*
- Hero **39,16 %** in `#15803D` — it sits in the green band, so it is green. Rail filled to 39,16 % in `#15803D`, stopping just short of the 40 % tick.
- **A second rate, unique to this state**, 16 px under the hero block: H3 20 / 28 600 tabular `#667085` **45,0 %**, Caption 13 / 18 `#667085` beneath: *Part de jours hors de Suisse*. Then Body 15 / 22 `#667085`: *Les jours de mission au-delà du quota de 10 jours sortent du régime de télétravail : ils ne comptent pas dans le taux déclaré, mais restent imposables en France.*
- One warning banner: *Quota de missions dépassé — 10 jours couverts, 14 jours au-delà.*
- Tiles: `Jours restants avant 40 %` **2** · `Jours restants avant 49,9 %` **25,5** · `Jours imposés en Suisse` **226** · `Jours imposés en France` **14**
- Link: `Comprendre les jours de mission`

---

## ÉTAT 3 / 4 — RÉGIME NON APPLICABLE

- Chip: `#FDECEC` fill, `circle-x` `#C53030`, **Régime de télétravail non applicable** in `#C53030`.
  Explanation: *Votre télétravail dépasse 40 % de votre temps de travail annuel. Les jours excédentaires sont imposables en France.*
- Hero **45,00 %** in **`#B7791F`** — the number falls in the warning band. At Display size on white, the warning colour passes contrast; this is the one place it is used as text at scale. Rail filled to 45 % in `#B7791F`, crossing the 40 % tick.
- One error banner: *Plafond fiscal de 40 % dépassé.*
- Tiles — the first label changes because the figure is negative, and its value is set in `#C53030`: `Jours au-dessus de 40 %` **12** · `Jours restants avant 49,9 %` **11,5** · `Jours imposés en Suisse` **132** · `Jours imposés en France` **108**
- Link: `Comprendre la règle des 40 %`

---

## ÉTAT 4 / 4 — BASCULE DE SÉCURITÉ SOCIALE

- Chip: `#FDECEC` fill, `circle-x` `#C53030`, **Bascule de sécurité sociale** in `#C53030`, weight 600.
  Explanation: *Au-delà de 49,9 %, votre affiliation sociale passe en France. Un certificat A1 est requis.*
- Hero **60,00 %** in `#C53030`. Rail filled to 60 % in `#C53030`, crossing both ticks.
- Two error banners, 12 px apart: *Plafond fiscal de 40 % dépassé.* · *Seuil social de 49,9 % dépassé — certificat A1 requis.*
- Tiles: `Jours au-dessus de 40 %` **48** in `#C53030` · `Jours au-dessus de 49,9 %` **24,5** in `#C53030` · `Jours imposés en Suisse` **91** · `Jours imposés en France` **149**
- Link: `Comprendre le seuil social de 49,9 %`

---

## Rules for this sheet

- **Never colour alone.** Every chip carries its icon *and* its label; a reader who cannot see the colours still gets all four states right.
- **The four cards are structurally identical** — same order, spacing, tile row. Only values, colours, banner count, the second rate in state 2, and the link change. Do not restyle, reorder, or enlarge a card to dramatise severity.
- Numbers in French convention: comma decimal, non-breaking space before `%`, tabular numerals.
- Negative headroom is a positive figure with a changed label (`Jours au-dessus de 40 %`), never a minus sign, never clamped to zero.
- French only. Copy exactly as written.

Deliver one high-fidelity static sheet with all four cards visible top to bottom.
