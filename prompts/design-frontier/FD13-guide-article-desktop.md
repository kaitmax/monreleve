# FD13 — Gabarit d'article de guide (web, desktop 1440 px)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the guide article template of a French-language reference site for cross-border workers living in France and employed in Switzerland. Desktop viewport, 1440 px wide.

Draw it with the **pillar article** — the definitive page on the 40 % telework rule, at `/guides/teletravail-frontalier-40-pourcent`. This one page is the template for seven articles, so every element must be reusable.

The register is a **reference document**, not a blog post. A reader arrives with a specific, expensive question and needs to believe the answer. The page should feel closer to a well-set administrative notice than to an article — calm, warm in its copy, precise in its structure.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; **tabular numerals** for figures, percentages and dates.
- **Type:** H1 40 / 48 700 · H2 24 / 32 700 · H3 20 / 28 600 · **Body-L 17 / 26 for article prose** · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18.
- **Spacing:** 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64. Desktop side padding 32, content max 1200, centred.
- **Radius — tokens only:** buttons 12 · card 16 · banner 12 · badge 8 · chips 999.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` · Border `#E4E7EC` · strong `#D0D5DD` · Brand `#173B63` · Warning `#B7791F` on `#FFF7E6` · Info `#2563EB` on `#EDF4FF`. Warning **text** is `#111827` on `#FFF7E6`.
- **Icons:** Lucide, 1.75 px stroke, 20 in banners, 16 in links.
- **Buttons:** primary 48 h radius 12 brand fill · secondary 48 h radius 12 · text button 40 h brand.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 24, no shadow.
- **Reading measure:** article prose never exceeds ~70 characters per line — cap the prose block at **680 px** even though its column is wider.
- **Never draw:** an author photo, an avatar, a hero image, an illustration, a pull quote, a highlighted sentence, share buttons, a comments section, related-post thumbnails, a gradient, a shadow on a card, a sticky sidebar CTA, a floating button.

## Page structure

### 1. Header — 64 px, `#FFFFFF`, 1 px bottom border, content 1200

Wordmark (mark + name, 17 / 600 `#111827`); nav Body-M `#667085`: `Calculateurs ▾`  `Guides`  `Le relevé`  `Tarifs`; right: primary brand button `Suivre mes jours`.

### 2. Article head — 64 top padding, aligned with the prose column (starts at 320 px from the content's left edge)

- Breadcrumb, Caption 13 / 18 `#667085`, `chevron-right` 12 separators, last item `#111827`: `Guides` › `Règle des 40 %`
- H1 40 / 48 700 `#111827`, 16 below: **La règle des 40 % de télétravail pour les frontaliers**
- A metadata row 24 below, three **chips**: pill 28 h radius 999 `#FFFFFF` 1 px `#E4E7EC` border, 10 px padding, Caption 13 / 18 `#667085`, each with a Lucide 14 icon:
  - `calendar-check` *Dernière vérification : `15.01.2027`*
  - `user-check` *Relu par [nom du relecteur], expert-comptable*
  - `clock` *8 min de lecture*
- 32 below, a 1 px `#E4E7EC` rule across the prose column.

### 3. Two-column body — 40 below the rule

**Left: sticky table of contents, 280 px wide**, sticking 32 px from the viewport top as the page scrolls. Inside a white card radius 16 padding 20:

- Caption 13 / 18 500 `#667085` uppercase tracking 0.04 em: **SUR CETTE PAGE**
- Six links beneath, Body 15 / 22 `#667085`, 40 px row height, 12 px left padding.
- The **current item** (`Comment le pourcentage se calcule`) is `#111827` weight 500 with a 3 px brand `#173B63` pill (radius 999) along its left edge — no fill, no highlight.

Items: `Ce que dit l'accord` · `Comment le pourcentage se calcule` · `Les jours de mission` · `Si vous dépassez 40 %` · `Le seuil social de 49,9 %` · `Garder une trace datée`

**Right: prose, starting 40 px after the TOC column, capped at 680 px.**

#### Lede — Body-L 17 / 26 `#111827`, two paragraphs of real French

