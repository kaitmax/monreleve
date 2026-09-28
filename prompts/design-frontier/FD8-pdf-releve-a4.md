# FD8 — Le PDF exporté : *Relevé annuel de télétravail* (A4, deux pages)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the exported PDF produced by a compliance app for cross-border workers living in France and employed in Switzerland. This is the artifact the whole product exists to produce.

**A4 portrait**, read by an accountant, an employer's HR department, or a tax administration. It must look like something a *fiduciaire* would file — closer to a bank statement than to an app export. It shares the app's typeface and palette, but print has its own rules: no radius, no fills, almost no colour.

Deliver **two pages side by side**, 64 px apart, on a `#F7F8FA` backdrop so the white pages read as sheets. Each page is A4 proportion, **794 × 1123 px**, pure white, 1 px `#E4E7EC` outline. Above each, a caption in Caption 13 / 18 `#98A2B3`, uppercase, tracking 0.04 em: `PAGE 1 — SYNTHÈSE`, `PAGE 2 — DÉTAIL DES SAISIES`.

## Document rules — Frontier Work v1.0, print adaptation. Non-negotiable.

- **Margins 56 px** on all sides; content width 682 px.
- **Font: Inter**; **tabular numerals** for every number, date, percentage and timestamp without exception.
- **Print sizes, not screen sizes:** document title 18 pt 700 · section heading 11 pt 600 · body 9 pt · table body 8,5 pt · table header 8 pt 600 · captions and footer 7 pt · mentions 7,5 pt.
- **No radius in print.** Boxes are hairline rectangles. No fills except where stated, no shadows, no gradients, no illustrations, no icons other than the single status glyph, no emoji.
- **Colour is almost absent.** Black `#111827` on white with grey rules. Permitted colours, and nothing else:
  - the three status tokens — `#15803D`, `#B7791F`, `#C53030` — for the status glyph, the rate, the rail fill, and the *Saisie tardive* mention;
  - the two country accents — `#D84B4B` (Suisse) and `#315FA8` (Domicile) — **only** as a 5 px dot before a *Journée* value.
  No brand blue, no links, no coloured headings, no coloured table headers.
- Rules: 1 px `#E4E7EC` for table rows; 1 px `#111827` under the document title, above the totals, and above the page footer.
- Text `#111827` primary, `#667085` secondary.
- **The product wordmark appears once**, top-left of page 1, ≤ 24 px tall, set in `#111827` — the geometric frontier mark plus the name. No logo on page 2.

---

## PAGE 1 — SYNTHÈSE

### Masthead

Top-left: wordmark ≤ 24 px, `#111827`.
Top-right, right-aligned, 7 pt `#667085`, two lines: *Référence du document* over `RLV-2027-8F3C21A0` in tabular 8 pt `#111827`.

24 px below: document title 18 pt 700 `#111827` **Relevé annuel de télétravail**
Beneath, 9 pt `#667085`: *Année 2027 — période du 01.01.2027 au 18.06.2027*
Then a 1 px `#111827` rule across the content width.

### Provisional notice — 16 px below the rule

A hairline box, 1 px `#E4E7EC`, 12 px padding, no fill, one line 8 pt `#111827`:
**Relevé provisoire.** *Année en cours au 18.06.2027. Le relevé définitif pourra être établi après le 31 décembre 2027.*

### Section 1 — Identification

Heading 11 pt 600: **Identification**

Two-column table, full width, 1 px `#E4E7EC` horizontal rules, 22 px rows. Label 8,5 pt `#667085` in a 200 px left column; value 8,5 pt `#111827` right column, tabular where numeric.

| | |
|---|---|
| Titulaire | Camille Berger |
| Canton de travail | Genève |
| Taux d'activité | 100 % |
| Méthode de décompte | Base simplifiée — 240 jours ouvrés annuels |
| Mode d'enregistrement | Détection automatique avec confirmation |
| Période couverte | 01.01.2027 – 18.06.2027 |
| Absences déclarées | 3 |
| Document généré le | 18.06.2027 à 18:04 |

### Section 2 — Synthèse

Heading 11 pt 600: **Synthèse**

