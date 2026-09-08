// web/lib/fr/workbench.ts
//
// The workbench is French too (FW8 increment 5). Its headings and state names
// are user-facing strings and live here like every other, even though only a
// developer will read them - SPEC section 5 has no "internal pages"
// exemption, and react/jsx-no-literals would not accept one anyway.
//
// The state names are DELIBERATELY NOT the product's own labels. ZoneBadge's
// "Sous les deux seuils" and the rail's "Imposition Suisse" describe what the
// component is saying; these describe which state it is IN, and a screenshot
// review needs the second. Borrowing the first would also put the copy under
// test in two roles at once, so a copy change would move the caption that is
// supposed to identify the specimen.
//
// TODO-COPY: developer-facing wording, not reviewed.

export const WORKBENCH = {
  intro:
    'Chaque composant dans chacun de ses états. Cette page est hors sitemap et ' +
    'non indexée.',

  rail: {
    title: 'ThresholdRail',
    inlineCompliant: 'Inline — bande conforme',
    inlineExposure: 'Inline — bande exposition fiscale',
    inlineSocial: 'Inline — bande sécurité sociale',
    compactCompliant: 'Compact — bande conforme',
    compactExposure: 'Compact — bande exposition fiscale',
    compactSocial: 'Compact — bande sécurité sociale',
    unavailable: 'Taux indisponible',
  },

  badge: {
    title: 'ZoneBadge',
    compliant: 'Statut conforme',
    mission: 'Statut exposition missions',
    regime: 'Statut régime perdu',
    social: 'Statut bascule sociale',
  },

  rateDisplay: {
    title: 'RateDisplay',
    compliant: 'Bande conforme',
    exposure: 'Bande exposition fiscale',
    social: 'Bande sécurité sociale',
    divergent: 'Deux taux — Genève cas (c)',
  },

  metric: {
    title: 'MetricTile',
    positive: 'Marge positive',
    negative: 'Marge dépassée',
    label: 'Jours restants',
  },

  legal: {
    title: 'LegalNote',
    standing: 'Mention légale permanente',
  },
} as const;
