// web/lib/forecast/project.ts
//
// FW-FORECAST: the calculator's scenario, projected to 31 December.
//
// ============================================================================
// WHY THIS IS NOT THE SAME CODE PATH AS THE SHARED FIXTURE, AND WHY THAT IS
// SAFE ONLY BECAUSE A TEST SAYS SO
// ============================================================================
//
// The fixture walks entry ROWS: recorded days plus imagined days, through
// toTeleworkInput, into the engine. It can, because a dossier has rows.
//
// THE CALCULATOR HAS NO ROWS. It has a TeleworkInput already - a reader typed
// "84 jours" into a form, and nothing on the web side ever knew which 84 days
// those were. So the projection here adds the imagined telework days to the
// count the reader gave, and runs the SAME engine on the result.
//
// Those are two routes to one number, which is exactly the shape that becomes
// two engines if nobody checks (FW12, R340). tests/unit/forecast/project.test
// .ts drives every shared-fixture case through BOTH and asserts they agree, so
// the day they stop agreeing is a failing test rather than a wrong percentage
// on a page.
//
// ONLY THE TELEWORK COUNT MOVES, and the fixture is what establishes that
// rather than reasoning: `les-jours-suisses-ne-bougent-pas-le-taux` imagines
// five Swiss days and expects the rate NOT to move - 4,16 before and after.
// Under the 240-day basis the denominator is the rule set's, not a count of
// days worked; under the exact basis the reader supplies it. Neither is
// derived from the imagined days, so imagining a Swiss day changes nothing,
// and the one thing a rhythm can move is the numerator.

import { calculateTelework, type TeleworkInput, type TeleworkResult } from '@/lib/calc-engine';
import { imaginedEntriesToYearEnd, type Rhythm } from './imagined';

/** A scenario and the same scenario carried to 31 December. */
export interface Projection {
  /** The figure the reader has today, from the days they gave. */
  readonly current: TeleworkResult;
  /** The figure they are heading for if the rhythm holds. */
  readonly projected: TeleworkResult;
  /** Working days imagined between tomorrow and 31 December. */
  readonly imaginedWorkingDays: number;
  /** Those of them spent at home - the only ones that move the rate. */
  readonly imaginedTeleworkDays: number;
}

/**
 * The scenario with the rhythm's remaining telework days added.
 *
 * EXPORTED FOR THE AGREEMENT TEST, and that is its whole reason for being
 * separate: the test needs the projected INPUT to compare against the one the
 * fixture's row path builds, not just the rate that comes out of it.
 */
export function projectedInput(
  input: TeleworkInput,
  rhythm: Rhythm,
  today: Date,
): { readonly input: TeleworkInput; readonly working: number; readonly telework: number } {
  const imagined = imaginedEntriesToYearEnd(rhythm, today, input.taxYear);
  const telework = imagined.filter((entry) => entry.kind === 'HOME').length;

  return {
    input: { ...input, teleworkDays: input.teleworkDays + telework },
    working: imagined.length,
    telework,
  };
}

/**
 * The current figure and the December projection, or null.
 *
 * NULL WHERE THERE IS NO RHYTHM, rather than a projection equal to today's
 * figure. The question is optional and the prompt is explicit: "with none
 * checked, the calculator shows today's position only, as now." A projection
 * that merely repeated the current rate would be a claim about the rest of the
 * year that nobody made.
 *
 * NULL ALSO WHERE THE ENGINE REFUSES either scenario. A projection drawn
 * beside a refusal would be a figure with no basis, and the refusal is what
 * the reader needs to see.
 */
export function project(
  input: TeleworkInput,
  rhythm: Rhythm,
  today: Date,
): Projection | null {
  if (Object.keys(rhythm).length === 0) return null;

  const current = calculateTelework(input);

  if (!current.ok) return null;

  const { input: ahead, working, telework } = projectedInput(input, rhythm, today);
  const projected = calculateTelework(ahead);

  if (!projected.ok) return null;

  return {
    current: current.value,
    projected: projected.value,
    imaginedWorkingDays: working,
    imaginedTeleworkDays: telework,
  };
}
