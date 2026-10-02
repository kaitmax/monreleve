package ch.monreleve.app.detection

// AN-AUTO increment 6 (R313). The app recognises someone who lives near the border FROM DATA IT ALREADY KEEPS,
// and NO COORDINATE. The daily tally counts how many fixes fell in the 150 m buffer; when that share stays
// high, detection cannot be reliable where the person lives, so the app tells them once and offers manual -
// respected either way (manual is a peer, auto is never forced off, D19).
//
// THE RULE, as named constants citing the field protocol (R276, PROPOSED in docs/detection-model.md, FROZEN
// when the field test starts):
//   - a working day is NEAR-BORDER when its buffer-fix share is ABOVE MEDIUM_BUFFER_SHARE (the field
//     protocol's MEDIUM ceiling) - above it a day cannot even reach MEDIUM (Proposal.computeTier);
//   - the person is told when that holds on >= NEAR_BORDER_DAYS_THRESHOLD of their last NEAR_BORDER_WINDOW_DAYS
//     working days WITH DATA (a day the sampler produced any fix for).
//
// A threshold chosen after seeing field data is tuned to pass, so this reuses the already-encoded protocol
// constant and freezes with it. "Told once" and the choice are the UI's (increment 5); this is the pure rule.

/** How many of the recent working days with data must be near-border before the person is told (R313). */
const val NEAR_BORDER_DAYS_THRESHOLD = 3

/** The window of recent working days with data the rule looks at (R313). */
const val NEAR_BORDER_WINDOW_DAYS = 5

/**
 * A working day is near-border when its share of fixes in the 150 m buffer is ABOVE the field protocol's MEDIUM
 * ceiling - above it the day cannot even reach MEDIUM. A day with no data (no fixes) is never near-border.
 */
fun isNearBorderDay(tally: DailyTally): Boolean =
    tally.fixCount > 0 && tally.bufferFixCount.toDouble() / tally.fixCount > MEDIUM_BUFFER_SHARE

/**
 * Whether to suggest manual recording for a near-border resident: at least NEAR_BORDER_DAYS_THRESHOLD of the
 * last NEAR_BORDER_WINDOW_DAYS working days WITH DATA are near-border. Days with no data are excluded from the
 * window entirely, so a stretch of airplane-mode days does not dilute the signal. `tallies` is in chronological
 * order; only the last window of with-data days is considered.
 */
fun shouldSuggestManualForNearBorder(tallies: List<DailyTally>): Boolean {
    val recentWithData = tallies.filter { it.fixCount > 0 }.takeLast(NEAR_BORDER_WINDOW_DAYS)
    return recentWithData.count { isNearBorderDay(it) } >= NEAR_BORDER_DAYS_THRESHOLD
}