A four-cell row, full width, 56 px tall, cells separated by 1 px `#E4E7EC` vertical rules with 1 px rules above and below. Each cell: label 8 pt `#667085` on top, figure 16 pt 600 tabular `#111827` below. The *Suisse* and *Télétravail* figures carry a 5 px country dot before them.

`Jours ouvrés (base)` **240** · `Jours en Suisse` **● 75** · `Jours de télétravail` **● 43** · `Jours de mission` **1**

### Section 3 — Taux annualisé

Heading 11 pt 600: **Taux annualisé**

- One line: a filled circle 10 px `#15803D` containing a white check, then 10 pt 600 `#111827` **Sous les deux seuils**.
- Below, the rate 28 pt 600 tabular `#15803D`: **18,33 %**, with 8 pt `#667085` beside it: *Taux à déclarer à l'administration fiscale*
- The rail, full width, 16 px above and below: track 6 px tall, radius 999 (the only rounded element in the document, because it is a bar, not a box), `#E4E7EC`; fill 0 → 18,33 % `#15803D`; two 1 px `#111827` ticks at 40 % and 49,9 % extending 3 px above and below; labels beneath 7 pt tabular `#111827`, anchored outward (`40 %` ends at its tick, `49,9 %` starts at its tick).
- One paragraph 9 pt `#111827`: *Au-delà de 40 % du temps de travail annuel, les jours excédentaires deviennent imposables en France. Au-delà de 49,9 %, l'affiliation à la sécurité sociale bascule en France et un certificat A1 est requis.*

### Section 4 — Détail mensuel

Heading 11 pt 600: **Détail mensuel**

Six-column table, full width, 1 px `#E4E7EC` horizontal rules only — **no vertical rules, no zebra, no header shading**. Header 8 pt 600 `#667085`; rows 22 px; values 8,5 pt tabular. First column left-aligned, others right-aligned. The *Suisse* and *Domicile* headers carry a 5 px country dot.

| Mois | ● Suisse | ● Domicile | Mission France | Mission pays tiers | Cumul |
|---|---|---|---|---|---|
| Janvier | 13 | 8 | 0 | 0 | 3,33 % |
| Février | 12 | 8 | 0 | 0 | 6,66 % |
| Mars | 15 | 8 | 0 | 0 | 10,00 % |
| Avril | 13 | 7 | 0 | 0 | 12,91 % |
| Mai | 14 | 8 | 0 | 0 | 16,25 % |
| Juin | 8 | 4 | 1 | 0 | 18,33 % |
| Juillet à décembre | — | — | — | — | — |

Total row, 1 px `#111827` rule above, values 600: **Total** · **75** · **43** · **1** · **0** · **18,33 %**

### Section 5 — Mentions

Heading 11 pt 600: **Mentions**

Five paragraphs, 7,5 pt `#667085`, 8 px apart:

1. *Chaque saisie figurant dans ce relevé porte un horodatage d'enregistrement attribué par le serveur au moment de la saisie. Cet horodatage n'est pas modifiable par l'utilisateur.*
2. *Les saisies enregistrées plus de sept jours après la journée concernée portent la mention « saisie tardive » dans le détail des saisies.*
3. *Lorsque le mode de détection automatique est actif, l'application propose une journée et l'utilisateur la confirme ou la corrige. L'origine de chaque saisie est indiquée dans le détail.*
4. *Les journées d'absence (congé, maladie, jour férié) sont déclarées pour la complétude du relevé et n'entrent dans aucun calcul.*
5. *Document établi sur la base des déclarations de l'utilisateur, à des fins de conservation de preuve. Il ne constitue pas un conseil fiscal et n'engage ni l'employeur ni l'administration.*

### Page footer — at the bottom margin, 1 px `#111827` rule above, 7 pt `#667085`, one line

Left *Relevé annuel de télétravail — Camille Berger — 2027* · centre `RLV-2027-8F3C21A0` tabular · right `Page 1 / 4`

---

## PAGE 2 — DÉTAIL DES SAISIES

No masthead, no wordmark. A running head 8 pt `#667085` with a 1 px `#E4E7EC` rule beneath: *Relevé annuel de télétravail — 2027 — Détail des saisies*

