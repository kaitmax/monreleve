// web/lib/fr/home.ts
//
// Every word of the home page. Since FW-HOME-A2 that is the A2 design, "the
// releve first, then the counter" (docs/design/home-a2.dc.html, R709-R723); the
// page itself is app/(public)/page.tsx, and this file holds its copy the way
// lib/fr/calculateur.ts holds the calculator's. FW34's blocks - its hero, its
// calculator card, its rules, how-it-works, releve, privacy, app, guides and
// sources strips - left with the sections that rendered them (R720).
//
// THE THRESHOLDS ARE ARGUMENTS, NEVER LITERALS (R147, extended to lib/fr by
// Q52). Every sentence that names the fiscal ceiling, the social ceiling or
// the mission cap takes it ALREADY FORMATTED - through formatPercent /
// formatDays, from the year's RuleSet, by the caller. A figure typed here goes
// stale in 2028 with every suite green, and tests/unit/fr/typed-numbers.test.ts
// refuses one.
//
// WHAT IS STILL FUTURE TENSE (R138, R172). The app, the day register and the
// releve are not built - PRODUCT_STATE.appExists / trackerExists /
// dossierExists are false - so every sentence about them is a function of
// ProductState: the design's present tense is the true branch, today's future
// tense the false one. tests/unit/content/product-state.test.ts flips each flag
// and requires each such sentence to change.
//
// WHAT IS SAMPLE DATA, NOT COPY: "Camille Martin", the verification code, the
// phone screens' date. They are here because jsx-no-literals forbids a literal
// in JSX text, and they are labelled SAMPLE so nobody mistakes them for a
// claim. The excerpt's days are data in lib/content/home.ts.
//
// FRENCH TYPOGRAPHY (R91): the no-break spaces before : ; ? are built by n()
// rather than typed, so they are visible in the source of a file whose subject
// is invisible characters, and so copy-codepoints.test.ts does not have to pin
// this file's U+00A0 count.
//
// TODO-COPY: realistic French, not reviewed by counsel.

import type { ProductState } from '@/lib/content/product-state';
import type { ReleveSampleKind } from '@/lib/content/home';
import type { Zone } from '@/lib/ui/core/zones';
import { APP_NAME } from '@/lib/fr';

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

// SAMPLE DATA, not copy, shared by the releve excerpt and the phone mock-ups
// (FW-HOME-A2, R714): the holder and the verification code the home page has
// always shown, ONE home each, so the excerpt and the greeting cannot name two
// different people (R206).
const SAMPLE_HOLDER = 'Camille Martin';
const SAMPLE_CODE = 'MR-7F3K-2Q9X';

/** The sample's two facts, exported for the test that ties the greeting to the holder. */
export const HOME_SAMPLE = { holder: SAMPLE_HOLDER, code: SAMPLE_CODE } as const;

/** The holder's first name, the way Android's Fr.greeting takes it. */
const SAMPLE_FIRST_NAME = SAMPLE_HOLDER.split(' ')[0] ?? SAMPLE_HOLDER;

