// web/lib/fr/result.ts
//
// The result panel's own words: the warning banners, the contextual links, and
// the headings that hold the panel together.
//
// FW12 increment 1 establishes the module and the shell's copy; increment 4
// adds the parameterised warning bodies, WARNING_CODES, and the type-level
// checks over both unions.
//
// EXHAUSTIVE BY TYPE, not by discipline. `links` is declared
// Record<Status, ...> and warningEntry is a switch over Warning['code'] whose
// default branch assigns to never, so a new engine code or a new status is a
// compile error here rather than a banner that renders nothing. SPEC 8's rule
// for ValidationError, applied to the two unions the panel reads.
//
// WHY warningEntry IS A SWITCH AND NOT A RECORD. Four of the eight codes
// carry data - the fallback its two years, the fiscal breach its regime, two
// others their excess - and a Record<Code, (payload) => string> cannot be
// CALLED without a cast: TypeScript will not correlate an index access with
// the argument distributed from the same union member, so `copy[w.code](w)`
// resolves the value to a union of function types and demands an
// intersection of their parameters. A switch on the discriminant narrows both
// sides at once, which is the whole point of the discriminant. The
// alternative was `as` on a boundary that exists to be type-safe.
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
  readonly body: string;
}

/**
 * Every code, in no particular order - the panel owns the reading order.
 *
 * This list exists because a union cannot be enumerated at runtime, and the
 * two checks below are what keep it honest in both directions: a code added
 * to the engine and not to this list, or a string here that is not a code,
 * is a compile error. Ruling R65's pattern, as used for the provisional-notice
 * triggers.
 */
export const WARNING_CODES = [
  'FISCAL_CEILING_EXCEEDED',
  'MISSION_CAP_EXCEEDED',
  'MISSIONS_EXCEED_HEADROOM',
  'SOCIAL_CEILING_EXCEEDED',
  'A1_REQUIRED',
  'FRONTALIER_STATUS_AT_RISK',
  'EXACT_METHOD_UNVERIFIED',
  'RULE_SET_FALLBACK',
] as const satisfies readonly WarningCode[];

/** Nothing in the list that is not a code. Enforced by the satisfies above. */
type EveryListedCodeExists = (typeof WARNING_CODES)[number] extends WarningCode ? true : never;

/** And nothing in the union missing from the list. */
type EveryCodeIsListed = WarningCode extends (typeof WARNING_CODES)[number] ? true : never;

/**
 * The two directions, asserted at compile time.
 *
 * A one-way check is the trap here: `satisfies readonly WarningCode[]` alone
 * accepts a list of three codes, and the exhaustiveness this file advertises
 * would be a list that happened to be complete on the day it was written.
 */
export const CODES_ARE_EXHAUSTIVE: [EveryListedCodeExists, EveryCodeIsListed] = [true, true];

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

/**
 * The words for one engine warning.
 *
 * NO THRESHOLD FIGURE APPEARS IN ANY BODY (R73). Every sentence that concerns
 * a ceiling names it in words - "le plafond", "un quart de télétravail",
 * "le quota annuel" - because a sentence containing "40 %" or "10 jours" is a
 * second source of truth that goes stale in silence after a rule change with
 * nothing failing. The figures belong to the tiles and the rail, where they
 * come from the year's RuleSet.
 *
 * THE PAYLOADS ARE USED WHERE THEY CHANGE THE SENTENCE, and only there. Two
 * codes carry an `excess` that is deliberately not printed: the tiles already
 * carry the day counts, and a number repeated in prose is a number that can
 * disagree with the one beside it.
 *
 * VOCABULARY (SPEC 20). These are the sentences most likely to reach for
 * "conforme" - they describe a position against a rule - and none does.
 *
 * TODO-COPY: realistic French, not reviewed by counsel.
 */
export function warningEntry(warning: Warning): WarningEntry {
  switch (warning.code) {
    case 'RULE_SET_FALLBACK':
      return {
        heading: 'Règles non encore publiées',
        // THE YEARS ARE NOT FORMATTED AS QUANTITIES. formatDays or any
        // grouping formatter renders 2099 as "2 099" with SPEC 6.4's U+202F -
        // a year is a label, not a count. Interpolated raw, deliberately.
        body:
          `Aucune règle n’est encore publiée pour ${warning.requestedYear}${n(':')} le ` +
          `calcul applique celles de ${warning.appliedYear}.`,
      };

    case 'FISCAL_CEILING_EXCEEDED':
      return {
        heading: 'Plafond fiscal dépassé',
        // THE REGIME CHANGES THE CONSEQUENCE, so it changes the sentence.
        // The body used to name the 1983 clause unconditionally, which said
        // "your status may be at stake" to every reader in a source-tax
        // canton where it is not - and repeated, for the readers where it is,
        // what FRONTALIER_STATUS_AT_RISK says on its own line just below.
        body:
          warning.regime === 'residence-1983'
            ? 'Les jours au-delà du plafond deviennent imposables en France, ' +
              'et votre canton est un canton où le dépassement met en cause ' +
              'le statut de frontalier lui-même.'
            : 'Les jours au-delà du plafond deviennent imposables en ' +
              "France. L’imposition à la source suisse ne couvre plus ces " +
              'journées.',
      };

    case 'MISSION_CAP_EXCEEDED':
      return {
        heading: 'Quota de missions dépassé',
        body:
          'Vos jours de mission dépassent le quota annuel. Les jours ' +
          'excédentaires sortent du régime de télétravail et restent ' +
          'imposables en France.',
      };

    case 'MISSIONS_EXCEED_HEADROOM':
      return {
        heading: 'Missions au-delà de la marge disponible',
        body:
          'Il ne reste pas assez de marge sous le plafond pour y faire entrer ' +
          'vos jours de mission. La part excédentaire est imposable en France.',
      };

    case 'SOCIAL_CEILING_EXCEEDED':
      return {
        heading: 'Seuil de sécurité sociale dépassé',
        body:
          'Votre affiliation à la sécurité sociale peut basculer en France. ' +
          "Ce seuil est distinct du seuil fiscal et n’a pas les mêmes " +
          'conséquences.',
      };

    case 'A1_REQUIRED':
      return {
        heading: 'Certificat A1 nécessaire',
        // The Checkpoint A correction: the accord applies from a quarter of
        // telework, not from any counted day at all.
        body:
          "À partir d’un quart de télétravail, l’accord-cadre européen " +
          "s’applique et suppose un certificat A1 en cours de validité, " +
          'délivré à la demande de votre employeur.',
      };

    case 'FRONTALIER_STATUS_AT_RISK':
      return {
        heading: 'Statut de frontalier en jeu',
        body:
          "Votre canton relève de l’accord de 1983, où un dépassement du " +
          'plafond met en cause le statut de frontalier et non seulement ' +
          "l’imposition des jours excédentaires.",
      };

    case 'EXACT_METHOD_UNVERIFIED':
      return {
        heading: 'Décompte exact fourni',
        body:
          'Le calcul utilise le nombre total de jours que vous avez saisi. Ce ' +
          "chiffre vient de votre employeur et n’a pas été vérifié.",
      };

    default: {
      // EXHAUSTIVENESS, and the reason this branch is not a thrown error with
      // a message. A new member of Warning makes this assignment a compile
      // error, which is where the failure belongs - the runtime alternative
      // is a banner nobody sees until a user hits it.
      const unhandled: never = warning;

      return unhandled;
    }
  }
}
