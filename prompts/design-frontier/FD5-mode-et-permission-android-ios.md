# FD5 — Choix du mode et autorisation de localisation (app, Android 360 dp + iOS 390 pt)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the three screens where a signed-in user of a mobile app for cross-border workers (living in France, employed in Switzerland) chooses how their days are recorded. The app produces an annual tax document from the record.

Two modes, and this sequence must present them as **genuine equals**:

- **Saisie manuelle** — the user taps in where they worked, one gesture a day. No location data at all.
- **Détection automatique** — the phone detects the working day from location and **proposes** it each evening; the user confirms or corrects. The app never records a day by itself.

Deliver **six frames in a 3 × 2 grid**, 48 px apart, on a `#F7F8FA` canvas:

- **Top row — Android, 360 × 800 dp:** `A1 — CHOIX DU MODE` · `A2 — AVANT L'AUTORISATION` · `A3 — AUTORISATION REFUSÉE`
- **Bottom row — iOS, 390 × 844 pt:** `I1` · `I2` · `I3`, same content.

Captions above each frame in Caption 13 / 18 `#98A2B3`, uppercase, tracking 0.04 em.

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; tabular numerals for dates.
- **Type:** H1 32 / 40 700 · H2 24 / 32 700 · H3 20 / 28 600 · Body-L 17 / 26 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18.
- **Spacing:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40. **Side padding 20.** Bottom padding 24 above the safe area (these screens have no bottom navigation).
- **Radius — tokens only:** buttons 12 · large primary 14 · card 16 · banner 12 · radio 999.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` · Border `#E4E7EC` · strong `#D0D5DD` · Brand `#173B63` · Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Info `#2563EB` on `#EDF4FF`.
- **Icons:** Lucide, 1.75 px stroke, 20 default, 24 for row icons.
- **Buttons:** large primary 56 h radius 14 brand fill white 15 / 600 · secondary 48 h radius 12 white fill 1 px `#E4E7EC` border `#111827` label · text button 40 h brand. Targets ≥ 48 dp / 44 pt.
- **Radio:** 22 outer, 2 px border `#D0D5DD`, selected: brand border + 10 px brand inner disc; 44 × 44 tap area.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 16 (20 for the selection cards), no shadow. **Selected card: 2 px `#173B63` border.**
- **Status is never colour alone.** French copy throughout.
- **Never draw:** a map, a globe, a pin, a radar sweep, a crosshair, a satellite, an illustration, a gradient, a shadow on a card, a flag emoji, an avatar, a "recommandé" tag, a lock icon, a star.

## Platform chrome

**Android:** status bar on the canvas, dark icons. Top app bar 56 dp on the canvas colour: Lucide `arrow-left` 24 in a 48 × 48 tap area at the left, screen title Body-M 15 / 500 `#111827` beside it. Gesture bar 24 dp at the bottom.
**iOS:** status bar with Dynamic Island, dark icons. Navigation bar 44 pt: Lucide `chevron-left` 24 + `Retour` in brand at the left, screen title Body-M 15 / 500 `#111827` centred. Home indicator area 34 pt at the bottom.

These are linear setup screens — **no bottom navigation, no skip link, no progress dots**. The back control is the only way out.

---

## Frame 1 — CHOIX DU MODE (A1 / I1)

App bar title: `Mode d'enregistrement`

- H2 24 / 32 700 `#111827`, 24 below the app bar: **Comment souhaitez-vous enregistrer vos journées ?**
- Body 15 / 22 `#667085`, 8 below: *Les deux modes produisent exactement le même relevé annuel.*

Two selection cards, full width, 16 apart, radius 16, padding 20, white. Each card: a radio at the top-left, content to its right with a 12 px gap.

**Card 1 — Saisie manuelle — selected by default.** 2 px `#173B63` border, radio selected.
- H3 20 / 28 600 `#111827`: **Saisie manuelle**
- Body 15 / 22 `#111827`, 8 below: *Vous indiquez vous-même où vous avez travaillé, en un geste par jour.*
- Caption 13 / 18 `#667085`, 8 below, with Lucide `hand` 16 px `#667085`: *Aucune donnée de localisation n'est utilisée.*

**Card 2 — Détection automatique — unselected.** 1 px `#E4E7EC` border, radio empty.
- H3 20 / 28 600 `#111827`: **Détection automatique**
- Body 15 / 22 `#111827`: *L'application détecte votre journée et vous la propose le soir. Vous confirmez ou vous corrigez.*
- Caption 13 / 18 `#667085`, with Lucide `radar` 16 px `#667085`: *Nécessite l'accès à votre position, y compris en arrière-plan.*

