// web/lib/fr/lamal-page.ts
//
// The STATIC sections of /calculateur-lamal-cmu, built to the approved A2
// artboard (docs/design/comparateur-lamal-a2.dc.html, 14147fd1) by
// FW-COMPARATEUR-A2-PAGE (W20, R1046-R1050). Accented and authoritative
// (R155); the report transliterates it and points here.
//
// ITS OWN MODULE, NOT KEYS OF LAMAL_COPY, and the reason is bytes. The
// comparator's island (ComparatorForm.tsx, 'use client') imports LAMAL_COPY,
// so every key of that object ships in the page's client JavaScript. Nothing
// here is interactive: only server components import this file, so none of
// it reaches the browser as script (R1048, GATE A unchanged, R2).
//
// EVERY RULE HAS A SOURCE (R1047, R181). Each sentence below names its row in
// docs/regulatory-sources.md, or the section of the October collection
// (docs/sources/primes-lamal/sources-2026-10.md, read 27 October 2026) that
// it is worded from. Where the artboard states a VALUE no constant carries -
// the flat base's multiple, the late-declaration surcharge, the age bounds -
// the sentence names the rule without the value (R147, R153: interpolated,
// never typed), and the report lists what was left out.
//
// WHAT THIS PAGE NEVER SAYS (R673): which option to choose; « recommandé »;
// an insurer's name; a single LAMal figure; a converted figure without its
// rate and date. None of the sentences below states a figure in francs or
// euros.

import { LAMAL_COPY, PREMIUM_DATASET } from '@/lib/fr/lamal';

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

/** « title », with the no-break spaces inside the guillemets. */
const quoted = (title: string): string => `«${NB}${title}${NB}»`;

/** "(lu le 27.10.2026)": the read date is an argument, never typed (R171). */
const readOn = (date: string): string => `(lu le ${date})`;

