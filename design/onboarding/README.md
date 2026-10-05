# Onboarding and sign-in — design reference

Eleven screens, approved by the operator on the canvas "Mon Relevé — connexion
et premiers pas", exported as they are on 05.10.2026.

These are **HTML mock-ups, not code to port**. The app builds them in Jetpack
Compose with Material 3 inside FrontierTheme. Take from them:

- **the order of the screens and what each contains;**
- **the copy, word for word** — it moves into `fr/`;
- **the layout and hierarchy.**

Do not take literal colours, pixel sizes or radii from the HTML: every value
comes from the design tokens (DESIGN-SYSTEM.md). Where the mock-up shows a
value with no token, use the nearest token and report it.

| File | Screen |
|---|---|
| Main.dc.html | Bienvenue |
| Connexion.dc.html | Connexion — email |
| Code.dc.html | Vérifiez votre messagerie — the 6-digit code |
| Nom.dc.html | Étape 1 — Votre nom |
| Canton.dc.html | Étape 2 — Canton de votre employeur |
| Taux.dc.html | Étape 3 — Votre taux d'activité |
| Methode.dc.html | Étape 4 — Méthode de décompte |
| Periode.dc.html | Étape 5 — Toute l'année chez cet employeur ? |
| Mode.dc.html | Étape 6 — Comment enregistrer vos journées ? |
| Rappel.dc.html | Étape 7 — Un rappel le soir ? |
| Pret.dc.html | Tout est prêt — the relevé preview |

Open any file's visible text to read its copy. The example person throughout
(Camille Martin, Genève, 100 %, started 01.07.2026) is sample data, not copy.
