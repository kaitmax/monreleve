// web/lib/fr/statuses.ts
//
// French copy for the four badge states (SPEC 6.2). Every user-facing string
// lives in lib/fr; lib/ui/core/zones.ts references this and adds only the
// presentation metadata - icon name and colour token.
//
// TODO-COPY: written to be realistic rather than final, per tasks/plan.md's UI
// Discipline ("never lorem ipsum - placeholder copy is realistic French from
// lib/fr, marked TODO-COPY where unwritten, because fake text hides the
// wrapping and overflow problems real French reveals"). The wording has not
// been reviewed.
//
// Two constraints shape it.
//
// NO THRESHOLD NUMBERS. None of these explanations names 40 % or 49,9 %,
// though the obvious phrasing would. The thresholds come from the year's
// RuleSet (SPEC 7.7) and a number written into copy is a second source of
// truth that goes stale silently - the copy would still say 40 % after a rule
// change. FW12 renders the actual figures beside the badge.
//
// VOCABULARY. Déclaré, enregistré, horodaté - never certifié, attesté or
// conforme (SPEC section 20, DESIGN-SYSTEM.md section 5). These sentences
// describe a position, never a guarantee.

export const STATUS_COPY = {
  compliant: {
    // RULING R41. "Dans les limites" described staying under a boundary and
    // named neither consequence; the other three labels each state one -
    // where you are taxed, where you are insured. "Sous les deux seuils"
    // makes the compliant state parallel to them: under BOTH.
    label: 'Sous les deux seuils',
    explanation:
      'Votre taux de télétravail déclarable reste sous le plafond fiscal.',
  },

  'mission-exposure': {
    label: 'Missions exposées',
    explanation:
      'Une partie de vos jours de mission dépasse le plafond et reste imposable en France.',
  },

  'regime-lost': {
    label: 'Régime non applicable',
    explanation:
      'Le télétravail seul dépasse le plafond fiscal : le régime frontalier ne s’applique plus.',
  },

  'social-switch': {
    label: 'Bascule de sécurité sociale',
    explanation:
      'Le seuil de sécurité sociale est dépassé : votre affiliation peut basculer en France.',
  },
} as const;
