// web/lib/ui/core/format/date.ts
//
// SPEC 6.4: "formatDate -> Swiss dots." SPEC 8: the Releve annuel names days,
// so a day-boundary bug here is a WRONG RECORD rather than a cosmetic slip.
//
// RULING R28. A calendar day is an ISO YYYY-MM-DD string end to end - column,
// API, formatter. A Date object never represents a day. Instants are ISO
// timestamps rendered in Europe/Paris.
//
// THAT RULING REMOVES A BUG RATHER THAN GUARDING ONE. A Date is an instant,
// and reading an instant's calendar fields requires choosing a zone; get the
// zone wrong and the day is wrong. Measured in FW6 for
// new Date('2026-12-18T00:00:00Z'): 18.12.2026 under UTC and Europe/Paris,
// 17.12.2026 under America/New_York - so an unpinned formatter was correct in
// the dev checkout AND in CI (both non-western) and a day wrong for every
// user west of Greenwich. A YYYY-MM-DD string carries no instant, so
// formatDate below touches no zone, no Intl and no Date arithmetic. There is
// no longer a mechanism for that defect to occur.
//
// formatDateTime keeps Intl, because rendering an instant as a Paris wall
// clock IS a zone conversion. Its zone is pinned, never inherited.
//
// WHY THE FIELDS ARE READ AND ICU'S PARTS ARE NOT JOINED. Measured on Node
// 22.14 / ICU 76.1 / CLDR 46: only the -CH tags give date dots (fr-FR gives
// 18/12/2026 with U+002F), en-US orders month before day so joining parts in
// the order given yields 12.18.2026, and format() and formatToParts()
// disagree for the SAME formatter - en-US timeStyle 'short' yields U+0020
// from one and U+202F from the other. So Intl supplies the field VALUES and
// this file writes every separator.

/**
 * A timestamp is an instant, and the audience is cross-border workers living
 * in France, so they read it in their own wall clock.
 */
export const DATE_TIME_ZONE = 'Europe/Paris';

/** U+002E FULL STOP. The Swiss date separator (SPEC 6.4). */
const DATE_SEPARATOR = '.';

/** U+00E0 LATIN SMALL LETTER A WITH GRAVE, precomposed. */
const AT = '\u00E0';

/** U+003A COLON, between hours and minutes. */
const TIME_SEPARATOR = ':';

/**
 * U+00A0 NO-BREAK SPACE, on BOTH sides of the a-grave (ruling R29), so the
 * timestamp is one unbreakable token. A plain space lets a narrow column
 * break "18.06.2027" away from "18:03" and leave a reader holding half a
 * timestamp - on a document whose whole purpose is that every recorded day
 * carries a server-assigned time.
 */
const AT_SPACE = '\u00A0';

/**
 * Used for NOTHING that reaches the output. Every field is requested
 * numerically and every separator is written above, so this could be any tag
 * - the property the tests pin by feeding normaliseDate parts from fr-FR and
 * en-US and requiring the same answer.
 */
const LOCALE = 'fr-CH';

const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

const NUMERIC_TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  // 'h23', not hour12:false. hour12:false selects the h24 cycle in some
  // locales, which renders midnight as 24:00 on the previous day.
  hourCycle: 'h23',
};

/**
 * A calendar day, from its ISO YYYY-MM-DD string. Swiss dots, four-digit
 * year, no zone, no Intl - a pure string transform (R28).
 *
 * VALIDATION IS ONE ROUND TRIP, and it has to be. `new Date()` does not
 * reject an impossible day, it ROLLS IT OVER: measured,
 * '2026-02-30T00:00:00.000Z' parses to 2026-03-02, and '2026-02-29' - 2026
 * is not a leap year - parses to 2026-03-01. A NaN check alone would
 * therefore print "30.02.2026" on a filing. Rebuilding the canonical ISO day
 * from the parsed fields and requiring it to equal the input rejects that,
 * and in the same comparison rejects a timestamp, a 1-digit day, a 2-digit
 * year and a Swiss-formatted string - whatever the engine's fallback parser
 * chooses to make of them, the canonical form will not match.
 */
export function formatDate(isoDay: string): string {
  const parsed = new Date(`${isoDay}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError(`formatDate needs an ISO YYYY-MM-DD day, received ${JSON.stringify(isoDay)}`);
  }

  const year = String(parsed.getUTCFullYear()).padStart(4, '0');
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');

  if (`${year}-${month}-${day}` !== isoDay) {
    throw new RangeError(
      `${JSON.stringify(isoDay)} is not a real calendar day in ISO YYYY-MM-DD form`,
    );
  }

  return `${day}${DATE_SEPARATOR}${month}${DATE_SEPARATOR}${year}`;
}

function fieldOf(parts: readonly Intl.DateTimeFormatPart[], type: string): string {
  const found = parts.find((part) => part.type === type);

  if (found === undefined) {
    throw new RangeError(`date parts carry no ${type} field`);
  }

  return found.value;
}

/**
 * Assemble dd.mm.yyyy from date parts, reading fields and writing the
 * separators. Exported as the seam where locale-independence is testable.
 */
export function normaliseDate(parts: readonly Intl.DateTimeFormatPart[]): string {
  const day = fieldOf(parts, 'day');
  const month = fieldOf(parts, 'month');
  const year = fieldOf(parts, 'year');

  return `${day}${DATE_SEPARATOR}${month}${DATE_SEPARATOR}${year}`;
}

/** Assemble "dd.mm.yyyy a hh:mm" from date-and-time parts, a-grave bound by U+00A0 (R29). */
export function normaliseDateTime(parts: readonly Intl.DateTimeFormatPart[]): string {
  // A dayPeriod means the parts came from a 12-hour formatter, where the hour
  // field reads 06 for 18:00 and the meaning lives in a separate localised
  // part. Recovering 18 would mean parsing "PM" in whatever form the locale
  // supplies, and getting that wrong renders a timestamp twelve hours out
  // while looking perfectly well-formed. Rejected instead.
  if (parts.some((part) => part.type === 'dayPeriod')) {
    throw new RangeError(
      'date parts carry a dayPeriod: build the formatter with hourCycle h23, ' +
        'because a 12-hour hour field cannot be rendered as 24-hour time',
    );
  }

  const hour = fieldOf(parts, 'hour');
  const minute = fieldOf(parts, 'minute');

  return `${normaliseDate(parts)}${AT_SPACE}${AT}${AT_SPACE}${hour}${TIME_SEPARATOR}${minute}`;
}

/**
 * An instant, from its ISO timestamp string, as "18.06.2027 a 18:03"
 * (SPEC 6.4) in 24-hour time.
 *
 * The zone defaults to Europe/Paris and is PINNED, never inherited: a
 * DateTimeFormat with no timeZone resolves to the host's, which is correct on
 * a French laptop, correct in CI, and wrong for anyone else.
 */
export function formatDateTime(iso: string, timeZone: string = DATE_TIME_ZONE): string {
  const instant = new Date(iso);

  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`formatDateTime needs an ISO timestamp, received ${JSON.stringify(iso)}`);
  }

  return normaliseDateTime(
    new Intl.DateTimeFormat(LOCALE, {
      ...NUMERIC_DATE,
      ...NUMERIC_TIME,
      timeZone,
    }).formatToParts(instant),
  );
}