*Depuis le 1er janvier 2026, un frontalier résidant en France et employé en Suisse peut télétravailler jusqu'à 40 % de son temps de travail annuel sans que son imposition change. Au-delà, les jours excédentaires deviennent imposables en France.*

*Ce seuil se calcule sur l'année entière, et non mois par mois. Quelques journées de trop en novembre suffisent donc à modifier douze mois d'imposition — ce qui explique pourquoi le suivi compte autant que la règle elle-même.*

#### « En bref » — a white card radius 16, padding 24, 32 above and below

Caption 13 / 18 500 `#667085` uppercase tracking 0.04 em: **EN BREF**. Five rows, 44 tall, 1 px `#E4E7EC` rules between them: label Body 15 / 22 `#667085` left, value Body-M 15 / 500 `#111827` right-aligned, figures tabular.

| | |
|---|---|
| Seuil fiscal | 40 % du temps de travail annuel |
| Seuil de sécurité sociale | 49,9 % |
| Jours de mission | 10 jours par an, **à l'intérieur** des 40 % |
| Base de calcul usuelle | 240 jours ouvrés par an |
| Texte de référence | Avenant du 27 juin 2023 |

#### H2 — **Ce que dit l'accord**

Two paragraphs, Body-L, opening: *L'avenant du 27 juin 2023 à la convention fiscale franco-suisse, entré en vigueur le 1er janvier 2026, autorise le télétravail dans la limite de 40 % du temps de travail annuel sans perte du régime frontalier.*

#### H2 — **Comment le pourcentage se calcule**

Two paragraphs opening: *Le pourcentage rapporte vos jours de télétravail au nombre de jours ouvrés de l'année. La plupart des employeurs appliquent la base simplifiée de 240 jours prévue par la circulaire n° 45.*

Then **H3 — Journées entières et demi-journées**, one paragraph: *Une journée de plus de quatre heures compte pour une journée entière ; une journée de deux à quatre heures compte pour une demi-journée.*

#### Inline calculator call-to-action — a white card radius 16, padding 24, 32 above and below, one line

Body-L 17 / 26 `#111827` left — *Vous voulez savoir où vous en êtes ?* — and a primary brand button 48 h right: `Calculer mes jours`.

Placed exactly where the reader realises they cannot do the arithmetic in their head.

#### H2 — **Les jours de mission**

A **warning banner** directly under the heading: full prose width, radius 12, `#FFF7E6` fill, 4 px `#B7791F` accent inside the left edge, 16 padding, Lucide `triangle-alert` 20 `#B7791F`, text Body 15 / 22 **`#111827`**:

**L'erreur la plus fréquente.** *Les jours de mission hors de Suisse sont comptés à l'intérieur des 40 %, et non en plus. Un plafond de 10 jours par an s'applique, proportionnel en cas de temps partiel.*

Two paragraphs, then a text button brand with `arrow-right` 16: `Lire le guide détaillé sur les jours de mission`

#### H2 — **Si vous dépassez 40 %**

One paragraph, then a **comparison table** inside a white card radius 16 padding 0: 1 px `#E4E7EC` horizontal rules only, **no zebra, no vertical rules, no header shading, no sort arrows**. Header row 40 tall Caption 13 / 18 500 `#667085`; body rows 56 tall Body 15 / 22 `#111827`, cells padded 16.

| | Cantons à imposition à la source | Cantons de l'accord de 1983 |
|---|---|---|
| Cantons concernés | Genève, Zurich, Tessin, … | Berne, Soleure, Bâle-Ville, Bâle-Campagne, Vaud, Valais, Neuchâtel, Jura |
| Conséquence d'un dépassement | Les jours excédentaires deviennent imposables en France | Le statut de frontalier lui-même est remis en cause |
| Seuil applicable | 40 % | 40 % |

#### H2 — **Le seuil social de 49,9 %**

Two paragraphs opening: *Un second seuil, distinct et plus élevé, concerne la sécurité sociale : au-delà de 49,9 % de télétravail, votre affiliation bascule en France.* Then a text button: `Lire le guide sur le seuil social`

#### H2 — **Garder une trace datée**

