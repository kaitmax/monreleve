# FD11 — Page d'accueil publique (web, desktop 1440 px)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the homepage of a French-language public website for cross-border workers living in France and employed in Switzerland. Desktop viewport, 1440 px wide.

The site's job is narrow: rank in French search, be believed, and route the visitor to one of three places — the calculator, the guides, or the mobile app. **It is not a product marketing page.** A visitor is deciding whether to trust this site with a question that has money attached, so the register is a calm reference site, not a launch.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; **tabular numerals** for figures and dates.
- **Type:** Display 48 / 56 600 (large statistics only) · H1 32 / 40 700 — this page may use **H1 at 40 / 48 700** for the hero · H2 24 / 32 700 · H3 20 / 28 600 · Body-L 17 / 26 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18.
- **Spacing:** 4 base — 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 80. Desktop side padding 32, content max width 1200, centred.
- **Radius — tokens only:** buttons 12 · large primary 14 · card 16 · badge 8 · chips 999. Nothing else rounded.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` · Border `#E4E7EC` · Brand `#173B63` · France `#315FA8` (soft `#EAF1FB`) · Switzerland `#D84B4B` (soft `#FCECEC`) · Info `#2563EB` on `#EDF4FF`. Country colours only as small dots.
- **Icons:** Lucide, 1.75 px stroke, 20 default, 24 in cards.
- **Buttons:** primary 48 h radius 12 brand fill white 15 / 600 · **large primary 56 h radius 14** for the hero · secondary 48 h radius 12 white fill 1 px border · text button 40 h brand.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 24, **no shadow**.
- **Status is never colour alone.** French copy throughout.
- **Never draw:** a hero image, an illustration, a photograph, an abstract shape, a map, a flag, mountains, people at laptops, a gradient, a shadow on a card, a testimonial, a counter, a logo wall, a cookie banner, a chat widget, a popup.

## Page structure, top to bottom

### 1. Header — 64 px, `#FFFFFF`, 1 px `#E4E7EC` bottom border, content width 1200

Left: wordmark — small geometric frontier mark 20 px + name, 17 / 600 `#111827`.
Centre-right, Body-M 15 / 500 `#667085`, 32 px apart: `Calculateurs ▾`  `Guides`  `Le relevé`  `Tarifs`.
Right: primary brand button 48 h `Suivre mes jours`.

### 2. Hero — 96 px top padding, 80 bottom, text only, left-aligned in a 640 px column

- H1 40 / 48 700 `#111827`: **Combien de jours de télétravail vous reste-t-il avant 40 % ?**
- Body-L 17 / 26 `#667085`, 20 below, max ~70 characters per line: *Depuis 2026, un frontalier résidant en France et employé en Suisse doit rester sous 40 % de télétravail annuel — et sous 49,9 % pour conserver sa sécurité sociale suisse. Ce site calcule votre situation et vous aide à en garder une trace datée.*
- 32 below, two actions side by side, 12 apart:
  - **Large primary 56 h radius 14**: `Calculer mes jours`
  - **Secondary 48 h radius 12**, vertically centred to the first: `Découvrir l'application`

The right half of the hero stays **empty canvas**. Whitespace is the correct answer; do not fill it with a graphic, a card, or a screenshot.

### 3. Three destination cards — one row, 3 columns, 24 px gaps, equal height

Each: white card radius 16, padding 24, 1 px border. At the top, a Lucide icon 24 `#173B63` inside a 44 × 44 `#EDF4FF` radius-12 square. Then H3 20 / 28 600 `#111827`, Body 15 / 22 `#667085`, and a text button 40 h brand Body-M with `arrow-right` 16 pinned to the bottom.

1. `calculator` — **Calculateur de télétravail**
   *Votre taux annualisé, les jours qu'il vous reste avant 40 % et avant 49,9 %. Trois champs, aucun compte.*
   `Ouvrir le calculateur`
2. `book-open` — **Comprendre les règles**
   *Sept guides : le seuil des 40 %, le seuil social de 49,9 %, les jours de mission, l'attestation employeur, le droit d'option LAMal/CMU.*
   `Lire les guides`
