# FD10 — États : chargement, vide, erreur, hors connexion (app, Android 360 dp)

Frontier Work series. Paste everything below into Claude Design as a single prompt.

---

Design the **state screens** of a signed-in mobile app for cross-border workers living in France and employed in Switzerland. The app records where the user worked each day and produces an annual tax document from that record.

These are the screens nobody demos and everybody meets. In this product they carry unusual weight, because the user's real fear is **losing a day of evidence**. Every state below must answer, without being asked: *is my record safe?*

Deliver **eight frames in a 4 × 2 grid**, 48 px apart, on a `#F7F8FA` canvas, each **360 × 800 dp** (Android baseline; the iOS versions differ only in chrome and are not needed on this sheet). Captions above each in Caption 13 / 18 `#98A2B3`, uppercase, tracking 0.04 em:

`A — CHARGEMENT` · `B — HORS CONNEXION` · `C — RELEVÉ VIDE` · `D — CALENDRIER VIDE`
`E — ERREUR DE CHARGEMENT` · `F — EXPORT INDISPONIBLE` · `G — DÉTECTION INTERROMPUE` · `H — MISE À JOUR REQUISE`

## Design system — Frontier Work v1.0. Non-negotiable.

- **Font: Inter**; **tabular numerals** for figures, dates and times.
- **Type:** Display 48 / 56 600 · H2 24 / 32 700 · H3 20 / 28 600 · Body 15 / 22 · Body-M 15 / 22 500 · Caption 13 / 18.
- **Spacing:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48. **Side padding 20** → content 320 dp.
- **Radius — tokens only:** buttons 12 · large primary 14 · card 16 · status card 20 · banner 12 · **skeleton 8** · sheet 24 top · chips and bars 999.
- **Colour — exactly these:** Canvas `#F7F8FA` · Card `#FFFFFF` · Text `#111827` / `#667085` / `#98A2B3` / disabled `#C4C8D0` · Border `#E4E7EC` · strong `#D0D5DD` · Brand `#173B63` · France `#315FA8` · Switzerland `#D84B4B` · Success `#15803D` on `#EAF7EE` · Warning `#B7791F` on `#FFF7E6` · Error `#C53030` on `#FDECEC` · Info `#2563EB` on `#EDF4FF`. Warning **text** is `#111827`.
- **Skeleton:** `#E4E7EC` blocks, radius 8, subtle shimmer implied — **never a spinner for content, never a progress bar, never a percentage.**
- **Offline banner:** 36 tall, full width, above the content.
- **Buttons:** large primary 56 h radius 14 · secondary 48 h radius 12 white fill 1 px border · text button 40 h brand. Targets ≥ 48 dp.
- **Cards:** white, 1 px `#E4E7EC`, radius 16, padding 16, no shadow. Status card radius 20, padding 24.
- **Bottom sheet:** radius 24 top, drag indicator 36 × 4 `#D0D5DD`, padding 20, scrim 40 %.
- **Bottom navigation:** 4 items, 80 dp incl. gesture bar, active brand — present in every frame **except H**.
- **Status is never colour alone.** French copy throughout.
- **Never draw:** an illustration, a mascot, an empty-state graphic, a centred icon as hero, a spinner, an error code, a sad face, a map, a shadow on a card.

Platform chrome: Android status bar on the canvas with dark icons; no app bar; gesture bar inside the navigation.

---

## A — CHARGEMENT

First open of *Aujourd'hui* while entries load. **Skeletons, never a spinner**: a skeleton says "this is what is coming".

The real layout, with `#E4E7EC` radius-8 blocks in the exact positions of the content:

- Greeting header: a 140 × 20 block, then a 110 × 13 block beneath.
- Mode chip position: a 160 × 32 pill (radius 999).
- The status card, drawn as a real white card radius 20 with skeletons inside: 120 × 13 (caption), 150 × 44 (hero), 110 × 13, then 240 × 17, 200 × 13, and a full-width 8-tall pill for the rail.
- Log block: a 200 × 15 block, then three full-width 56-tall radius-14 blocks, 8 apart.