Two paragraphs opening: *Depuis 2026, votre employeur certifie votre pourcentage de télétravail. Votre propre relevé permet de le vérifier et de le compléter, notamment pour les jours de mission qu'il ne connaît pas toujours.*

#### Questions fréquentes — H2, then an accordion in a white card radius 16 padding 0

Rows 56 tall, 1 px rules, question Body-M 15 / 500 `#111827` at 24 padding, `chevron-down` 20 `#667085` right. **First open** with its answer Body 15 / 22 `#667085`; the rest closed.

1. **Les jours de congés et de maladie comptent-ils ?** *(open)* — *Non, pas séparément. La base simplifiée de 240 jours les absorbe déjà : c'est la raison pour laquelle on ne vous les demande pas dans le calculateur.*
2. **Que se passe-t-il si je dépasse de quelques jours seulement ?**
3. **Mon employeur utilise-t-il forcément la base de 240 jours ?**
4. **Le télétravail depuis un pays tiers compte-t-il de la même façon ?**
5. **Le seuil est-il calculé par employeur ou par personne ?**

#### End-of-article CTA — a white card radius 16, padding 32, 48 above, with a Lucide `file-check` 24 `#173B63` in a 44 × 44 `#EDF4FF` radius-12 square at the top

- H3 20 / 28 600: **Gardez une trace datée de vos journées**
- Body 15 / 22 `#667085`: *Un relevé reconstitué en décembre est une affirmation. Un relevé dont chaque journée porte sa date d'enregistrement est un document.*
- Primary brand button 48 h: `Découvrir le relevé annuel`

This exact card ends every guide on the site — one CTA, no variants.

#### Article footer — 48 above, 1 px `#E4E7EC` rule

- Caption 13 / 18 `#667085`: *Chaque règle citée sur cette page renvoie à son texte d'origine.* then a text button 16: `Voir les sources réglementaires`
- 24 below, Caption 13 / 18 500 `#667085` uppercase: **GUIDES LIÉS**, then three text links Body 15 / 22 brand stacked 12 apart, each with `arrow-right` 16: `Le seuil social de 49,9 %` · `Les jours de mission hors de Suisse` · `L'attestation employeur`

### 4. Footer — `#FFFFFF`, 1 px top rule, 64 padding

Four columns, Body 15 / 22 `#667085`, heads Body-M `#111827`:
**Outils** — Calculateur 40 %, Calculateur LAMal/CMU, Alertes e-mail · **Guides** — Tous les guides, Règle des 40 %, Seuil social 49,9 %, Droit d'option · **Le produit** — L'application, Le relevé annuel, Tarifs, À propos, Sources réglementaires · **Légal** — Mentions légales, Confidentialité, CGU

Below, 32 down, Caption 13 / 18 `#98A2B3`: left *Informations à caractère général, sans valeur de conseil fiscal.* · right *Dernière vérification réglementaire : 15.01.2027*

## Rules for this template

- **Reference, not blog.** No author photo, no byline card, no share buttons, no related-post grid with thumbnails, no comments, no publication date presented as news. The three metadata chips are the whole apparatus.
- **The verification date comes first** among the chips. On a subject whose rules change annually, *when this was last checked* matters more than who wrote it.
- **Exactly two calculator CTAs:** the inline card mid-article and the closing card. No sticky sidebar CTA, no floating button, no repeated banner.
- **Tables are reference tables:** hairline rules only, never sortable, never zebra.
- **Warnings carry their text in `#111827`**; amber is the accent and the icon only.
- **No pull quotes, no highlighted sentences, no bold-italic emphasis blocks.** Emphasis is structural — headings, the « En bref » card, the banner.
- **Brand blue** appears only on: the header CTA, the TOC position marker, the two CTA buttons, the text links, and the closing card's icon square.
- French only, copy exactly as written; where a section says "two paragraphs", write real French prose in the same register — **never lorem ipsum**, because fake text hides how long French compound phrases wrap at a 70-character measure. `[nom du relecteur]` is a deliberate placeholder.

Deliver one high-fidelity static mockup of the full article, top to bottom, with the sticky table of contents shown in its scrolled position.
