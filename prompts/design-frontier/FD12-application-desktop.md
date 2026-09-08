# FD12 — Page « L'application » (web, desktop 1440 px)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the app landing page of a French-language public website for cross-border workers living in France and employed in Switzerland. URL `/application`. Desktop viewport, 1440 px wide.

This page has one job: convince someone who has just used the free calculator to install a mobile app that will ask for **background location permission**. That is a large ask from a stranger, on a subject with money attached. The page therefore leads with what the app does *not* do, and states the privacy position **before** the download links.

Two logging modes, presented as genuine equals:

- **Saisie manuelle** — the user taps in where they worked, one gesture a day. No location data at all.
- **Détection automatique** — the phone determines the working day from location and **proposes** it each evening; the user confirms or corrects. The app never records a day by itself.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; **tabular numerals** for figures and dates.
- **Type:** H1 40 / 48 700 (hero) · H2 24 / 32 700 · H3 20 / 28 600 · Body-L 17 / 26 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18.
- **Spacing:** 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 80 · 96. Desktop side padding 32, content max 1200, centred.
- **Radius — tokens only:** buttons 12 · large primary 14 · card 16 · status card 20 · badge 8 · chips 999. **Exception:** the official Google Play and App Store badges are used unmodified, as their owners require.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` · Border `#E4E7EC` · strong `#D0D5DD` · Brand `#173B63` · France `#315FA8` · Switzerland `#D84B4B` · Success `#15803D` on `#EAF7EE` · Info `#2563EB` on `#EDF4FF`.
- **Icons:** Lucide, 1.75 px stroke, 24 in feature squares.
- **Buttons:** primary 48 h radius 12 · secondary 48 h radius 12 white fill 1 px border · text button 40 h brand.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 24, no shadow.
- **Status is never colour alone.** French copy throughout.
- **Never draw:** a floating or tilted phone mockup, a hand holding a phone, a map, a pin, a globe, a radar sweep, a crosshair, a flag emoji, an illustration, a gradient, a shadow on a card, star ratings, download counts, press logos, a cookie banner, a chat widget, a sticky download bar.

## Page structure, top to bottom

### 1. Header — 64 px, `#FFFFFF`, 1 px bottom border, content 1200

Wordmark (mark + name, 17 / 600 `#111827`); nav Body-M `#667085`: `Calculateurs ▾`  `Guides`  `Le relevé`  `Tarifs`; right: primary brand button `Suivre mes jours`.

### 2. Hero — 96 top padding; text left in a 600 px column; one flat screenshot right

Left:
- H1 40 / 48 700 `#111827`: **Enregistrez vos journées. Exportez un relevé daté.**
- Body-L 17 / 26 `#667085`, 20 below: *Une journée se note en un geste — ou l'application la détecte et vous la propose le soir. Chaque saisie porte un horodatage attribué par le serveur, et votre relevé annuel s'exporte en PDF.*
- 32 below, the **official Google Play badge** and the **official App Store badge** side by side, each 48 px tall, unmodified, 12 apart.
- Beneath, 16 down, a text button brand with `arrow-right`: `Voir à quoi ressemble le relevé`
- Beneath, Caption 13 / 18 `#667085`: *Android et iOS. Gratuit en 2027.*

Right, 520 px wide: **one flat screenshot** of the app's *Aujourd'hui* screen inside a white card radius 16 with a 1 px border, padding 16 — **no device frame, no notch, no shadow, no tilt, no reflection**, sitting flat on the page. The screenshot content: the greeting *Bonjour Camille*, a status card with **18,33 %** in green at Display size and an 8 px rail with two ticks, and beneath it a proposal card reading **Domicile** with a France-blue dot, a *Détection fiable* line with three green segments, and two stacked buttons `Confirmer` (brand) and `Corriger`.

### 3. Section — **Deux façons d'enregistrer, un seul relevé** — 96 top padding

