// web/lib/fr/sources.ts
//
// Every word of /sources. RULING R113, FW12 increment 0.
//
// WHAT THIS PAGE IS FOR. The calculator applies eight constants and three
// readings that no source settles. Six of the eight were checked against the
// primary source on 09.09.2026; two could not be reached by any published
// example; and the three readings are waiting on an expert. A user who wants
// to know which is which has nowhere else to look, and P2 - the 49,9 edge - has
// no input trigger at all, so this page is its only disclosure.
//
// SPEC 20 IS AT ITS SHARPEST HERE. This is a page about what is and is not
// established, which makes every forbidden word tempting: "conforme" for a
// checked row, "certifie" for the transcription. Neither appears. The status
// words are TRANSCRIT and EN ATTENTE, and the vocabulary guard reads this file
// like every other.
//
// NO FIGURES (R73). Not one constant's value is written here - the table takes
// them from ruleSetFor(year) at render time. A page whose subject is where the
// numbers come from is the last place to keep a second copy of them.
//
// TODO-COPY: realistic French, not reviewed by counsel. On a page about
// pending review, that is worth saying twice.

import type { PublishedProvisionalId } from '@/lib/content/provisional';
import type { SourceId, SourceStatus } from '@/lib/content/sources';

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

export interface ProvisionalEntry {
  readonly heading: string;
  readonly body: string;
}

/**
 * The three absences this page discloses.
 *
 * A UNION RATHER THAN A FREE RECORD, for the reason R113 gave the provisional
 * readings one: a fourth thing this site declines to publish has to appear
 * here AND in the page, or it does not compile. An absence that is disclosed
 * nowhere is the state this section exists to end.
 */
export const UNKNOWN_IDS = ['attestation', 'declaration', 'primes'] as const;

export type UnknownId = (typeof UNKNOWN_IDS)[number];

