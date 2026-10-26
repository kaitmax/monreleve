package ch.monreleve.app.detection

// IOS-1b-A R602: MOVED FROM :app to :shared commonMain (package unchanged), so the shared Aujourd'hui controller
// can read it on every platform. Platform-free as it stood.
// R313, as R320 translates it. The app recognises someone who lives near the border FROM DATA IT ALREADY KEEPS,
// and NO COORDINATE. The day's four checks record how many landed in the 150 m strip; when that stays high,
// detection cannot be reliable where the person lives, so the app tells them once and offers manual - respected
// either way (manual is a peer, auto is never forced off, D19).
//
// THE RULE, as named constants (PROPOSED in docs/detection-model.md, FROZEN when the field test starts, R276):
//   - a working day is NEAR-BORDER when >= NEAR_BORDER_STRIP_CHECKS of its 4 checks land in the strip. Two of four
//     is 50 %, ABOVE the protocol's 40 % MEDIUM ceiling - a day a single bad reading cannot trigger (R320);
//   - the person is told when that holds on >= NEAR_BORDER_DAYS_THRESHOLD of their last NEAR_BORDER_WINDOW_DAYS
//     working days WITH DATA (a day at least one check was taken for).
//
// "Told once" and the choice are the UI's (increment 5); this is the pure rule, over DayChecks alone.

/** >= this many of a day's four checks in the 150 m strip makes the day near-border (R313/R320, PROPOSED). */
const val NEAR_BORDER_STRIP_CHECKS = 2

/** How many of the recent working days with data must be near-border before the person is told (R313). */
const val NEAR_BORDER_DAYS_THRESHOLD = 3

/** The window of recent working days with data the rule looks at (R313). */
const val NEAR_BORDER_WINDOW_DAYS = 5

/** A working day is near-border when at least NEAR_BORDER_STRIP_CHECKS of its checks are in the strip. */
fun isNearBorderDay(checks: DayChecks): Boolean = checks.stripCount() >= NEAR_BORDER_STRIP_CHECKS

/**
 * Whether to suggest manual recording for a near-border resident: at least NEAR_BORDER_DAYS_THRESHOLD of the last
 * NEAR_BORDER_WINDOW_DAYS working days WITH DATA are near-border. Days with no data (every check missed) are
 * excluded from the window entirely, so a stretch of airplane-mode days does not dilute the signal. `days` is in
 * chronological order; only the last window of with-data days is considered.
 */
fun shouldSuggestManualForNearBorder(days: List<DayChecks>): Boolean {
    val recentWithData = days.filter { it.hasData() }.takeLast(NEAR_BORDER_WINDOW_DAYS)
    return recentWithData.count { isNearBorderDay(it) } >= NEAR_BORDER_DAYS_THRESHOLD
}