H2 24 / 32 700, then Body 15 / 22 `#667085`: *Vous choisissez à l'installation, et vous pouvez changer à tout moment. Les deux modes produisent exactement le même document.*

Two cards side by side, **equal width, 24 gap**, white, radius 16, padding 24, **identical height, type weights and contrast**. Neither is highlighted, tagged, badged, or ordered as the better choice. Each opens with a Lucide icon 24 `#667085` (not brand) in a 44 × 44 `#F7F8FA` radius-12 square.

**Card A — `hand` — Saisie manuelle**
- H3 20 / 28 600
- Body 15 / 22 `#111827`: *Trois boutons sur l'écran d'accueil : en Suisse, à domicile, en mission. Un geste par jour, et c'est enregistré.*
- 1 px rule, then three lines Body 15 / 22 `#667085`, each with Lucide `check` 16 `#15803D`:
  - *Aucune donnée de localisation n'est utilisée*
  - *Aucune autorisation à accorder*
  - *Fonctionne hors connexion*

**Card B — `radar` — Détection automatique**
- H3 20 / 28 600
- Body 15 / 22 `#111827`: *L'application compare votre position à la frontière pendant vos heures de travail et vous propose la journée le soir. Vous confirmez ou vous corrigez.*
- 1 px rule, then:
  - *Rien n'est enregistré sans votre confirmation*
  - *Les jours de mission restent saisis à la main*
  - *Nécessite l'accès à la position, y compris en arrière-plan*

Both cards use the same green `check` glyph for every line — including the last line of card B. A requirement is not a drawback.

Below, 24 down, Body 15 / 22 `#667085`, centred: *Le relevé indique, pour chaque journée, si elle a été saisie à la main, détectée puis confirmée, ou corrigée par vous.*

### 4. Band — **Ce que l'application ne fait pas** — 96 top padding, on the canvas

**The most important section on the page.** It comes before any further argument for installing.

- H2 24 / 32 700 `#111827`.
- 40 below, four columns, 24 gaps. Each: a Lucide icon 24 `#173B63` in a 44 × 44 `#EDF4FF` radius-12 square, then H3 20 / 28 600, then Body 15 / 22 `#667085`.

`map-pin-off` **Elle n'enregistre aucune coordonnée**
*La position est comparée à la frontière sur votre téléphone, puis immédiatement oubliée. Seule une conclusion par jour est conservée : Suisse ou domicile.*

`route-off` **Elle ne garde aucun historique de déplacements**
*Ni trajet, ni adresse, ni lieu de travail. Il n'existe aucune carte de vos mouvements, ni dans l'application, ni sur nos serveurs.*

`eye-off` **Elle ne partage rien**
*Ni avec votre employeur, ni avec une administration, ni avec un tiers. Vous êtes seul à exporter votre relevé.*

`hand` **Elle n'écrit jamais une journée seule**
*Une journée détectée reste une proposition tant que vous ne l'avez pas confirmée. Sans confirmation, la journée reste non renseignée.*

Below the columns, 32 down, a text button brand with `arrow-right`: `Lire la politique de confidentialité`

### 5. Section — **Ce que vous obtenez** — 96 top padding

Left, 560 px:
- H2 24 / 32 700: **Le relevé annuel de télétravail**
- Body-L 17 / 26 `#667085`: *Un document A4 en français, exportable en PDF et en CSV, que vous pouvez transmettre à votre fiduciaire ou conserver en cas de contrôle.*
- A list, Body 15 / 22 `#111827`, each line with Lucide `check` 16 `#15803D`:
  - *Jours ouvrés, jours en Suisse, télétravail, missions*
  - *Taux annualisé et position par rapport aux seuils de 40 % et 49,9 %*
  - *Détail mensuel et détail de chaque saisie*
  - *Pour chaque journée : son horodatage d'enregistrement et son origine*
- Text button brand: `Voir le relevé en détail`

