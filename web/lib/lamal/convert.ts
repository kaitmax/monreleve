// web/lib/lamal/convert.ts
//
// CHF to EUR, and the franc slider's rate. FW-CALCS-A2, R747. Pure.
//
// ONE CONVERSION. compare() converted inline - round(centimes x 100 / rate
// in ten-thousandths) - and that expression now lives here, called by
// compare() for the reference rate and by the slider for its hypothesis. At
// 0 the slider's rate IS the reference object, so every euro figure on the
// page is the reference figure by construction (R751), not by a second
// computation that happens to agree.
//
// THE HYPOTHESIS RATE IS ROUNDED, AND THE FIGURES USE THE ROUNDED ONE. The
// slider shows "1 EUR = 0,8399 CHF" at +10 %; the euros are converted at
// that 0,8399, so a reader who divides a CHF figure by the rate shown gets
// the euro figure shown. The ECB reference is never modified: the shifted
// rate is a separate value, stated as the slider's hypothesis beside the
// reference and its date (row L14: the ECB's terms require a modification
// to be said).

import type { ExchangeRate } from './types';

/**
 * R747: the slider runs from -10 % to +10 % around the reference. A product
 * bound the operator set, not a regulatory figure.
 */
export const FRANC_SHIFT_LIMIT_PERCENT = 10;

/** CHF centimes to whole euros at a rate, rounded to the euro. */
export function convertAt(centimes: number, rate: ExchangeRate): number {
  return Math.round((centimes * 100) / rate.chfPerEurTenThousandths);
}

/**
 * The rate if the franc were `shiftPercent` stronger (positive) or weaker
 * (negative) against the euro: reference / (1 + shift), to the
 * ten-thousandth. At +10 %, 0,9239 / 1,1 = 0,8399. Same date as the
 * reference - it is a hypothesis about that rate, not another day's rate.
 */
export function francRate(reference: ExchangeRate, shiftPercent: number): ExchangeRate {
  if (shiftPercent === 0) return reference;

  return {
    chfPerEurTenThousandths: Math.round((reference.chfPerEurTenThousandths * 100) / (100 + shiftPercent)),
    date: reference.date,
  };
}
