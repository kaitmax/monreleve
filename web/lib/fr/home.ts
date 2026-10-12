// web/lib/fr/home.ts
//
// Every word of the home page (FW34), rebuilt from the approved design in
// design/home. The page itself is app/(public)/page.tsx; this file holds its
// copy, the way lib/fr/calculateur.ts holds the calculator's.
//
// THE THRESHOLDS ARE ARGUMENTS, NEVER LITERALS (R147, extended to lib/fr by
// Q52). Every sentence that names the fiscal ceiling, the social ceiling, the
// A1 band floor, the mission cap or the simplified basis takes it ALREADY
// FORMATTED - through formatPercent / formatDays, from the year's RuleSet, by
// the caller (the page computes guideScope(currentTaxYear()) and passes the
// strings in). A figure typed here goes stale in 2028 with every suite green,
// and tests/unit/fr/typed-numbers.test.ts refuses one.
//
// WHAT IS STILL FUTURE TENSE (R138). The app and the releve are not built -
// PRODUCT_STATE.appExists / dossierExists / trackerExists are all false - so
// the copy about them is written in the future: "Bientot sur Android", "Chaque
// releve portera un code de verification", "votre position sera verifiee".
// tests/support/product-claims.ts scans lib/fr and fails a present-tense claim
// that a capability is here. The releve verification-code sentence stays future
// until FW-VERIFY switches the QR on.
//
// WHAT IS SAMPLE DATA, NOT COPY (design/home/README): the phone card's figures
// (the engine computes them), "Camille Martin", the verification code and the
// notification's date. The figures are not here at all - they are rendered by
// the site's components from the engine. The names and the code ARE here,
// because jsx-no-literals forbids a literal in JSX text, and they are labelled
// SAMPLE so nobody mistakes them for a claim.
//
// FRENCH TYPOGRAPHY (R91): the no-break spaces before : ; ? are built by n()
// rather than typed, so they are visible in the source of a file whose subject
// is invisible characters, and so copy-codepoints.test.ts does not have to pin
// this file's U+00A0 count.
//
// TODO-COPY: realistic French, not reviewed by counsel.