3. `smartphone` — **L'application**
   *Enregistrez vos journées en un geste — ou laissez l'application les détecter et vous les proposer. Exportez un relevé annuel horodaté.*
   `Découvrir l'application`

### 4. Band — **Pourquoi une trace datée** — 96 px top padding, 80 bottom, on the canvas (no card, no fill)

- H2 24 / 32 700 `#111827`, left-aligned to the grid.
- 40 below, three columns, 24 gaps. Each: a number in **Display 48 / 56 600 tabular `#D0D5DD`** (`01`, `02`, `03`) — large and pale, a typographic ornament rather than a figure — then H3 20 / 28 600 `#111827`, then Body 15 / 22 `#667085`.

`01` **Le seuil se joue sur l'année entière**
*Quelques jours de trop en novembre suffisent à faire basculer douze mois. Le calcul ne se fait pas au mois, mais sur l'ensemble de l'année.*

`02` **Un relevé reconstitué n'est pas une preuve**
*Un tableau rempli en décembre est une affirmation. Un relevé dont chaque journée porte sa date d'enregistrement est un document.*

`03` **L'attestation de votre employeur ne dit pas tout**
*Depuis 2026, votre employeur certifie un pourcentage. Votre propre relevé permet de le vérifier, et de le compléter pour les jours de mission.*

### 5. Trust band — a single white card, radius 16, padding 32, three columns inside separated by 1 px `#E4E7EC` vertical rules

Each column: Caption 13 / 18 500 `#667085` uppercase tracking 0.04 em, then Body 15 / 22 `#111827`, then a text button brand with `arrow-right`.

- **SOURCES** — *Chaque règle citée renvoie à son texte d'origine : avenant du 27 juin 2023, circulaire n° 45, accords amiables.* `Voir les sources`
- **RELECTURE** — *Les règles et les calculs ont été relus par un professionnel nommé sur cette page.* `Qui a relu`
- **DERNIÈRE VÉRIFICATION** — the date **`15.01.2027`** in H2 24 / 32 700 tabular `#111827`, then *Les seuils changent chaque année. Cette date est celle du dernier contrôle réglementaire.* `Recevoir les alertes`

### 6. Closing strip — 64 below, a white card radius 16, padding 32, one line

Body-L 17 / 26 `#111827` on the left — *Estimez votre situation en moins d'une minute.* — and on the right a primary brand button 48 h `Calculer mes jours`.

One CTA, repeated. No second offer, no newsletter block.

### 7. Footer — `#FFFFFF`, 1 px `#E4E7EC` top rule, 64 vertical padding, content width 1200

Four columns, Body 15 / 22 `#667085`, heads Body-M 15 / 500 `#111827`:

- **Outils** — Calculateur 40 %, Calculateur LAMal/CMU, Alertes e-mail
- **Guides** — Tous les guides, Règle des 40 %, Seuil social 49,9 %, Droit d'option
- **Le produit** — L'application, Le relevé annuel, Tarifs, À propos, Sources réglementaires
- **Légal** — Mentions légales, Confidentialité, CGU

Below, 32 down, one line Caption 13 / 18 `#98A2B3`: left *Informations à caractère général, sans valeur de conseil fiscal.* · right *Dernière vérification réglementaire : 15.01.2027*

## Rules for this page

- **No hero imagery of any kind.** The empty right half is deliberate. A stock illustration costs more credibility than it buys attention.
- **No social-proof theatre.** No testimonials, no star ratings, no « rejoint par 2 000 frontaliers », no logo wall, no counters.
- **No urgency devices.** No countdown, no « plus que X jours avant la déclaration », no banner.
- **One CTA, repeated.** `Calculer mes jours` appears twice, identical. The app is a card and a secondary action, never a competing primary — someone who has not calculated has no reason to install anything.
- **Brand blue** appears only on: the header CTA, the hero CTA, the three icon squares, the four text links, the closing CTA. Nowhere else.
- **No pricing on this page**; `Tarifs` in the nav is the only route to it.
- No cookie banner, no chat widget, no popup, no exit-intent overlay, no email modal.
- French only, copy exactly as written. French number convention; Swiss dot dates; tabular numerals.

Deliver one high-fidelity static mockup of the full page, top to bottom.
