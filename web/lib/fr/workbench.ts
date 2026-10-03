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

  // No label here: ruling R73 moved both tile labels to the caller, which
  // composes them from the RuleSet so they name their ceiling. The workbench
  // is that caller and uses METRIC_COPY directly.
  metric: {
    title: 'MetricTile',
    positive: 'Marge positive',
    negative: 'Marge dépassée',
  },

  field: {
    title: 'FieldGroup',
    plain: 'Champ simple',
    helper: 'Avec texte d aide',
    error: 'En erreur',
    both: 'Aide et erreur',
    label: 'Jours de télétravail',
    helperText: 'Journées entières uniquement.',
  },

  grid: {
    title: 'DataGrid',
    populated: 'Avec données',
    empty: 'Sans données',
    withTotal: 'Avec ligne de total',
    caption: 'Jours déclarés par mois',
    month: 'Mois',
    days: 'Jours',
    total: 'Total',
    january: 'Janvier',
    february: 'Février',
    march: 'Mars',
  },

  container: {
    title: 'Container',
    public: 'Largeur publique - 1200',
    narrow: 'Colonne calculateur - 720',
    article: 'Mesure de lecture - 680',
    sample: 'Contenu de démonstration',
  },

  shell: {
    title: 'PublicShell',
    desktop: 'En-tête et pied de page',
    // FW33: no page renders a menu today, because Calculateurs has one live
    // child and renders as a link to it. This is the menu as it returns.
    navDisclosure: 'Le menu Calculateurs, tel qu’il s’affichera avec deux entrées',
  },

  legal: {
    title: 'LegalNote',
    standing: 'Mention légale permanente',
  },

  // FW34's three home-body components (H5).
  button: {
    title: 'Button',
    primary: 'Primaire',
    primaryLarge: 'Primaire — grand',
    secondary: 'Secondaire',
    text: 'Lien avec flèche',
    label: 'Calculer mes jours',
    textLabel: 'Ouvrir le calculateur',
  },

  card: {
    title: 'Card',
    default: 'Carte — 24',
    spacious: 'Carte — 32',
    sample: 'Contenu de démonstration',
  },

  iconTile: {
    title: 'IconTile',
    sample: 'Tuile d’icône',
  },
} as const;

/**
 * RULING R122's client-cost harness, at /dev/island.
 *
 * Developer-facing, like WORKBENCH above, and here for the same reason: SPEC
 * section 5 has no "internal pages" exemption and react/jsx-no-literals would
 * not accept one.
 *
 * DELIBERATELY PLAIN. This page is a measurement, not a specimen sheet - what
 * a reviewer needs from it is the number in `pnpm size`, so its own words only
 * have to say what it is and why it is not the workbench.
 */
/**
 * The no-break space French sets before a colon and a semicolon (R91).
 *
 * DECLARED HERE BECAUSE THE GUARD CAUGHT ME. The first version of the copy
 * below wrote "Rendus declenches : 0" and "/dev/composants ; cette page"
 * with ordinary spaces, and R91's scan failed on both - correctly, and on
 * copy written by the same session that had just narrowed that scan. The
 * rule applies to developer-facing strings too; SPEC section 5 has no
 * exemption and neither does the typography.
 */
const NB = String.fromCharCode(0x00a0);

const n = (mark: string): string => `${NB}${mark}`;

export const ISLAND_HARNESS = {
  title: 'Coût client des composants',
  purpose:
    'Toute la bibliothèque rendue dans une île client, pour que GATE I mesure ' +
    'ce que chaque composant entraîne avec lui. Le banc visuel est ' +
    `/dev/composants${n(';')} cette page ne sert qu’à la mesure.`,
  rerender: 'Forcer un rendu',
  renders: (count: number): string => `Rendus déclenchés${n(':')} ${count}`,
  tileLabel: 'Jours restants',
  tileOverLabel: 'Jours au-dessus',
  gridCaption: 'Tableau de démonstration',
  gridColumn: 'Colonne',
  gridCell: 'Cellule',
  fieldLabel: 'Champ de démonstration',
  fieldHelper: 'Le texte d’aide du champ.',
  buttonLabel: 'Calculer mes jours',
  cardSample: 'Contenu de démonstration',
} as const;