import type { ProductState } from '@/lib/content/product-state';
import { APP_NAME } from '@/lib/fr';

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

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

  // -------------------------------------------------------------------------
  // HERO
  // -------------------------------------------------------------------------
  hero: {
    eyebrow: 'Pour les frontaliers France – Suisse',

    // THE h1, and e2e/home.spec.ts asserts the rendered h1 equals it exactly,
    // U+00A0 included (R71). The question mark carries the no-break space n()
    // builds, which is where that codepoint comes from.
    heading:
      'Frontalier suisse' +
      n('?') +
      ' Sachez exactement combien de jours vous pouvez encore télétravailler depuis chez vous.',

    lead:
      `${APP_NAME} compte vos jours de télétravail face aux deux seuils qui vous ` +
      'concernent, fiscal et social, sans jamais suivre vos déplacements.',

    // "Bientot :" is future (R138): the app and the releve are not built.
    bullets: [
      'Calcul fondé sur l’avenant franco-suisse et l’accord du 29 avril 2026',
      'Vos deux seuils, fiscal et social, côte à côte',
      'Bientôt' + n(':') + ' l’application et votre relevé annuel',
    ],

    ctaPrimary: 'Calculer ma situation gratuitement',
    ctaSecondary: 'Découvrir l’application',

    // The phone card's own small chrome. The status chip, the rate caption and
    // the tile labels are NOT here - they come from the site's components
    // (ZoneBadge, RateDisplay, MetricTile) so the card and the calculator say
    // the same words (R206).
    cardTitle: 'Cette année',

    // The caption narrates the fixture, so its two figures are interpolated
    // from the example and the RuleSet, never typed (R163): exampleDays from
    // lib/content/home.ts, basisDays from the RuleSet.
    cardCaption: (exampleDays: string, basisDays: string): string =>
      'Aperçu de l’application. Exemple' +
      n(':') +
      ` ${exampleDays} jours de télétravail sur une base de ${basisDays} jours.`,
  },

  // -------------------------------------------------------------------------
  // CALCULATOR - a plain GET form to the calculator page's existing params.
  // -------------------------------------------------------------------------
  calculator: {
    eyebrow: 'Calculateur gratuit',
    heading: 'Combien de jours vous reste-t-il' + n('?'),

    // R282: "Vous habitez en France et travaillez en Suisse" is a SENTENCE,
    // not a choice - France is the only case the product supports.
    intro:
      'Vous habitez en France et travaillez en Suisse. Indiquez votre canton et ' +
      'vos jours depuis le 1er janvier' +
      n(':') +
      ' vous voyez aussitôt votre taux et ce qui vous reste avant chaque seuil.',

    note: 'Gratuit, sans inscription. Le calcul est indicatif et ne constitue pas un conseil fiscal.',

    cantonLabel: 'Canton de votre employeur',
    teleworkLabel: 'Jours télétravaillés depuis le 1er janvier',

    // ONE FIELD, MAPPED TO mfr (missions France). The design merges France and
    // third-state missions into one field; the calculator keeps them separate
    // (two params, treated differently in the waterfall). The home form is a
    // quick start that pre-fills the full calculator, where the split can be
    // refined, so a single field maps to the France param - the common case -
    // and the figures the hero emphasises (the rate, the headroom) are
    // identical to the split while missions stay within budget. Recorded in
    // REPORT as the mfr mapping.
    missionsLabel: 'Jours de mission, en France ou ailleurs',

    submit: 'Calculer',
  },

  // -------------------------------------------------------------------------
  // THE TWO RULES - each sentence tied to a verified REG-APPLY row, each
  // threshold from the RuleSet (R147), each card citing its source (R167).
  // -------------------------------------------------------------------------
  rules: {
    eyebrow: 'Deux règles, deux systèmes',
    heading: (fiscal: string, social: string): string =>
      `${fiscal} et ${social} ne se contredisent pas` +
      n(':') +
      ' ils ne parlent pas de la même chose',

    fiscal: {
      tag: 'Fiscalité',
      // fiscal and missionCap arrive formatted from the RuleSet.
      // Verified rows: fiscalCeiling (avenant 27.06.2023) and the mission
      // sub-cap inside the 40 % (accord amiable 29.04.2026, clause 1(a)).
      body: (fiscal: string, missionCap: string): string =>
        `Jusqu’à ${fiscal} de votre temps de travail par année civile, ` +
        'télétravailler depuis la France ne change pas l’imposition de votre ' +
        `salaire. Jusqu’à ${missionCap} jours de missions temporaires peuvent ` +
        `compter dans ce quota. Au-delà de ${fiscal}, vos jours de télétravail ` +
        'deviennent imposables en France.',
      source:
        'Source' + n(':') + ' AFC Genève' + n(';') +
        ' accord amiable franco-suisse du 29 avril 2026',
    },

    social: {
      tag: 'Sécurité sociale',
      // social and a1Threshold arrive formatted. Verified row: socialCeiling
      // and the 25 %-49,9 % band (OFAS/BSV, verified 11.10.2026).
      body: (social: string, a1Threshold: string): string =>
        'Avec une attestation A1 demandée par votre employeur, vous restez ' +
        `affilié aux assurances sociales suisses jusqu’à ${social} de ` +
        `télétravail. L’accord-cadre s’applique entre ${a1Threshold} et ${social} ` +
        'de votre temps de travail.',
      source: 'Source' + n(':') + ' Office fédéral des assurances sociales (OFAS)',
    },
  },

  // -------------------------------------------------------------------------
  // HOW IT WORKS - about the app, so FUTURE tense (R138).
  // -------------------------------------------------------------------------
  how: {
    eyebrow: 'Avec l’application, bientôt',
    heading: 'Trois gestes, une année tenue à jour',
    steps: [
      {
        title: 'Enregistrez votre journée',
        body: 'D’un geste dans l’application, ou directement depuis la notification du soir, sans l’ouvrir.',
      },
      {
        title: 'Suivez vos deux seuils',
        body: 'Votre taux et les jours qui vous restent, toujours à jour, sans calcul de votre part.',
      },
      {
        title: 'Obtenez votre relevé',
        body: 'Un relevé annuel, jour par jour, à remettre à votre comptable ou à votre fiduciaire.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // THE RELEVE - future tense until the dossier and FW-VERIFY's QR exist.
  // -------------------------------------------------------------------------
  releve: {
    eyebrow: 'Votre relevé',
    heading: 'Un relevé que l’on peut vérifier',
    body:
      'Chaque relevé portera un code de vérification. Votre comptable pourra le ' +
      'scanner et voir le relevé tel qu’il aura été émis' +
      n(':') +
      ' toute modification du document se verra aussitôt.',
    points: [
      'Jour par jour, avec l’heure d’enregistrement de chaque journée',
      'Les deux taux et les deux seuils, nommés',
      'Une page de vérification qui montre ce qui est imprimé, jamais votre adresse e-mail',
    ],
    footnote:
      'Le relevé sera votre propre registre. La déclaration officielle reste celle de votre employeur.',

    // SAMPLE DATA, not copy (design/home/README). The thumbnail is markup; the
    // name and the code are illustrative, the year comes from the clock.
    sample: {
      title: (year: number): string => `Relevé annuel de télétravail · ${year}`,
      holderLabel: 'Titulaire',
      holderName: 'Camille Martin',
      codeLabel: 'Code de vérification',
      code: 'MR-7F3K-2Q9X',
    },
  },

  // -------------------------------------------------------------------------
  // PRIVACY - each sentence already true and mapped; automatic mode future
  // tense; no "100 % securise", no "jamais partagees".
  // -------------------------------------------------------------------------
  privacy: {
    eyebrow: 'Vie privée',
    heading: 'Nous ne vous suivons pas.',
    lead:
      'En mode automatique, votre position sera vérifiée sur votre téléphone, ' +
      'puis oubliée. Seule la conclusion du jour est conservée' +
      n(':') +
      ' en Suisse, ou à domicile. Vos données ne sont ni vendues, ni ' +
      'accessibles à votre employeur.',
    items: [
      'Aucun trajet',
      'Aucune adresse',
      'Aucun historique de position',
      'Aucun accès pour votre employeur',
    ],
  },

  // -------------------------------------------------------------------------
  // THE APP - pre-release "Bientot sur Android" + an honest alerts link.
  //
  // THE LAUNCH SIGN-UP IS NOT RENDERED (PARK-FW34-LAUNCH). The design's email
  // capture promises launch news; there is no launch list, and reusing the
  // regulatory alert list would collect an address under a consent that names
  // a different purpose. So the section points to the regulatory alerts page
  // instead, named for what it is, and the launch list is parked. The button
  // is shown only while alertsExist (R172).
  // -------------------------------------------------------------------------
  app: {
    eyebrow: 'L’application',
    heading: 'Bientôt sur Android',
    body: 'Une journée s’enregistrera en un geste, même depuis la notification du soir.',
    alertsLead:
      'En attendant, nos alertes par e-mail vous préviennent dès qu’une règle change.',
    alertsCta: 'Recevoir les alertes réglementaires',
    iosNote: 'iOS' + n(':') + ' plus tard.',

    // SAMPLE: the notification mock. The date is illustrative; the question and
    // the choices are the app's future UI, shown as a preview.
    notificationApp: `${APP_NAME} · maintenant`,
    notificationQuestion: 'Où avez-vous travaillé aujourd’hui' + n('?'),
    notificationDate: 'Mardi 7 octobre',
    notificationChoices: ['En Suisse', 'Domicile', 'Autre…'],
    notificationCaption: 'Aperçu de la notification du soir',
  },

  // -------------------------------------------------------------------------
  // GUIDES - the three links are derived from the guides themselves
  // (breadcrumbLabel), never typed; see lib/content/home.ts.
  // -------------------------------------------------------------------------
  guides: {
    eyebrow: 'Guides',
    heading: 'Comprendre vos règles, sans jargon',
    body: 'Des guides courts, chacun appuyé sur ses sources officielles.',
    all: 'Voir tous les guides',
  },

  // -------------------------------------------------------------------------
  // SOURCES - links /sources; the claim matches the verified REG rows.
  // -------------------------------------------------------------------------
  sources: {
    claim:
      'Règles établies sur les textes officiels' +
      n(':') +
      ' l’avenant à la convention fiscale franco-suisse et l’accord amiable du 29 avril 2026.',
    cta: 'Consulter nos sources',
  },
} as const;
