// web/lib/calc-engine/calculate.ts
//
// ==========================================================================
// THE SEAM TO FW4. calculateTelework is declared, validates, and does not
// compute.
//
// FW4 owns the waterfall (SPEC 7.2 step 5), the declarable and raw rates
// (7.3), the headroom (step 6) and the warnings - and FW4 must write
// fixtures/geneva-cases.json and see it FAIL before that code exists. So this
// deliberately stops short.
//
// What it does do is real: it runs FW3's validation, so an invalid input gets
// its errors through the public API today. What it cannot do is produce a
// TeleworkResult, and it says so by returning ok:false with an EMPTY error
// list - "nothing wrong with your input, and no result either".
//
// That sentinel is a compromise and FW4 deletes it. SPEC 7.4's ValidationError
// union is a closed list of six input problems with no not-implemented code,
// and adding one would change the engine's public API (an ask-first item under
// SPEC section 20) and would then need French copy in lib/fr for a state no
// user can reach. An empty list keeps the public types exactly as specified.
// See REPORT-FW3.txt, QUESTIONS.
// ==========================================================================

import { ruleSetFor } from './rules';
import { validateInput } from './validate';
import type { Result, TeleworkInput, TeleworkResult, ValidationError } from './types';

export function calculateTelework(
  input: TeleworkInput,
): Result<TeleworkResult, readonly ValidationError[]> {
  const errors = validateInput(input, ruleSetFor(input.taxYear));

  if (errors.length > 0) return { ok: false, error: errors };

  // Valid input, no result: the waterfall is FW4's.
  return { ok: false, error: [] };
}