The two cards are **identical in size, padding, type weight and contrast**. The only differences are the border and the radio. Neither carries a tag, highlight, star, lock, or any styling that makes it look like the better answer.

Below the cards, 24 down, Caption 13 / 18 `#667085`: *Vous pouvez changer de mode à tout moment. Les journées déjà enregistrées ne changent pas.*

Pinned to the bottom, full width: **large primary 56 h radius 14** `Continuer`.

---

## Frame 2 — AVANT L'AUTORISATION (A2 / I2)

Shown after choosing automatic mode, **before** the OS permission dialog. Do not draw the OS dialog.

App bar title: `Autorisation de localisation`

- H2 24 / 32 700, 24 below the app bar: **Pourquoi l'application a besoin de votre position**

Three rows, 24 apart, each: Lucide icon 24 px `#173B63` in a 40 × 40 `#EDF4FF` rounded-12 square at the left, text to its right with a 16 px gap.

1. `scan-line` — Body-M 15 / 500 `#111827` **Ce que l'application fait**
   Body 15 / 22 `#667085`: *Elle compare votre position à la frontière pendant vos heures de travail et en déduit une seule information par jour : Suisse ou domicile.*
2. `database` — **Ce qu'elle enregistre**
   *Une conclusion par jour. Ni trajet, ni adresse, ni historique de vos déplacements.*
3. `eye-off` — **Ce qu'elle ne fait jamais**
   *Aucun partage avec votre employeur ni avec une administration. Vous seul exportez votre relevé.*

24 below, an **info banner**: full width, radius 12, `#EDF4FF` fill, 4 px `#2563EB` accent bar on the left edge inside the radius, 16 padding, Lucide `info` 20 `#2563EB`, Body 15 / 22 `#111827`:
*Le système vous demandera d'abord l'accès pendant l'utilisation de l'application, puis l'accès en arrière-plan. Les deux sont nécessaires pour que la détection fonctionne quand l'application est fermée.*

Pinned to the bottom, stacked 8 apart, full width:
- **Large primary 56 h radius 14**: `Autoriser la localisation`
- **Secondary 48 h radius 12**: `Rester en saisie manuelle`

Under them, 12 down, Caption 13 / 18 `#667085` with the last words as a brand link: *Détail des données traitées dans la* `politique de confidentialité`*.*

---

## Frame 3 — AUTORISATION REFUSÉE (A3 / I3)

The user declined. A legitimate choice — the screen must not read as an error or a punishment.

App bar title: `Mode d'enregistrement`

- A **neutral banner** at the top of the content: full width, radius 12, `#FFFFFF` fill, 1 px `#E4E7EC` border, **4 px `#D0D5DD` accent bar** on the left edge — grey, not amber, not red — 16 padding, Lucide `hand` 20 `#667085`.
  - Body-M 15 / 500 `#111827`: **La détection automatique n'est pas disponible.**
  - Body 15 / 22 `#667085`: *L'accès à votre position a été refusé. Vous êtes en saisie manuelle.*
- 32 below, H3 20 / 28 600 `#111827`: **La saisie manuelle produit exactement le même relevé annuel**
- Body 15 / 22 `#667085`, 8 below: *Un geste par jour, et chaque journée est horodatée de la même façon.*
- 32 below, a text button 40 h brand, left-aligned, Lucide `external-link` 16: `Ouvrir les réglages du système`

Pinned to the bottom, full width: **large primary 56 h radius 14** `Continuer en saisie manuelle`.

Nothing else. No second appeal, no « êtes-vous sûr », no list of what the user is missing.

---

## Rules for this sequence

- **No dark patterns.** The manual option is never smaller, greyer, lower-contrast, lower on the screen, or harder to tap than the automatic one. The declining action is a real secondary button, not a faint text link.
- **Explain once, ask once.** If refused, the app never asks again — no later banner, no periodic prompt, no red dot.
- **Manual mode is a peer, not a downgrade.** No « recommandé », no « limité », no feature list with crosses.
- **No map, ever.** No globe, pin, route, radar sweep, crosshair, or satellite. The `radar` and `scan-line` Lucide glyphs at 16–24 px are the only location imagery permitted, and only as line icons.
- **No scare copy.** Nothing about audits, penalties or risk is used to obtain the permission.
- **Brand blue** appears on the selected card border, the radio, the row-icon squares, `Continuer`, `Autoriser la localisation`, the two links, the iOS back control, and nowhere else.
- French only, copy exactly as written.

Deliver one high-fidelity static sheet with the six frames in a 3 × 2 grid.