No text anywhere, no `--` placeholder, no « Chargement… », no progress bar. The bottom navigation is fully rendered — the shell never waits for the content.

---

## B — HORS CONNEXION

The user logged a day in a tunnel. Normal for this audience — **nothing here is red, nothing is alarming.**

- Directly under the status bar, the **offline banner**: 36 tall, full width, `#FFFFFF`, 1 px `#E4E7EC` bottom border, Lucide `wifi-off` 16 `#667085`, Body-M 15 / 500 `#667085` **Hors connexion**, then Caption 13 / 18 `#98A2B3` *— synchronisation automatique au retour du réseau*.
- The normal Aujourd'hui content follows — greeting, mode chip, the **status card with `18,33 %` in full green**, the rail. **Figures are not greyed or hidden**; they were computed on the device and remain true.
- The confirmation banner for today, radius 12, **`#F7F8FA` fill, 1 px `#E4E7EC` border, 4 px `#D0D5DD` grey accent** inside the left edge (not green — the server has not confirmed it yet), Lucide `clock` 20 `#667085`:
  - Line 1: 8 px dot `#315FA8`, Body-M 15 / 500 `#111827` **Domicile** — *en attente de synchronisation* (400, `#667085`)
  - Caption 13 / 18 `#667085`, tabular: *Enregistrée sur cet appareil le 18.06.2027 à 18:03.*
  - Caption 13 / 18 `#667085`: *L'horodatage définitif sera attribué à la synchronisation.*
  - Right edge: text button `Modifier`

That last caption is the honest statement of how the evidence works. It is shown, not hidden.

---

## C — RELEVÉ VIDE

The *Relevé* tab on the first day of use. The screen keeps its real structure and states the absence plainly.

- Title row as normal: **Relevé annuel** + the `2027` year chip.
- 48 below, a white card radius 16, padding 20, **left-aligned text** (not centred in the middle of the screen):
  - H3 20 / 28 600 `#111827`: **Aucune saisie pour 2027**
  - Body 15 / 22 `#667085`, 8 below: *Votre relevé se remplit à mesure que vous enregistrez vos journées. Il pourra être exporté dès la première saisie.*
  - 20 below, **large primary 56 h radius 14**, full width: `Enregistrer aujourd'hui`
- 24 below the card, Caption 13 / 18 `#98A2B3`: *Ce document ne constitue pas un conseil fiscal.*

No illustration, no icon hero, no encouraging exclamation mark.

---

## D — CALENDRIER VIDE

A month with nothing recorded. **The grid is never replaced by an empty state** — the calendar is the interface, and hiding it removes the way to fix the problem.

- Month navigation **Juin 2027**, weekday header, the full 7 × 5 grid inside its white card as normal: day numbers tabular, weekends `#98A2B3`, **every weekday cell with a `#D0D5DD` bottom bar and `#F7F8FA` fill** (the *non renseigné* state), no dots, no letters. Today (18) keeps its `#EDF4FF` fill and brand number.
- The legend, as normal.
- Under the card, a banner radius 12 `#FFF7E6`, 4 px `#B7791F` accent, Lucide `calendar-x` 20 `#B7791F`: Body-M 15 / 500 `#111827` **Aucune journée enregistrée en juin**, then a text link brand with `arrow-right` 16: `Commencer par aujourd'hui`

---

## E — ERREUR DE CHARGEMENT

The *Relevé* could not be fetched. First job: say the record is safe. Second: offer a way forward.

- Title row as normal.
- 48 below, a white card radius 16, padding 20, left-aligned:
  - H3 20 / 28 600 `#111827`: **Impossible de charger votre relevé**
  - Body 15 / 22 `#111827`, 8 below: **Vos saisies ne sont pas perdues.** *Elles sont conservées sur cet appareil et sur nos serveurs.*
  - Body 15 / 22 `#667085`: *Le calcul du relevé se fait en ligne. Réessayez dans un instant.*
  - 20 below, two actions stacked 8 apart, full width: **large primary 56 h radius 14** `Réessayer` · **secondary 48 h radius 12** `Voir la version enregistrée`
  - Beneath, Caption 13 / 18 `#98A2B3`, tabular: *Calculée le 12.06.2027.*

