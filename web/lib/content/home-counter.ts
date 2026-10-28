// web/lib/content/home-counter.ts
//
// THE HOME PAGE'S COUNTER, AS THE ENGINE SEES IT (FW-HOME-A2, R711).
//
// The approved design computed its rate and its remaining days with its own
// arithmetic - Math.floor(t * 10000 / base), Math.floor(base * 0.4 - t). That
// is a second formula, and a second formula is a second answer nobody verified
// against the tax administration. So the counter is NOT computed here either:
// this module only states the counter's DOCUMENTED SIMPLIFIED INPUT and hands it
// to calculateTelework, the function the Geneva fixtures gate.
//
// THE SIMPLIFICATION, stated once and shown on the page (HOME_COPY.counter.note):
//
//   - telework days and working days, from the two sliders;
//   - the EXACT denominator, because the second slider IS the year's working
//     days - the simplified 240-day basis would ignore it;
//   - no missions;
//   - no canton chosen by the reader. The engine requires one, so GE is
//     passed - the published reference canton, as heroExampleInput does. The
//     sweep test proves the three figures the counter shows are the SAME for
//     every canton over both sliders' whole ranges, which is what makes "sans
//     canton" a true sentence rather than a hope.
//
// SHARED BY THE SERVER AND THE ISLAND. The page renders counterFigures for the
// initial values, so the HTML carries a correct figure before any script runs,
// and the island calls the same function on every slider move.

import { calculateTelework } from '@/lib/calc-engine';
import type { Canton, TeleworkInput } from '@/lib/calc-engine';

/** A slider's range and the value the page opens on (the design's). */
export interface SliderRange {
  readonly min: number;
  readonly max: number;
  readonly initial: number;
}

/** Days teleworked since 1 January. */
export const COUNTER_TELEWORK: SliderRange = { min: 0, max: 140, initial: 62 };

/** Working days in the year - the exact denominator. */
export const COUNTER_BASIS: SliderRange = { min: 160, max: 240, initial: 220 };

/** The canton the engine is given, because it needs one. See the header. */
export const COUNTER_CANTON: Canton = 'GE';

/** The engine input for one position of the two sliders. */
export function counterInput(
  taxYear: number,
  teleworkDays: number,
  basisDays: number,
  canton: Canton = COUNTER_CANTON,
): TeleworkInput {
  return {
    taxYear,
    canton,
    employmentRate: 100,
    periodFraction: 1,
    denominator: { kind: 'exact', totalWorkDays: basisDays },
    granularity: 'day',
    teleworkDays,
    missionDaysFrance: 0,
    missionDaysThirdState: 0,
  };
}

/** The three numbers the counter shows, exactly as the engine returned them. */
export interface CounterFigures {
  readonly declarableRate: number;
  readonly remainingToFiscal: number;
  readonly remainingToSocial: number;
}

/**
 * The engine's answer for one slider position, or null if it refused the input.
 *
 * NULL RATHER THAN A THROW, and never a fallback figure: the sliders cannot
 * produce an input the engine refuses (both ranges are inside its validation),
 * and the sweep test proves that for every position. If a future RuleSet ever
 * refused one, the counter shows nothing rather than a number it made up.
 */
export function counterFigures(
  taxYear: number,
  teleworkDays: number,
  basisDays: number,
  canton: Canton = COUNTER_CANTON,
): CounterFigures | null {
  const outcome = calculateTelework(counterInput(taxYear, teleworkDays, basisDays, canton));

  if (!outcome.ok) return null;

  return {
    declarableRate: outcome.value.declarableRate,
    remainingToFiscal: outcome.value.remainingToFiscal,
    remainingToSocial: outcome.value.remainingToSocial,
  };
}
