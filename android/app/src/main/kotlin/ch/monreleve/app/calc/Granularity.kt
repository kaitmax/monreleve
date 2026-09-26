package ch.monreleve.app.calc

// AN2 increment 2: ports web/lib/calc-engine/granularity.ts.
//
// SPEC section 7.2 step 3. Converting hours into countable days. The rule
// lives here so that it exists exactly once.
//
//   | DAY      | 1 day if >4h, else 0                    |
//   | HALF_DAY | 1 if >4h; 1/2 if 2-4h; 0 if <2h         |
//   | HOURS    | Every hour counted                      |
//
// Source: circular no. 45 of 12 June 2019, point 7.5.1.
//
// The band edges are read strictly: "over 4h" is strictly greater than four,
// and "2-4h" is inclusive at both ends. So exactly 4h is a half day and
// exactly 2h is a half day.
//
// ---------------------------------------------------------------------------
// MISSION TRAVEL DAYS - documented here, deliberately NOT implemented.
//
// SPEC section 7.2 step 3 also states:
//   - no work performed            -> not counted
//   - work mostly in Switzerland   -> not counted
//   - work mostly abroad           -> counted
//   - on-call without intervention -> not counted
//   - on-call with intervention in France -> counted by duration
//
// These decide whether a mission day enters missionDaysFrance or
// missionDaysThirdState at all, which is an input question resolved before
// the engine is called, and they feed the waterfall in step 5. They are
// recorded here because this is the file about turning time into countable
// days, and a reader looking for them will look here first.
// ---------------------------------------------------------------------------

/** Hours strictly above this count as a full day. */
private const val FULL_DAY_ABOVE_HOURS = 4

/** Hours at or above this, up to and including FULL_DAY_ABOVE_HOURS, are half. */
private const val HALF_DAY_FROM_HOURS = 2

private const val HALF_DAY = 0.5

/**
 * Converts a number of telework hours into countable days under the given
 * granularity.
 *
 * Total by construction: SPEC section 7.4 types this as returning a number,
 * so it has no channel for a ValidationError, and the engine never throws.
 * A negative input therefore returns 0; negative day counts are rejected
 * upstream by the validation pass with NegativeDays.
 */
fun classifyTeleworkHours(
    hours: Double,
    granularity: Granularity,
): Double {
    if (!hours.isFinite() || hours <= 0) return 0.0

    return when (granularity) {
        Granularity.DAY -> if (hours > FULL_DAY_ABOVE_HOURS) 1.0 else 0.0

        Granularity.HALF_DAY ->
            when {
                hours > FULL_DAY_ABOVE_HOURS -> 1.0
                hours >= HALF_DAY_FROM_HOURS -> HALF_DAY
                else -> 0.0
            }

        Granularity.HOURS -> hours
    }
}
