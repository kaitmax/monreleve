// web/lib/fr/spike.ts
//
// Copy for the FW2 bundle spike ONLY. It is kept separate from lib/fr/index.ts
// so that deleting the spike is one file and one import, and so throwaway
// strings never mix with product copy.
//
// Marked TODO-COPY where the wording is placeholder: realistic French, never
// lorem ipsum, because fake text hides the wrapping and overflow problems that
// real French reveals (tasks/plan.md, UI Discipline).

export const SPIKE = {
  title: 'Spike - mesure du poids de page',
  intro:
    'Cette page assemble un jeu représentatif de composants pour mesurer le ' +
    'poids réel du premier chargement. Elle ne fait pas partie du site public.',

  nav: {
    calculateur: 'Calculateur', // TODO-COPY
    guides: 'Guides', // TODO-COPY
    releve: 'Relevé annuel', // TODO-COPY
    application: 'Application', // TODO-COPY
    cta: 'Calculer mes jours',
  },

  form: {
    legend: 'Situation',
    canton: 'Canton de travail',
    cantonOptions: ['Genève', 'Vaud', 'Valais', 'Neuchâtel', 'Jura'],
    teleworkDays: 'Jours de télétravail',
    decrease: 'Diminuer',
    increase: 'Augmenter',
    contract: 'Temps de travail',
    fullTime: 'Temps plein',
    partTime: 'Temps partiel',
    details: 'Détails du calcul',
    detailsBody:
      'Le taux déclarable est calculé sur les jours ouvrés de l’année, hors ' +
      'absences. Les jours de mission suivent une règle distincte.',
  },

  table: {
    caption: 'Récapitulatif mensuel',
    month: 'Mois',
    worked: 'Jours travaillés',
    telework: 'Télétravail',
    rate: 'Taux',
    rows: [
      { month: 'Janvier', worked: '21', telework: '8', rate: '38,1 %' },
      { month: 'Février', worked: '20', telework: '7', rate: '35,0 %' },
      { month: 'Mars', worked: '22', telework: '9', rate: '40,9 %' },
      { month: 'Avril', worked: '20', telework: '6', rate: '30,0 %' },
      { month: 'Mai', worked: '21', telework: '8', rate: '38,1 %' },
      { month: 'Juin', worked: '21', telework: '7', rate: '33,3 %' },
    ],
  },

  banner: {
    title: 'Seuil fiscal approché', // R147: named, not quoted
    body: 'Il reste 4 jours de télétravail avant le seuil fiscal.', // TODO-COPY
  },

  panel: {
    title: 'Modifier la journée',
    body: 'Choisissez le type de journée enregistré.', // TODO-COPY
    confirm: 'Enregistrer',
    cancel: 'Annuler',
  },

  notice: 'Estimation indicative. Ne remplace pas un avis fiscal.',
} as const;