No error code, no red banner, no « oups ».

---

## F — EXPORT INDISPONIBLE

The user tapped *Exporter en PDF* with no connection. The *Relevé* behind a 40 % scrim; a bottom sheet open — radius 24, drag indicator, padding 20.

- H3 20 / 28 600: **L'export nécessite une connexion**
- Body 15 / 22 `#111827`, 12 below: *Le document est généré sur nos serveurs afin que les horodatages qui y figurent ne dépendent pas de l'horloge de votre téléphone.*
- Body 15 / 22 `#667085`: *Réessayez une fois connecté. Votre relevé reste consultable dans l'application.*
- Actions stacked 8 apart: **large primary 56 h radius 14** `Réessayer` · **secondary 48 h radius 12** `Fermer`

The explanation is the point: the constraint is annoying, and its reason is the product's whole value.

---

## G — DÉTECTION INTERROMPUE

The user granted location earlier; the system or the user later revoked it. **The one case where the app may raise the permission again** — because the user had already chosen automatic mode — and it asks once, then stops.

On *Aujourd'hui*, directly under the mode chip:

- A banner radius 12 `#FFF7E6`, 4 px `#B7791F` accent, 16 padding, Lucide `radar` 20 `#B7791F` with a small slash:
  - Body-M 15 / 500 `#111827`: **La détection est interrompue**
  - Caption 13 / 18 `#667085`: *L'autorisation de localisation a été retirée dans les réglages du système. Vos journées déjà enregistrées sont conservées.*
  - 12 below, inside the banner, two **secondary 44 h** buttons side by side, 8 apart, each half width: `Rouvrir les réglages` · `Passer en manuel`
- Beneath the banner, the status card and the **manual three-button log**, fully usable — the day can still be recorded right now.

Neither action is brand-filled. The app has no preference between them.

---

## H — MISE À JOUR REQUISE

The installed version can no longer talk to the API. Full screen, **no bottom navigation**, no dismiss, no back — but calm.

- 96 below the status bar, left-aligned within the gutters:
  - Lucide `download` 32 `#173B63` in a 56 × 56 `#EDF4FF` radius-16 square.
  - 24 below, H2 24 / 32 700 `#111827`: **Une mise à jour est nécessaire**
  - Body 15 / 22 `#111827`, 12 below: *Cette version de l'application ne peut plus communiquer avec nos serveurs.*
  - Body 15 / 22 `#111827`, 12 below: **Vos saisies ne sont pas perdues.** *Celles enregistrées sur cet appareil seront synchronisées après la mise à jour.*
- 32 below, **large primary 56 h radius 14**, full width: `Mettre à jour`
- Beneath, Caption 13 / 18 `#98A2B3`, tabular: *Version installée : 1.0.3 (41)*

---

## Rules for this sheet

- **Every state says whether the record is safe.** Loading is the only exception, because nothing is at risk yet. B, E and H carry that sentence in `#111827`, never in helper grey.
- **Skeletons, never spinners**, for content. No progress bars, no percentages, no « veuillez patienter ».
- **No illustrations, no mascots, no centred icon heroes.** Empty and error states are left-aligned text in a card and a button — the one icon square in H is the only exception, and it is small and brand-coloured, not decorative.
- **No blame, no cuteness, no exclamation marks.** Never « oups », « aïe », « quelque chose s'est mal passé », no error codes.
- **Offline is normal, not an error.** B keeps every figure visible, uses the 36 dp Frontier offline banner in neutral grey, and marks the pending entry with a grey accent — not green (unconfirmed), not amber (not a problem).
- **A pending entry is a first-class state, not a toast.** It stays on screen until the server confirms and says which timestamp is provisional.
- **Never remove the way out.** The calendar keeps its grid, the error keeps a retry and a dated cached fallback, the interrupted detection keeps the manual log usable.
- Status is never colour alone: every state carries its words.
- French only, copy exactly as written. Swiss dot dates, 24-hour times, tabular numerals.

Deliver one high-fidelity static sheet with all eight frames in a 4 × 2 grid.