export const SOURCES_COPY = {
  title: 'Sources et vérifications',

  description:
    'Les sources primaires des règles appliquées par le calculateur, leur ' +
    'état de vérification, et les trois lectures qui attendent un avis ' +
    'expert.',

  /**
   * THE COUNTS ARE DERIVED, and FW20 found out why on a live server.
   *
   * This read "huit constantes et trois lectures" as a constant. FW18b took
   * SOURCE_IDS from eight to fourteen - the six CLEISS and R158 rows - and
   * nobody changed the sentence, so the page whose entire subject is accuracy
   * opened by miscounting itself by six. The table beneath it was right the
   * whole time; no test compares the two, and no reader would check.
   *
   * R171: the sentence means "how many rows this page carries", which is a
   * role. A literal standing in for it was accidentally correct for exactly
   * one task.
   */
  /**
   * THE SUBJECT WAS WRONG AND THE COUNT MADE IT VISIBLE (FW20b).
   *
   * It said "LE CALCULATEUR applique N constantes". The calculator applies
   * ten of them - the telework ceilings, the mission cap, the Geneva
   * examples. The seven droit d'option rows are facts the GUIDES cite and the
   * engine never touches: no code path reads droitOptionWindow.
   *
   * It was already false at fourteen, when FW18b added four CLEISS rows, and
   * nothing noticed because the count derives correctly (R171) and a derived
   * count is right about arithmetic while the sentence around it is wrong
   * about the subject. FW20b's three more made it seven of seventeen, which
   * is the point at which reading the page out loud catches it.
   *
   * "Ce site" is the honest subject: this table is the register of every
   * regulatory fact the product stands on, whoever consumes it - which is
   * what /a-propos already promises in so many words ("ce qui n'y figure pas
   * n'est utilise nulle part sur ce site").
   */
  intro: (constants: number, readings: number): string =>
    `Ce site s’appuie sur ${constants} constantes et ${readings} lectures. Cette page ` +
    'indique pour chacune sa source primaire et son état. Elle est tenue à ' +
    'jour à la main, et sa date de dernière vérification est celle qui ' +
    'figure au bas de chaque page.',

  /** R51's date, restated where a reader is looking for it. */
  reviewedOn: (date: string): string => `Dernière vérification réglementaire${n(':')} ${date}`,

  tableHeading: 'Les constantes et leurs sources',

  columns: {
    rule: 'Règle',
    value: 'Valeur appliquée',
    source: 'Source primaire',
    verifiedOn: 'Relevé le',
    status: 'État',
  },

  /**
   * The status words, and neither of them is "conforme".
   *
   * TRANSCRIT says the value was read off the primary source and matches. It
   * does NOT say a lawyer agreed with the reading, which is why the note under
   * the table says so in one more sentence.
   */
  status: {
    transcribed: 'Transcrit',
    pending: 'En attente',
  } satisfies Record<SourceStatus, string>,

  statusNote:
    'Transcrit signifie que la valeur a été relevée sur la source primaire et ' +
    "qu’elle correspond. Cela ne signifie pas qu’un avis juridique a validé " +
    'la lecture retenue.',

  pendingNote:
    "Deux règles n’ont pu être atteintes par aucun exemple publié" +
    n(':') +
    ' le découpage des journées, parce que les cas publiés comptent des ' +
    "journées et non des heures, et la liste des cantons relevant de l’accord " +
    'de 1983, parce que Genève relève du régime de la source.',

  /** One line per row of SOURCE_ENTRIES. Keyed, so tsc refuses a gap. */
  rules: {
    fiscalCeiling: "Plafond fiscal annuel de télétravail, en part du temps de travail",
    missionCapDays: 'Quota annuel de jours de mission hors de Suisse, compté à ' +
      "l’intérieur du plafond fiscal",
    missionCapProration:
      'Réduction du quota de missions pour un temps partiel ou une année ' +
      'incomplète, arrondie vers le haut',
    socialCeiling:
      "Plafond d’affiliation à la sécurité sociale, sous réserve d’un " +
      'certificat A1 en cours de validité',
    simplifiedBasisDays: 'Base simplifiée de jours travaillés par an, à temps plein',
    dayClassification: 'Conversion des heures en journées et demi-journées',
    residence1983Cantons: "Cantons relevant de l’accord de 1983, où le statut de " +
      'frontalier lui-même est en jeu',
    a1ThresholdRate:
      "Part de télétravail à partir de laquelle l’accord-cadre européen " +
      "s’applique",

    // R158: three facts published on one ge.ch page, three ids.
    missionTravelDays:
      "Jours de trajet d’une mission : ce qui est compté et ce qui ne " +
      "l’est pas",
    genevaWorkedExamples:
      "Exemples chiffrés publiés par l’administration genevoise",

    // Le droit d’option, vérifié contre le CLEISS.
    droitOptionWindow:
      "Délai pour choisir son système d’assurance maladie, et les " +
      "situations qui l’ouvrent",
    droitOptionIrrevocable:
      "Caractère irrévocable du choix, et les changements de situation qui " +
      "permettent d’y revenir",
    droitOptionDefault:
      "Régime applicable à défaut de choix dans le délai",
    droitOptionBasis:
      "Textes qui fondent le droit d’option",
    droitOptionFamily:
      "Couverture des membres de la famille sans activité professionnelle " +
      "propre ni pension du seul régime suisse",
    droitOptionFiling:
      "Organisme auprès duquel le choix s’exerce, selon la situation",
    droitOptionForm:
      "Formulaire par lequel le choix s’exerce",
  } satisfies Record<SourceId, string>,

  /**
   * Shown in the date column of a row that was never read.
   *
   * An em dash rather than an empty cell: an empty cell in a verification
   * table reads as data somebody forgot, and these two absences are the
   * point rather than an oversight.
   */
  notRead: String.fromCharCode(0x2014),

  /** Rows that state a rule rather than hold a number. */
  noValue: 'règle, sans valeur chiffrée',

  settledHeading: 'Ce que les textes officiels établissent désormais',

  settledIntro:
    'Deux points que le calculateur appliquait sans source primaire sont ' +
    'désormais rattachés à un texte officiel, et un troisième a été corrigé ' +
    'pour suivre ce texte' +
    n(':') +
    ' l’ordre d’imputation des missions et le plafond social, par l’accord ' +
    'amiable franco-suisse du 29 avril 2026 et par l’autorité suisse' +
    n(';') +
    ' et la réduction du quota de missions pour un temps partiel ou une année ' +
    'incomplète, au décompte exact comme à la base simplifiée. La transcription ' +
    'est faite' +
    n(';') +
    ' la revue juridique de leur application reste attendue, comme pour chaque ' +
    'ligne du tableau ci-dessus.',

  readingHeading: 'Ce qui reste une lecture de ce site',

  readingIntro:
    'Sur le point ci-dessous, les textes ne tranchent pas explicitement. Le ' +
    'calculateur a retenu une lecture, indiquée ici, et le résultat peut ' +
    'évoluer si cette lecture change.',

  /**
   * P1, P2 and P3 in plain French, as R113 asks.
   *
   * Keyed by PublishedProvisionalId, so a fourth reading cannot be added to
   * the trigger list without a paragraph here - which is the disclosure hole
   * R113 exists to close, expressed in the type.
   */
  provisional: {
    P1: {
      heading: "L’ordre d’imputation des jours de mission",
      body:
        'Quand des jours de mission concernent à la fois la France et un pays ' +
        'tiers, le calculateur impute la France en premier. L’accord amiable ' +
        'franco-suisse du 29 avril 2026 (point 1b) prend en compte les ' +
        "missions dans l’État de résidence avant celles dans un pays tiers, ce " +
        'qui est précisément cet ordre. Les cas publiés par l’administration ' +
        'genevoise traitaient les deux comme un seul ensemble' +
        n(';') +
        ' l’accord, lui, les ordonne. La revue juridique de son application ' +
        'reste attendue.',
    },
    P2: {
      heading: 'Le plafond social de 49,9, et son bord entre 49,9 et 50',
      body:
        'L’autorité suisse publie un maximum de 49,9, que le calculateur ' +
        'applique. Le texte de l’accord-cadre parle de moins de 50' +
        n(';') +
        ' entre les deux subsiste un intervalle étroit où un frontalier est en ' +
        'dessous de ' +
        'la limite légale et où le calculateur avertit quand même. Avertir un ' +
        'peu tôt est le sens prudent pour un signal qui déclenche un texte et ' +
        'aucun calcul, et la troncature à deux décimales atteint réellement ' +
        'ces valeurs. Ce choix d’avertissement reste à confirmer.',
    },
    P3: {
      heading: 'La réduction du quota de missions au décompte exact',
      body:
        'L’accord du 29 avril 2026 (point 1d) réduit le quota de jours de ' +
        'mission pour un temps partiel ou une année incomplète, arrondi vers le ' +
        'haut, sans condition sur la méthode de décompte' +
        n(':') +
        ' le calculateur réduit donc le quota par le taux d’activité et par la ' +
        'fraction d’année, au décompte exact comme à la base simplifiée. Ce que ' +
        'l’accord ne tranche pas explicitement, c’est le cas combiné — temps ' +
        'partiel ET année incomplète à la fois —, qu’il nomme comme deux ' +
        'situations distinctes' +
        n(';') +
        ' appliquer les deux réductions ensemble reste la lecture de ce site.',
    },
  } satisfies Record<PublishedProvisionalId, ProvisionalEntry>,

  /**
   * WHAT THIS SITE DOES NOT KNOW, and the reason it is a section rather than
   * a silence.
   *
   * Three tasks have now refused to publish something for want of a source -
   * the employer attestation obligation, the French declaration calendar, the
   * LAMal premium data. Each refusal was recorded in the repository and was
   * invisible to anyone outside it, so a reader looking for one of those
   * figures learned only that this site does not have it, by its absence, and
   * had no way to tell a deliberate refusal from an oversight.
   *
   * EACH ENTRY SAYS WHAT IS MISSING AND WHY IT IS NOT WRITTEN. None says when
   * it will arrive: that is a promise, and SPEC 20's vocabulary rule is the
   * standard on this page above all others.
   *
   * AUTHORED, NOT LIFTED (R165). The parking entries these come from are
   * written for the operator and carry the alternative considered and the cost
   * of switching. A reader needs neither; they need to know what is absent and
   * that its absence was chosen.
   */
  unknownsHeading: 'Ce que ce site ne sait pas',

  unknownsIntro:
    'Trois sujets reviennent souvent et ne figurent nulle part sur ce site. ' +
    "Ce n’est pas un oubli : aucune source primaire n’a pu être vérifiée " +
    'pour eux, et ce site ne publie pas une information réglementaire ' +
    "qu’il ne peut pas rattacher à son texte d’origine. Les nommer vaut " +
    'mieux que de vous laisser les chercher.',

  unknowns: {
    attestation: {
      heading: "Ce qu’un employeur doit ou non vous remettre",
      body:
        "Rien ici ne dit qu’un employeur doive vous remettre un document " +
        'indiquant votre part de télétravail, ni depuis quand, ni sous quelle ' +
        'forme. Le guide consacré à ce document est écrit au conditionnel ' +
        "pour cette raison : il explique comment le lire si vous en recevez " +
        "un, et n’affirme pas qu’il vous en soit dû un.",
    },
    declaration: {
      heading: 'Les dates et les formulaires de la déclaration française',
      body:
        'Aucune date limite, aucun numéro de formulaire, aucune marche à ' +
        'suivre case par case. Une date de déclaration est une information ' +
        "réglementaire au même titre qu’un plafond, et une date fausse sur " +
        "cette page coûterait à un lecteur bien plus qu’une date absente. " +
        'Votre centre des finances publiques la publie.',
    },
    primes: {
      heading: "Le coût comparé de l’assurance maladie suisse et française",
      body:
        "Ce site ne dispose d’aucune donnée de primes qu’il puisse citer. Il " +
        'ne publie donc pas de comparateur de coût, et le guide du droit ' +
        "d’option ne donne aucun montant. Sur un choix qui ne se reprend " +
        'pas, un chiffre approximatif serait plus dangereux que pas de ' +
        'chiffre du tout.',
    },
  } satisfies Record<UnknownId, ProvisionalEntry>,

  /** The engine's own verification state, in one line. */
  fixturesHeading: 'Les cas de référence',

  fixtures:
    "Le moteur de calcul reproduit six cas publiés par l’administration " +
    "fiscale genevoise, y compris leur arrondi. Un écart sur l’un de ces cas " +
    'empêche toute mise en production.',
} as const;
