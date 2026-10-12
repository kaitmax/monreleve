# Home page — design reference

Approved by the operator on the canvas "Mon Relevé — page d'accueil",
exported 11.10.2026. It replaces FW34's earlier brief.

- `Desktop.dc.html` — the page at desktop width.
- `Mobile.dc.html` — the same page at phone width, WITH THE BURGER MENU the
  operator asked for.

These are **HTML mock-ups, not code to port**. The site builds them in
Next.js with its own components and tokens. Take from them the order of the
sections, what each contains, the hierarchy and **the copy, word for word**
(it moves into `lib/fr`). Never take literal colours, pixel sizes or radii:
every value comes from the design tokens.

What is **sample data, not copy**: the phone card's figures (15,83 %, 58,
81,5 — the site computes them from the engine), "Camille Martin" and the
verification code on the relevé thumbnail, "Mardi 7 octobre" in the
notification. The lake illustration stands in for a licensed photo.

The page shows the site **before the Play release** ("Bientôt sur Android",
the relevé in the future tense). The product-state flags switch those
wordings at launch.