export const HOME_COPY = {
  // -------------------------------------------------------------------------
  // THE META DESCRIPTION. Unchanged from the placeholder home: it is the one
  // sentence Google prints under the product's name, it names both thresholds
  // without typing either (R147), and it takes ProductState because it must not
  // promise a register that does not exist (R172). product-state.test.ts wires
  // this exact signature.
  // -------------------------------------------------------------------------
  description: (fiscal: string, social: string, state: ProductState): string =>
    'Calculez votre part de télétravail annuelle et les jours qui vous ' +
    `restent avant les seuils de ${fiscal} et ${social}` +
    (state.trackerExists ? ', puis tenez le registre horodaté de vos journées.' : '.'),

  // =========================================================================
  // FW-HOME-A2: THE RELEVE FIRST, THEN THE COUNTER (R709-R723).
  //
  // The approved design's words, accented and set with n() (R712). Where the
  // design states something the product cannot do yet - the app, the day
  // register, the releve itself - the sentence is a FUNCTION OF ProductState
  // (R172), and today's branch is the future tense the shipped flags allow;
  // the design's present tense is the other branch, and flipping the flag is
  // what turns it on. tests/unit/content/product-state.test.ts wires each.
  // =========================================================================

  // -------------------------------------------------------------------------
  // SECTION 2 - THE OPENING. The thresholds arrive formatted (R710, R147).
  // -------------------------------------------------------------------------
  opening: {
    line: 'Pour les frontaliers qui vivent en France et travaillent en Suisse',

    // THE h1, asserted equal by e2e/home.spec.ts.
    heading:
      'Votre année de télétravail, jour par jour, dans un relevé que l’on peut vérifier.',

    lead: (fiscal: string, social: string, state: ProductState): string =>
      `${APP_NAME} compte vos jours face aux deux seuils qui vous concernent, ` +
      `${fiscal} pour l’impôt et ${social} pour la sécurité sociale, ` +
      (state.dossierExists
        ? 'et vous remet un relevé annuel où chaque journée porte l’heure de son enregistrement.'
        : 'et vous remettra un relevé annuel où chaque journée portera l’heure de son enregistrement.'),

    cta: 'Calculer ma situation',
    free: 'Gratuit, sans inscription pour le calcul.',
  },

  // -------------------------------------------------------------------------
  // SECTION 2 - THE RELEVE EXCERPT (R714). A SAMPLE: the days are data in
  // lib/content/home.ts, formatted by the product's own date formatters.
  // -------------------------------------------------------------------------
  excerpt: {
    /** The figure's accessible name. */
    label: 'Extrait d’un relevé annuel d’exemple',
    title: 'Relevé annuel de télétravail',
    subtitle: (year: number): string => `Année ${year}, ${SAMPLE_HOLDER}`,
    codeLabel: 'Code de vérification',
    code: SAMPLE_CODE,
    columns: {
      date: 'Date',
      day: 'Journée',
      recorded: 'Enregistrée le (heure de Paris)',
    },
    kinds: {
      swiss: 'En Suisse',
      home: 'Télétravail en France',
      split: 'Matin en France, après-midi en Suisse',
      absence: 'Absence (congé)',
    } satisfies Record<ReleveSampleKind, string>,
    caption: (state: ProductState): string =>
      state.trackerExists
        ? 'Exemple. Les journées sont déclarées par vous, enregistrées et horodatées par le serveur.'
        : 'Exemple. Les journées seront déclarées par vous, enregistrées et horodatées par le serveur.',
  },

  // -------------------------------------------------------------------------
  // SECTION 3 - THE COUNTER (R711). Every figure is the engine's; the copy
  // only names them.
  // -------------------------------------------------------------------------
  counter: {
    heading: 'Combien de jours pouvez-vous encore télétravailler cette année' + n('?'),
    intro: 'Déplacez les curseurs' + n(':') + ' vous voyez où vous en êtes face aux deux seuils.',
    rateLabel: 'Votre taux de télétravail',

    // STATUS IS NEVER COLOUR ALONE: one sentence per zone, so the rate's
    // colour always has its words beside it.
    status: {
      compliant: 'Sous les deux seuils.',
      'fiscal-exposure': 'Au-delà du seuil fiscal, sous le seuil social.',
      'social-switch': 'Au-delà des deux seuils.',
    } satisfies Record<Zone, string>,

    // Each tile's label is METRIC_COPY's sentence with the rule it belongs to
    // after a comma, the design's "l'impôt" and "la sécurité sociale".
    tile: (metric: string, rule: string): string => `${metric}, ${rule}`,
    fiscalRule: 'l’impôt',
    socialRule: 'la sécurité sociale',

    // PLAIN STRINGS, NOT FUNCTIONS, and the reason is the bundle: the counter
    // is a client island, and a function cannot cross from the server page to
    // it as a prop - it would have to import this whole module instead. The
    // island renders "<label> <value>"; the label ends on the French colon.
    teleworkLabel: 'Jours télétravaillés depuis le 1er janvier' + n(':'),
    basisLabel: 'Jours de travail sur l’année' + n(':'),

    note:
      'Aperçu simplifié, sans missions ni canton. Le calculateur complet en tient ' +
      'compte. Le calcul est indicatif et ne constitue pas un conseil fiscal.',

    full: 'Faire le calcul complet',

    // ONLY A READER WITH SCRIPTING OFF SEES THESE (R346, R351): the counter's
    // <noscript> block asks for a canton - the result page needs one - and
    // submits the sliders to the page that answers. FW34's calculator card's
    // two labels, kept because they still say exactly this.
    noscriptCanton: 'Canton de votre employeur',
    noscriptSubmit: 'Calculer',

    // R713: the app action goes to /application, and its WORDS follow the same
    // fact the shell's "Suivre mes jours" does - trackerExists (R186).
    app: (state: ProductState): string =>
      state.trackerExists ? 'Suivre mes jours avec l’application' : 'Découvrir l’application',
  },

  // -------------------------------------------------------------------------
  // SECTION 4 - THE APPLICATION (R716).
  // -------------------------------------------------------------------------
  mobile: {
    heading: 'L’application' + n(':') + ' une question chaque soir',

    body: (state: ProductState): string =>
      state.trackerExists
        ? 'Vous déclarez votre journée en un geste. Votre taux se met à jour, et la ' +
          'journée est horodatée par le serveur.'
        : 'Vous déclarerez votre journée en un geste. Votre taux se mettra à jour, ' +
          'et la journée sera horodatée par le serveur.',

    availability: (state: ProductState): string =>
      (state.appExists ? 'Disponible sur Android.' : 'Bientôt sur Android.') +
      ' La version iPhone est en préparation.',

    // R713: no store link until the listing exists; the action goes to
    // /application either way, and only its words move with the fact.
    cta: (state: ProductState): string =>
      state.appExists ? 'Télécharger pour Android' : 'Découvrir l’application',
  },

  // -------------------------------------------------------------------------
  // SECTION 4 - THE PHONE SCREENS (R716). The words a phone shows are the
  // APP'S OWN: each one below marked ANDROID equals its Kotlin constant, by
  // tests/unit/pages/home-phone-copy.test.ts, so the page and the app cannot
  // drift silently. The rest is the web's caption of a sample.
  // -------------------------------------------------------------------------
  phone: {
    /** ANDROID Fr.greeting(holder): "Bonjour" and the holder's first name. */
    greeting: `Bonjour ${SAMPLE_FIRST_NAME}`,
    /** SAMPLE: the day the screens show. */
    date: 'mardi 27 octobre',
    /** ANDROID AujourdhuiCopy.QUESTION. */
    question: 'Où travaillez-vous aujourd’hui' + n('?'),
    /** ANDROID AujourdhuiCopy.SUISSE, DOMICILE, MISSION. */
    swiss: 'En Suisse',
    home: 'Domicile',
    mission: 'Mission',
    /** ANDROID AujourdhuiCopy.ABSENCE. */
    absence: 'Déclarer une absence',
    /** ANDROID AujourdhuiCopy.SYNCED and MODIFIER. */
    recorded: 'Enregistré',
    edit: 'Modifier',
    /** ANDROID NavCopy, in its order; the first also labels the answered card. */
    tabs: ['Aujourd’hui', 'Calendrier', 'Relevé', 'Paramètres'],

    rateLabel: 'Taux de télétravail, exemple',
    underFiscal: (fiscal: string): string => `Sous le seuil fiscal de ${fiscal}`,

    androidLabel: 'L’écran Aujourd’hui, avant de répondre',
    iphoneLabel: 'Le même écran, une fois la journée déclarée',
    androidName: 'Android',
    iphoneName: 'iPhone, en préparation',
  },

  // -------------------------------------------------------------------------
  // SECTION 5 - THE TWO THRESHOLDS (R715). Figures from the RuleSet; the
  // citations from lib/fr/sources (R710).
  // -------------------------------------------------------------------------
  thresholds: {
    heading: 'Deux seuils, deux règles différentes',

    fiscalTitle: 'L’impôt',
    // THE FIRST SENTENCE IS THE VERIFIED ONE, not the design's. The design
    // reads "votre salaire reste imposé en Suisse", which is false in the
    // eight cantons of the 1983 accord, where the salary is taxed in France
    // whatever the telework; FW34's sentence, tied to the fiscalCeiling row,
    // says what the 40 % actually protects. Recorded under R709.
    fiscalBody: (fiscal: string, missionCap: string): string =>
      `Jusqu’à ${fiscal} de votre temps de travail par année civile, ` +
      'télétravailler depuis la France ne change pas l’imposition de votre ' +
      `salaire. Jusqu’à ${missionCap} jours de mission peuvent compter dans ce quota.`,

    socialTitle: 'La sécurité sociale',
    socialBody: (social: string): string =>
      'Avec une attestation A1 demandée par votre employeur, vous restez ' +
      `affilié aux assurances sociales suisses jusqu’à ${social} de télétravail.`,

    source: (citation: string): string => 'Source' + n(':') + ` ${citation}`,
  },

  // -------------------------------------------------------------------------
  // SECTION 5b - THE HEALTH-INSURANCE CHOICE (FW-COMPARATEUR-SURFACE). A
  // surface card after the band, so the comparator is findable from the home
  // page. NO FIGURE, by the operator's instruction: no premium, no rate, no
  // "moins cher" - those live on the comparator beside their sources and
  // dates, and tests/unit/pages/home.test.tsx scans the rendered card for a
  // digit, a currency, a percent or a verdict.
  //
  // THE ONE SENTENCE MAPS TO ROWS, each in docs/regulatory-sources.md:
  //   "ne se fait qu'une fois et ne se reprend pas"   D3 (once, irrevocable)
  //   "un délai de trois mois"                        D1 (the window)
  //   "qui ne part pas toujours de l'embauche"        D2 (four events open it)
  // "Le droit d'option" is the instrument's name, as the guide gives it. The
  // last clause is the pillar's own warning, because the commonest mistake on
  // this subject is to count the three months from the hiring date.
  // -------------------------------------------------------------------------
  health: {
    heading: 'Assurance maladie' + n(':') + ' suisse ou française' + n('?'),
    body:
      'Ce choix, le droit d’option, ne se fait qu’une fois et ne se reprend pas' +
      n(':') +
      ' il s’exerce dans un délai de trois mois, qui ne part pas toujours de l’embauche.',
    cta: 'Comparer les deux systèmes',
  },

  // -------------------------------------------------------------------------
  // SECTION 6 - THE YEAR, IN THREE CARDS.
  // -------------------------------------------------------------------------
  year: {
    heading: 'Le compteur, toute l’année, et un relevé à la fin',

    cards: (state: ProductState): readonly { readonly title: string; readonly body: string }[] => [
      {
        title: 'Chaque soir, une question',
        body:
          'Où avez-vous travaillé aujourd’hui' +
          n('?') +
          (state.trackerExists
            ? ' Vous répondez depuis la notification, en un geste.'
            : ' Vous répondrez depuis la notification, en un geste.'),
      },
      {
        title: state.trackerExists ? 'Le compte se tient seul' : 'Le compte se tiendra seul',
        body: state.trackerExists
          ? 'Votre taux et vos jours restants se mettent à jour à chaque journée déclarée.'
          : 'Votre taux et vos jours restants se mettront à jour à chaque journée déclarée.',
      },
      {
        title: 'Un relevé vérifiable',
        body: state.dossierExists
          ? 'Un relevé annuel, jour par jour, horodaté, avec un code que votre fiduciaire peut vérifier.'
          : 'Un relevé annuel, jour par jour, horodaté, avec un code que votre fiduciaire pourra vérifier.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // SECTION 8 - THE QUESTIONS (R717).
  // -------------------------------------------------------------------------
  questions: {
    heading: 'Vos questions',

    change: {
      question: 'Qu’est-ce que ça change' + n('?'),
      before: 'Avant',
      beforeBody: 'Un tableur rempli de mémoire, au moment de la déclaration.',
      after: 'Après',
      afterBody: 'Chaque journée déclarée le jour même, horodatée par le serveur.',
    },

    fiduciary: {
      question: 'Que reçoit ma fiduciaire' + n('?'),
      answer: (state: ProductState): string =>
        'Un relevé annuel, jour par jour, avec un code de vérification. ' +
        (state.dossierExists
          ? 'Elle voit le document tel qu’il a été émis.'
          : 'Elle verra le document tel qu’il aura été émis.'),
    },

    position: {
      question: 'Vous suivez ma position' + n('?'),
      answer:
        'Non. Ni carte, ni trajet, ni position conservée. Rien n’est enregistré sans votre réponse.',
    },

    phone: {
      question: 'Sur quel téléphone' + n('?'),
      answer: (state: ProductState): string =>
        (state.appExists ? 'Android aujourd’hui.' : 'Bientôt sur Android.') +
        ' L’iPhone est en préparation. Le calculateur fonctionne dans tout navigateur.',
    },

    // FW-COMPARATEUR-SURFACE. Two sentences and a link. The first restates
    // the section above in question form - D1 (three months) and D3 (once,
    // irrevocable); the second says what the comparator does in the words the
    // droit d'option guide already uses for it (its FAQ, rows L1-L11), and
    // names no figure and no verdict. The link is NOT part of `answer`, which
    // stays the plain text anything reading answers as text would read.
    health: {
      question: 'LAMal ou assurance maladie française' + n('?'),
      answer:
        'C’est le droit d’option' +
        n(':') +
        ' un choix entre les deux systèmes, qui ne se fait qu’une fois, dans un délai de trois mois. ' +
        'Le comparateur LAMal / CMU estime ce que chacun coûterait à votre foyer sur une année, ' +
        'et dit ce qu’il ne compare pas.',
      link: 'Ouvrir le comparateur',
    },
  },
} as const;