Right, 480 px: **one flat screenshot** of the exported PDF — a white A4-proportioned rectangle, 1 px `#E4E7EC` border, **no shadow, no page curl, no stack effect**. Its content: a black document title, a small identification table, four bordered figure cells, a green percentage with a thin rail, and a monthly table with hairline rules and tiny country dots.

### 6. Band — **Comment ça se passe** — 96 top padding, on the canvas

Three columns, 24 gaps. Each: Display 48 / 56 600 tabular **`#D0D5DD`** (`01` `02` `03`), then H3 20 / 28 600, then Body 15 / 22 `#667085`.

`01` **Vous installez et vous répondez à quatre questions**
*Canton, taux d'activité, méthode de décompte, début d'activité. Si vous venez du calculateur, elles sont déjà pré-remplies.*

`02` **Vous notez vos journées**
*Un geste par jour, ou une confirmation le soir. Un seul rappel quotidien, à l'heure que vous choisissez.*

`03` **Vous exportez votre relevé**
*À la clôture de l'année, ou à tout moment en version provisoire.*

### 7. Section — **Questions fréquentes** — 96 top padding, 760 px column, left-aligned

H2, then an accordion inside a white card radius 16, padding 0: rows 56 tall, 1 px `#E4E7EC` rules, question Body-M 15 / 500 `#111827` at 24 padding, `chevron-down` 20 `#667085` at the right. **The first row is open**, its answer Body 15 / 22 `#667085` with 24 padding; the rest closed.

1. **L'application fonctionne-t-elle sans autoriser la localisation ?** *(open)* — *Oui. Le mode manuel est complet : mêmes écrans, même calcul, même relevé annuel. Aucune fonction n'est réservée au mode automatique, et l'application ne vous redemandera pas l'autorisation si vous l'avez refusée.*
2. **Mes déplacements sont-ils enregistrés quelque part ?**
3. **Mon employeur peut-il voir mes journées ?**
4. **Les jours de mission sont-ils détectés automatiquement ?**
5. **Que se passe-t-il si je change de téléphone ?**
6. **L'application est-elle disponible sur iPhone ?**
7. **L'application est-elle payante ?**

### 8. Closing strip — 64 below, a white card radius 16, padding 32, one line

Body-L 17 / 26 `#111827` left — *Commencez par calculer votre situation actuelle.* — and a primary brand button 48 h right: `Ouvrir le calculateur`.

The last thing on the page sends the visitor to the free tool, not to the stores.

### 9. Footer — `#FFFFFF`, 1 px top rule, 64 padding

Four columns, Body 15 / 22 `#667085`, heads Body-M `#111827`:
**Outils** — Calculateur 40 %, Calculateur LAMal/CMU, Alertes e-mail · **Guides** — Tous les guides, Règle des 40 %, Seuil social 49,9 %, Droit d'option · **Le produit** — L'application, Le relevé annuel, Tarifs, À propos, Sources réglementaires · **Légal** — Mentions légales, Confidentialité, CGU

Below, 32 down, Caption 13 / 18 `#98A2B3`: left *Informations à caractère général, sans valeur de conseil fiscal.* · right *Dernière vérification réglementaire : 15.01.2027*

## Rules for this page

- **No dark patterns on the mode comparison.** Same size, same weight, same contrast, same grey icon squares, same green check glyphs. No « recommandé », no brand highlight, no lock icon on the manual card, no feature table with crosses.
- **The privacy band is not a footnote.** Full band, before the closing argument, same type sizes as everything else — and its icon squares are the only ones on the page in brand blue.
- **No fear-based copy.** Nothing about audits, penalties or risk is used to drive an install.
- **No app-store theatre.** No ratings, no download counts, no review quotes, no press logos.
- **Exactly two screenshots**, both flat, bordered, in cards. No device frame anywhere.
- **Brand blue** appears only on the header CTA, the four privacy icon squares, the text links, `Confirmer` inside the screenshot, and the closing CTA.
- French only, copy exactly as written.

Deliver one high-fidelity static mockup of the full page, top to bottom.