Heading 11 pt 600, 16 px below: **Détail des saisies**, with 8 pt `#667085` to its right: `119 entrées — ordre chronologique inverse`

### The annex table — five columns, full width, 1 px `#E4E7EC` horizontal rules only

Header 8 pt 600 `#667085`, no fill:

| Date | Journée | Origine de la saisie | Horodatage d'enregistrement | Mention |
|---|---|---|---|---|

Column widths, left to right: 80 · 160 · 190 · 160 · 92 px. Rows 22 px, 8,5 pt; dates and timestamps tabular. Each *Journée* value is preceded by a 5 px dot — `#D84B4B` Suisse, `#315FA8` Domicile, `#98A2B3` Mission, `#C4C8D0` Absence, none for *Non renseigné*. Notes appear as an italic 7,5 pt `#667085` sub-line spanning from the second column, inside the same rule.

Draw these fifteen rows in this order:

| Date | Journée | Origine | Horodatage | Mention |
|---|---|---|---|---|
| 18.06.2027 | ● Domicile | Détection confirmée | 18.06.2027 18:03 | |
| 17.06.2027 | ● Domicile | Détection confirmée | 17.06.2027 19:12 | |
| 16.06.2027 | Non renseigné | — | — | |
| 15.06.2027 | ● En Suisse | Détection confirmée | 15.06.2027 18:40 | |
| 14.06.2027 | ● En Suisse | Détection confirmée | 14.06.2027 18:22 | |
| 11.06.2027 | ● En Suisse | Détection confirmée | 11.06.2027 18:55 | |
| 10.06.2027 | ● Domicile | Détection confirmée | 10.06.2027 17:48 | |
| 09.06.2027 | ● Mission — France | Saisie manuelle | 09.06.2027 20:22 | |
| 08.06.2027 | ● En Suisse | Détection confirmée | 08.06.2027 18:31 | |
| 07.06.2027 | ● Absence — jour férié | Saisie manuelle | 07.06.2027 09:15 | |
| 04.06.2027 | ● Domicile | Détection confirmée | 04.06.2027 17:59 | |
| 03.06.2027 | ● Domicile | Détection corrigée | 15.06.2027 21:08 | Saisie tardive |
| 02.06.2027 | ● En Suisse | Détection confirmée | 02.06.2027 18:12 | |
| 01.06.2027 | ● En Suisse | Détection confirmée | 01.06.2027 18:44 | |
| 31.05.2027 | ● En Suisse | Détection confirmée | 31.05.2027 18:07 | |

Notes as italic sub-lines: under 09.06 — *Déplacement client Lyon*; under 03.06 — *Réunion annulée, journée à domicile*.

The `Non renseigné` row is set entirely in `#98A2B3` — a hole in the record, stated rather than skipped.

The `Saisie tardive` mention is the only other coloured element on this page: 7,5 pt `#111827` inside a hairline box with a 1 px `#B7791F` border, no fill. The *Détection corrigée* value in that row stays black — a fact, not a warning.

At the bottom of the table area, 8 pt `#667085`, centred: *Suite du détail aux pages suivantes.*

### Page footer — identical to page 1, with `Page 2 / 4`

---

## Rules for this document

- **It must survive black-and-white printing.** Every status is carried by a word — *Sous les deux seuils*, *Saisie tardive*, *Détection corrigée*, *Non renseigné* — and the country dots are redundant with the words beside them. Colour confirms; it never carries the message.
- **No charts, no graphics, no decorative elements.** The rail is the only figure, because it locates the rate against two legal limits.
- **Every date is printed, including days with no entry and days of absence.**
- **The annex is complete**, paginated across pages 3 and 4. No truncation, no summary.
- **Nothing suggests interactivity.** No brand blue, no underlines, no buttons, no QR code.
- **Never claim more than the record supports.** No *certifié*, *attesté*, *conforme*, *validé*, *approuvé*. Only *déclaré*, *enregistré*, *horodaté*.
- French only, copy exactly as written. `Camille Berger` and `RLV-2027-8F3C21A0` are placeholders. Swiss dot dates, comma decimals, non-breaking space before `%`.

Deliver one high-fidelity static sheet showing both A4 pages side by side, complete from top margin to footer.