export const LAMAL_PAGE_COPY = {
  // ---- the page head ----------------------------------------------------

  /** The artboard's h1. LAMAL_COPY.title stays the pill above it and the JSON-LD name. */
  heading: `Le droit d’option des frontaliers${n(':')} LAMal ou assurance maladie française`,

  // ---- "Sur cette page": the chips, each a link to its section ---------

  onThisPage: 'Sur cette page',

  /**
   * The chips that are not a section heading. The others are the heading
   * itself, by key (R206): one text, one home.
   */
  chips: {
    compare: 'Comparer les coûts',
    france: 'Si vous choisissez la France',
    switzerland: 'Si vous restez en Suisse',
  },

  // ---- "Le délai de trois mois": its source line (D1, D2; §7a, §7b) ------

  deadlineSource: (date: string): string => `Sources${n(':')} cleiss.fr, ameli.fr ${readOn(date)}`,

  // ---- "Ce qui est définitif" (rows D3, D4, D5; CLEISS FAQ, §7a) --------

  final: {
    heading: 'Ce qui est définitif',
    /** D3, D4. */
    lead:
      'Le droit d’option ne s’exerce qu’une seule fois et il est irrévocable. ' +
      'Seuls certains changements de situation permettent d’y revenir.',
    /** D4: CLEISS's three changes of situation, in its order. */
    reopensHeading: 'Ce qui permet d’y revenir',
    reopens: [
      `une reprise d’activité en Suisse, par exemple après une période de chômage${n(';')}`,
      `un transfert de résidence en France ou une prise de domicile en France${n(';')}`,
      'un passage à la retraite du seul régime suisse.',
    ],
    /** D5: what CLEISS names as NOT a change of situation. */
    closedHeading: 'Ce qui ne le permet pas',
    closed: [
      `un mariage ou un divorce${n(';')}`,
      `une naissance ou un décès dans la famille${n(';')}`,
      'un changement d’employeur sans période de chômage entre les deux.',
    ],
    source: (date: string): string =>
      `Source${n(':')} cleiss.fr, FAQ ${quoted('Droit d’option des frontaliers France-Suisse')} ${readOn(date)}`,
  },

  // ---- "Qui suit votre choix" (row D8; CLEISS FAQ, §7a) -----------------

  family: {
    heading: 'Qui suit votre choix',
    body: [
      'Les membres de votre famille qui résident en France sans activité ' +
        'professionnelle propre ni pension du seul régime suisse n’ont pas de ' +
        `droit d’option${n(':')} leur couverture suit celle que vous choisissez.`,
      'Un conjoint qui travaille, en France comme en Suisse, relève de sa propre affiliation.',
    ],
    source: (date: string): string => `Source${n(':')} cleiss.fr ${readOn(date)}`,
  },

  // ---- "Ce que couvre l'option" (row L18; CLEISS worker page, §7c) ------

  scope: {
    heading: 'Ce que couvre l’option',
    body: [
      'L’option ne vaut que pour la couverture maladie.',
      'Les accidents du travail, les maladies professionnelles, l’invalidité ' +
        'et la perte de gain liée à la maladie ou à la maternité relèvent dans ' +
        'tous les cas de la législation suisse.',
    ],
    source: (date: string): string =>
      `Source${n(':')} cleiss.fr, ${quoted('Vous travaillez en Suisse et vous résidez en France')} ${readOn(date)}`,
  },

  // ---- the two cards: France, Suisse ------------------------------------

  france: {
    label: 'France',
    heading: 'Si vous choisissez l’assurance maladie française',
    /**
     * `rate` and `allowance` are the newest year's, from lib/lamal/years.ts
     * (rows L7, L8), formatted by the caller - never typed here.
     */
    items: (rate: string, allowance: string): readonly string[] => [
      // L7, L8 (URSSAF 6a, §6a-c).
      `Une cotisation annuelle calculée par l’Urssaf${n(':')} ${rate} de vos ` +
        `revenus de l’avant-dernière année, après un abattement de ${allowance} ` +
        'du plafond de la sécurité sociale.',
      // L11 (URSSAF 6a, §6e).
      `La déclaration est individuelle${n(':')} un conjoint frontalier ` +
        'également assuré en France fait la sienne.',
      // L11 (URSSAF 6d, §6e).
      'Vos proches (conjoint, concubin, partenaire de pacs, enfants) peuvent ' +
        'être rattachés comme bénéficiaires, sans cotisation supplémentaire.',
      // L19 (URSSAF 6c, §6f).
      'Le paiement est trimestriel, ou mensuel si vous adhérez au prélèvement ' +
        'automatique. Votre employeur peut prendre en charge tout ou partie de ' +
        'la cotisation.',
      // L20 (URSSAF 6a, §6d). The base's multiple of the plafond and the
      // surcharge's rate are named by the source and carried by no constant:
      // the rule is named here without its values (R147, R153).
      'Sans déclaration de vos revenus, la cotisation est calculée sur une ' +
        `base forfaitaire${n(';')} une déclaration tardive entraîne une ` +
        'majoration de la base.',
      // L21 (URSSAF 6d, §7d).
      'Salarié, vous ne pouvez pas revenir à l’assurance maladie suisse ' +
        'pendant toute la durée de votre contrat de travail.',
    ],
    source: (date: string): string =>
      `Sources${n(':')} Code de la sécurité sociale, art. L380-3-1 et D380-2${n(';')} ` +
      `urssaf.fr${n(';')} ameli.fr ${readOn(date)}`,
  },

  switzerland: {
    label: 'Suisse',
    heading: 'Si vous restez à l’assurance maladie suisse (LAMal)',
    items: [
      // L1, L3, L5. The young adults' age bounds are the law's (L5) and no
      // exported constant carries them: the classes are named, not bounded.
      'Une prime mensuelle par personne assurée, qui varie selon l’assureur, ' +
        'l’âge (enfant, jeune adulte, adulte) et la couverture accidents.',
      // L4 (LAMal art. 61 al. 4).
      'Pour un résident de France, la prime dépend de son pays de résidence, ' +
        'non du canton de travail.',
      // L6 (LAMal art. 8 al. 1; OLAA art. 13 al. 1) - « huit heures » is the
      // rule's own words, as in the form's sentence.
      'Employé au moins huit heures par semaine chez un même employeur, vous ' +
        'êtes assuré contre les accidents par la loi sur l’assurance-accidents' +
        n(':') +
        ' la couverture accidents de l’assurance maladie peut alors être ' +
        'suspendue, sur demande.',
      // L11: one premium per person on the Swiss side.
      'Chaque membre de la famille assuré paie sa propre prime.',
    ],
    /** R668: where a reader chooses an insurer. The link text is the result's (R206). */
    priminfoLead: `Pour comparer les assureurs et en choisir un${n(':')} `,
    priminfoText: LAMAL_COPY.result.swiss.priminfo.text,
    /**
     * The sentence's full stop. The artboard goes on - « , le site de l'Office
     * fédéral de la santé publique » - and no source collected says whose
     * site priminfo is, so the sentence ends at the link (R1047).
     */
    priminfoAfter: '.',
    source: (date: string): string =>
      `Sources${n(':')} LAMal art. 8, 16a et 61${n(';')} OLAA art. 13${n(';')} ` +
      `priminfo.admin.ch${n(';')} OFSP, ${quoted(PREMIUM_DATASET.title)} ${readOn(date)}`,
  },

  // ---- "Sources" ---------------------------------------------------------

  sources: {
    heading: 'Sources',
    /** True of the seven rows below: each is in the October collection, read on one day. */
    lead: (date: string): string => `Toutes lues le ${date}.`,
    /** The artboard's seven rows: what each source is, and what it sources here. */
    rows: [
      {
        name: `${PREMIUM_DATASET.author}, ${quoted(PREMIUM_DATASET.title)}, opendata.swiss`,
        what: 'Utilisation libre, obligation d’indiquer la source',
      },
      {
        name: 'Code de la sécurité sociale, articles L380-3-1 et D380-2, legifrance.gouv.fr',
        what: 'La formule de la cotisation',
      },
      {
        name: `urssaf.fr, ${quoted('Travailleur frontalier en Suisse')}`,
        what: 'Revenus déclarés, abattement, paiement, plafond',
      },
      {
        name: `cleiss.fr, FAQ ${quoted('Droit d’option des frontaliers France-Suisse')}`,
        what: 'Délai, irrévocabilité, famille',
      },
      {
        name: `ameli.fr, ${quoted(`Travailleur frontalier suisse${n(':')} droits et prise en charge`)}`,
        what: 'Délai et caractère irrévocable',
      },
      {
        name: `LAMal art. 8, 16a, 61${n(';')} OLAA art. 13, fedlex.admin.ch`,
        what: 'Âges, accidents, prime selon l’État de résidence',
      },
      {
        name: 'Banque centrale européenne, taux de référence de l’euro',
        what: 'Conversion des francs en euros',
      },
    ],
    /** The site's own list, /sources (R113): the artboard's words for the link the band used to end on. */
    allLink: { text: 'Toutes les sources et vérifications du site', href: '/sources' },
  },
} as const;
