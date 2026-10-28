// web/lib/lamal/format.ts
//
// The comparator's amounts, in French. Pure; no Intl.
//
// WHY NOT lib/ui/core's formatters. They are pinned to TRUNCATION for the
// telework rates (R97: a filed rate is cut, never rounded) - right there and
// wrong here. And an amount in CHF is held in CENTIMES precisely so that no
// float ever reaches a formatter: 2 511,60 is 251160 centimes, and a
// formatter handed the float 2511.6 under truncation prints 2 511,59. So the
// digits are produced from integers by hand, with the same separators the
// rest of the product uses: U+202F between thousands, a comma for the
// decimal, U+00A0 before a unit.

const NNBSP = String.fromCharCode(0x202f);
const NBSP = String.fromCharCode(0x00a0);

/** 1234567 -> "1 234 567" with U+202F. Whole, non-negative numbers only. */
export function groupDigits(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`groupDigits needs a whole, non-negative number, received ${value}`);
  }

  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

/** CHF centimes -> "2 511,60 CHF". */
export function formatChf(centimes: number): string {
  const whole = Math.floor(centimes / 100);
  const cents = String(centimes % 100).padStart(2, '0');

  return `${groupDigits(whole)},${cents}${NBSP}CHF`;
}

/** Whole euros -> "2 718 €". */
export function formatEur(euros: number): string {
  return `${groupDigits(euros)}${NBSP}€`;
}

/** A whole percentage -> "8 %". */
export function formatWholePercent(percent: number): string {
  return `${groupDigits(percent)}${NBSP}%`;
}

/** The ECB rate in ten-thousandths -> "0,9239 CHF". */
export function formatRate(tenThousandths: number): string {
  const whole = Math.floor(tenThousandths / 10000);
  const fraction = String(tenThousandths % 10000).padStart(4, '0');

  return `${groupDigits(whole)},${fraction}${NBSP}CHF`;
}
