// web/lib/fr/result.ts
//
// The result panel's own words: the warning banners, the contextual links, and
// the headings that hold the panel together.
//
// FW12 increment 1 establishes the module and the shell's copy; increment 4
// fills in the exhaustive warning and status maps and adds the type-level
// checks over both unions.
//
// EXHAUSTIVE BY TYPE, not by discipline. WARNING_COPY is declared
// Record<WarningCode, ...> and CONTEXTUAL_LINK is Record<Status, ...>, so a
// new engine code or a new status is a compile error here rather than a banner
// that renders nothing. SPEC 8's rule for ValidationError, applied to the two
// unions the panel reads.
//
// NO THRESHOLD FIGURES (R73). Every warning that concerns a ceiling names it
// with a formatted value the caller passes in, because a sentence containing
// "40 %" is a second source of truth that goes stale in silence. The mission
// cap is the same: "le plafond annuel", never "10 jours".
//
// VOCABULARY (SPEC 20). These are the sentences most likely to reach for
// "conforme" - they describe a position against a rule - and none does.
//
// TODO-COPY: realistic French, not reviewed by counsel.

import type { Status } from '@/lib/ui/core';
import type { Warning } from '@/lib/calc-engine';

type WarningCode = Warning['code'];

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

export interface WarningEntry {
  readonly heading: string;
  /** The body takes whatever formatted figures the code needs. */
  readonly body: string;
}

export const RESULT_COPY = {
  /** The region's accessible name. One h2; the panel is a section. */
  heading: 'Votre résultat',

  /**
   * Shown when the engine has a result but the input is incomplete - the
   * canton unchosen. FW11's wording, kept so the two pages read alike.
   */
  empty: 'Choisissez votre canton de travail pour lancer le calcul.',

  stale: 'Corrigez les champs ci-dessus pour obtenir un résultat.',

  /** The two tiles whose label does not name a ceiling. */
  tiles: {
    swiss: 'Jours imposés en Suisse',
    france: 'Jours imposés en France',
  },

  warningsHeading: 'À savoir',

  /**
   * ONE ENTRY PER ENGINE CODE, and the Record type is what keeps it that way.
   *
   * Each body is a function of the figures it needs, so no threshold is
   * written here. RULE_SET_FALLBACK and A1_REQUIRED both carry the wording
   * Checkpoint A settled: A1 applies from a quarter of telework, not from any
   * counted day at all.
   */
  warnings: {
    FISCAL_CEILING_EXCEEDED: {
      heading: 'Plafond fiscal dépassé',
      body:
        'Les jours au-delà du plafond deviennent imposables en France. Dans ' +
        "les cantons relevant de l'accord de 1983, le statut de frontalier " +
        'lui-même est en jeu.',
    },
    MISSION_CAP_EXCEEDED: {
      heading: 'Quota de missions dépassé',
      body:
        'Vos jours de mission dépassent le quota annuel. Les jours ' +
        'excédentaires sortent du régime de télétravail et restent ' +
        'imposables en France.',
    },
    MISSIONS_EXCEED_HEADROOM: {
      heading: 'Missions au-delà de la marge disponible',
      body:
        'Il ne reste pas assez de marge sous le plafond pour y faire entrer ' +
        'vos jours de mission. La part excédentaire est imposable en France.',
    },
    SOCIAL_CEILING_EXCEEDED: {
      heading: 'Seuil de sécurité sociale dépassé',
      body:
        'Votre affiliation à la sécurité sociale peut basculer en France. ' +
        "Ce seuil est distinct du seuil fiscal et n'a pas les mêmes " +
        'conséquences.',
    },
    A1_REQUIRED: {
      heading: 'Certificat A1 nécessaire',
      body:
        "À partir d'un quart de télétravail, l'accord-cadre européen " +
        "s'applique et suppose un certificat A1 en cours de validité, " +
        'délivré à la demande de votre employeur.',
    },
    FRONTALIER_STATUS_AT_RISK: {
      heading: 'Statut de frontalier en jeu',
      body:
        "Votre canton relève de l'accord de 1983, où un dépassement du " +
        'plafond met en cause le statut de frontalier et non seulement ' +
        "l'imposition des jours excédentaires.",
    },
    EXACT_METHOD_UNVERIFIED: {
      heading: 'Décompte exact fourni',
      body:
        'Le calcul utilise le nombre total de jours que vous avez saisi. Ce ' +
        "chiffre vient de votre employeur et n'a pas été vérifié.",
    },
    RULE_SET_FALLBACK: {
      heading: 'Règles non encore publiées',
      body:
        'Aucune règle publiée pour cette année. Le calcul applique celles de ' +
        "l'année la plus récente connue.",
    },
  } satisfies Record<WarningCode, WarningEntry>,

  /**
   * SPEC 9.3's contextual links: exactly one, chosen by status.
   *
   * THE HREFS ARE ALL PLANNED ROUTES TODAY, which is why the panel resolves
   * each through ctaHrefIfLive rather than rendering an anchor. Ruling R85: a
   * target renders only when it is live in the registry. Naming the
   * destination in text while it does not exist tells the reader the guide is
   * coming; linking to it would promise a 404 from a result panel.
   */
  links: {
    compliant: {
      text: 'Gardez une trace datée de vos journées',
      href: '/releve-annuel',
    },
    'mission-exposure': {
      text: 'Comprendre les jours de mission hors de Suisse',
      href: '/guides/jours-de-mission-hors-suisse',
    },
    'regime-lost': {
      text: 'Ce que change un dépassement du plafond fiscal',
      href: '/guides/teletravail-frontalier-40-pourcent',
    },
    'social-switch': {
      text: 'Le seuil de sécurité sociale, et ce qui bascule',
      href: '/guides/seuil-social-49-9-pourcent',
    },
  } satisfies Record<Status, { readonly text: string; readonly href: string }>,

  /** Shown in place of the link while its destination is not built. */
  linkPending: (text: string): string => `${text}${n(':')} guide à paraître`,
} as const;
