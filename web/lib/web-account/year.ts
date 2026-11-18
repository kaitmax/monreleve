// web/lib/web-account/year.ts
//
// Which years the account area is about. FW-WEB-ACCOUNT (R903), and Web
// Ruling 32 (W12, R1067): THE CURRENT TAX YEAR AND THE ONE BEFORE, NO SELECTOR.
//
// C9's page showed one year at a time, the current one or - through a link -
// any year up to it. The advisor's ruling replaces that: the area shows both
// years together, always, and nothing else. So the year is no longer read from
// the page's URL at all, and a download names one of these two years or is
// refused (lib/web-account/export.ts).
//
// THE CLOCK IS THE CALLER'S (lib/content/tax-year.ts, R55): currentTaxYear()
// is Europe/Paris, and both functions here take the current year as an
// argument so either side of a new year is testable.
//
// ONE PARSER (R206). A year in a download form is read by the API's own rule -
// four ASCII digits, parseReadQuery - exactly as GET /api/v1/export/* reads it.

import { parseReadQuery } from '@/lib/entries/read-query';

/**
 * The years the area shows, newest first: the current tax year and the one
 * before it. In January the current year is one no rule set exists for yet,
 * and the page says so with the engine's own warning (api-v1 6.5) rather than
 * hiding the year.
 */
export function accountYears(currentYear: number): readonly [number, number] {
  return [currentYear, currentYear - 1];
}

/** The year a form field names, or null for anything else. */
export function yearFrom(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;

  const parsed = parseReadQuery(new URL(`/?year=${encodeURIComponent(raw)}`, 'http://relative.invalid'));

  return parsed.ok ? parsed.year : null;
}

/**
 * The year a download form names, when it is one of the two years the area
 * shows; null otherwise. The page only ever offers these two, so any other
 * value did not come from it.
 */
export function accountYearFrom(raw: unknown, currentYear: number): number | null {
  const year = yearFrom(raw);

  return year !== null && accountYears(currentYear).includes(year) ? year : null;
}
