// web/lib/fr/errors.ts
//
// One French message per ValidationError code, and a French name per
// TeleworkInput field.
//
// SPEC 8: "ValidationError codes map one-to-one onto input error messages in
// lib/fr - a test enumerates the union and fails on any gap." The enumeration
// is a TYPE here, not a hand-maintained list: ERROR_COPY is declared
// Record<Code, string>, so tsc refuses a missing key AND an extra one, and
// the check runs before any test does. errorMessage's switch ends in a
// `never` assignment, which is a second independent compile-time guard.
//
// A code with no copy renders an empty error and blocks the user with no
// explanation; copy for a code that no longer exists is dead text nobody will
// ever delete. One-to-one means both.
//
// TODO-COPY: realistic French, not reviewed. Per tasks/plan.md's UI
// Discipline - never lorem ipsum, because fake text hides the wrapping and
// overflow problems real French reveals, and error messages are the strings
// most likely to be long.
//
// TWO RULES THESE SENTENCES OBEY, both asserted:
//
//   NO THRESHOLD FIGURES. A number written into copy is a second source of
//   truth that goes stale in silence - the message would still say 40 % after
//   a rule change, and nothing would fail. Thresholds live in the year's
//   RuleSet (SPEC 7.7).
//
//   VOCABULARY (SPEC 20): never certifie, atteste or conforme. "Non conforme"
//   is precisely how one would be tempted to phrase a validation failure, and
//   it is a forbidden word: it claims a judgement about compliance where the
//   product is only reporting that a number is out of range.

import type { TeleworkInput, ValidationError } from '@/lib/calc-engine';

type Code = ValidationError['code'];

/**
 * Every field of TeleworkInput, not merely those validate.ts reports on
 * today. NEGATIVE_DAYS and GRANULARITY_MISMATCH both carry
 * `field: keyof TeleworkInput`, so any of the nine can reach this layer the
 * moment a new check pushes one - and the Record type means adding a field to
 * the engine's input fails here until it is named.
 *
 * Written to slot into a sentence ("... pour les jours de teletravail"),
 * which is why each carries its article.
 */
export const FIELD_NAMES: Record<keyof TeleworkInput, string> = {
  taxYear: "l’année fiscale",
  canton: 'le canton',
  employmentRate: "le taux d’activité",
  periodFraction: 'la fraction de période',
  denominator: 'la méthode de calcul',
  granularity: 'la granularité',
  teleworkDays: 'les jours de télétravail',
  missionDaysFrance: 'les jours de mission en France',
  missionDaysThirdState: 'les jours de mission en pays tiers',
};

/**
 * The base sentence for each code. The two field-bearing codes complete
 * theirs in errorMessage, which is why their text ends where the field
 * begins.
 */
export const ERROR_COPY: Record<Code, string> = {
  RATE_OUT_OF_RANGE: "Le taux d’activité doit être compris entre 1 et 100.",

  PERIOD_OUT_OF_RANGE:
    'La fraction de période doit être supérieure à 0 et ne peut pas dépasser une année entière.',

  // Completed with the field name. "Ne peut pas être négatif" alone would
  // leave the user hunting a form for whichever number is below zero.
  NEGATIVE_DAYS: 'Cette valeur ne peut pas être négative :',

  // Half-days declared under a whole-day granularity, which is the case
  // calculate.ts names. The sentence says what to do, not merely what is
  // wrong.
  GRANULARITY_MISMATCH:
    'Cette valeur comporte une demi-journée alors que le décompte est en journées entières :',

  DAYS_EXCEED_TOTAL:
    'Le total des jours déclarés dépasse le nombre de jours travaillés dans la période.',

  TOTAL_WORK_DAYS_NOT_POSITIVE:
    'Le nombre de jours travaillés dans la période doit être supérieur à zéro.',
};

/**
 * The message a form shows for one error.
 *
 * A switch rather than a lookup, because the two field-bearing codes need
 * their `field` narrowed - and the `never` at the end is a second
 * compile-time exhaustiveness guard alongside ERROR_COPY's Record type. A
 * seventh code added to the engine's union fails BOTH, in tsc, before any
 * test runs.
 */
export function errorMessage(error: ValidationError): string {
  switch (error.code) {
    case 'NEGATIVE_DAYS':
    case 'GRANULARITY_MISMATCH':
      return `${ERROR_COPY[error.code]} ${FIELD_NAMES[error.field]}.`;

    case 'RATE_OUT_OF_RANGE':
    case 'PERIOD_OUT_OF_RANGE':
    case 'DAYS_EXCEED_TOTAL':
    case 'TOTAL_WORK_DAYS_NOT_POSITIVE':
      return ERROR_COPY[error.code];

    default: {
      // Unreachable while the union and this switch agree. If they stop
      // agreeing, this line is the compile error that says so.
      const exhaustive: never = error;

      return exhaustive;
    }
  }
}
