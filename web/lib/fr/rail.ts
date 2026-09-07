// web/lib/fr/rail.ts
//
// Every word the rail renders. SPEC section 5: user-facing strings come from
// lib/fr only - and the rail is the module about to emit the most text nodes
// in the codebase, in a .ts file that react/jsx-no-literals cannot see.
//
// KEYED BY ZONE, NEVER BY STATUS, and deliberately not reusing STATUS_COPY
// even where a string would coincide. 'compliant' and 'social-switch' are
// members of BOTH unions, so one record keyed on the bare literal would
// conflate the two axes with no type error - the same trap zone-tokens.ts
// documents for the colours. SPEC 6.2 calls colouring the rail by Status a
// review rejection; borrowing the badge's WORDS is the same rejection said
// differently.
//
// RULING R36. The three band names are parallel: each states what happens to
// you in that band rather than describing a position.
//
//   Imposition Suisse . Imposition France . Sécurité sociale France
//
// The earlier draft, 'Conforme (0-40)', was doubly wrong. 'Conforme' is
// BANNED VOCABULARY - CLAUDE.md, README.md, SPEC section 20 and
// DESIGN-SYSTEM.md all forbid certifié / attesté / conforme / validé /
// approuvé - and it would have reached the PDF's text layer, where FW25's
// test asserts none of those words appears. A defect planted two tasks
// upstream of the test that catches it. Its parenthesised ranges were also
// wrong under R32.
//
// TODO-COPY: realistic and unreviewed, per tasks/plan.md's UI Discipline.
//
// NO THRESHOLD NUMBERS in any of these strings. The figures come from the
// year's RuleSet (SPEC 7.7) and a number written into copy goes stale
// silently - the same rule statuses.ts follows. The rail draws its ticks from
// the thresholds it is given and labels them with the formatter.

/**
 * The band names, above the rail. Micro 11/14, secondary colour.
 *
 * Keys are the Zone union's members, written out rather than imported so
 * lib/fr keeps no dependency on lib/ui/core. zones.ts holds the type; a test
 * asserts these keys and that union agree in both directions.
 */
export const ZONE_BAND_NAME = {
  compliant: 'Imposition Suisse',
  'fiscal-exposure': 'Imposition France',
  'social-switch': 'Sécurité sociale France',
} as const;

/**
 * The rail's accessible name, assembled from the ALREADY-FORMATTED rate.
 *
 * The number arrives formatted so that the copy stays in lib/fr and the
 * figure stays with the formatter - SPEC 6.4's "every number through
 * format/". This is not a placeholder-substitution helper and must not grow
 * into one: SPEC section 1 lists an i18n abstraction as a non-goal, and there
 * is exactly one locale.
 *
 * Rate first, because that is what a listener needs before the qualification.
 * No banned vocabulary, and no threshold figures.
 */
export const ZONE_SPOKEN = {
  compliant: 'imposition en Suisse',
  'fiscal-exposure': 'une partie est imposable en France',
  'social-switch': 'seuil de sécurité sociale dépassé',
} as const;

export function railAriaLabel(
  formattedRate: string,
  zone: keyof typeof ZONE_SPOKEN,
): string {
  return `Taux de télétravail déclarable ${formattedRate}, ${ZONE_SPOKEN[zone]}.`;
}

/**
 * The social card's accessible name. It names NO rate and NO zone, because
 * ruling R44 makes that card generic - it illustrates where the thresholds
 * sit, it does not report anyone's result. No figures either, per the rule
 * this file already follows.
 */
export const RAIL_SOCIAL_ARIA = 'Illustration des deux seuils de télétravail déclarable.';

/**
 * Ruling R33's third state. Not a colour and not an empty rail - a word.
 *
 * A statement rather than the bare adjective, so the text half of
 * SPEC section 16's "never colour-only" is still carried when there is no
 * band colour to show.
 */
export const RAIL_UNAVAILABLE_LABEL = 'Taux indisponible';

export const RAIL_UNAVAILABLE_ARIA = 'Taux de télétravail déclarable indisponible.';
