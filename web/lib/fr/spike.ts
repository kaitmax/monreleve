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
    'Cette page assemble un jeu representatif de composants pour mesurer le ' +
    'poids reel du premier chargement. Elle ne fait pas partie du site public.',

  nav: {
    calculateur: 'Calculateur', // TODO-COPY
    guides: 'Guides', // TODO-COPY
    releve: 'Releve annuel', // TODO-COPY
    application: 'Application', // TODO-COPY
    cta: 'Calculer mes jours',
  },

  form: {
    legend: 'Situation',
    canton: 'Canton de travail',
    cantonOptions: ['Geneve', 'Vaud', 'Valais', 'Neuchatel', 'Jura'],
    teleworkDays: 'Jours de teletravail',
    decrease: 'Diminuer',
    increase: 'Augmenter',
    contract: 'Temps de travail',
    fullTime: 'Temps plein',
    partTime: 'Temps partiel',
    details: 'Details du calcul',
    detailsBody:
      'Le taux declarable est calcule sur les jours ouvres de l annee, hors ' +
      'absences. Les jours de mission suivent une regle distincte.',
  },

  table: {
    caption: 'Recapitulatif mensuel',
    month: 'Mois',
    worked: 'Jours travailles',
    telework: 'Teletravail',
    rate: 'Taux',
    rows: [
      { month: 'Janvier', worked: '21', telework: '8', rate: '38,1 %' },
      { month: 'Fevrier', worked: '20', telework: '7', rate: '35,0 %' },
      { month: 'Mars', worked: '22', telework: '9', rate: '40,9 %' },
      { month: 'Avril', worked: '20', telework: '6', rate: '30,0 %' },
      { month: 'Mai', worked: '21', telework: '8', rate: '38,1 %' },
      { month: 'Juin', worked: '21', telework: '7', rate: '33,3 %' },
    ],
  },

  banner: {
    title: 'Seuil de 40 % approche',
    body: 'Il reste 4 jours de teletravail avant le seuil fiscal.', // TODO-COPY
  },

  panel: {
    title: 'Modifier la journee',
    body: 'Choisissez le type de journee enregistre.', // TODO-COPY
    confirm: 'Enregistrer',
    cancel: 'Annuler',
  },

  notice: 'Estimation indicative. Ne remplace pas un avis fiscal.',
} as const;
