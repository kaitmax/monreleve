// web/lib/fr/workbench.ts
//
// The workbench is French too (FW8 increment 5). Its section headings and
// state names are user-facing strings and live here like every other, even
// though only a developer will read them - the rule in SPEC section 5 has no
// "internal pages" exemption, and react/jsx-no-literals would not accept one
// anyway.
//
// TODO-COPY: developer-facing wording, not reviewed.

export const WORKBENCH = {
  intro:
    'Chaque composant dans chacun de ses états. Cette page est hors sitemap et ' +
    'non indexée.',

  rateDisplay: {
    title: 'RateDisplay',
    compliant: 'Bande conforme',
    exposure: 'Bande exposition fiscale',
    social: 'Bande sécurité sociale',
    divergent: 'Deux taux — Genève cas (c)',
  },
} as const;
