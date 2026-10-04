package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyEntity
import org.json.JSONArray
import org.json.JSONObject

// R320. The app's field export - what a tester hands over at the end of an AN6b run, and what score-field-run.mjs
// reads. THE MEASUREMENT BUILD TESTS WHAT SHIPS: it is scored on the SAME four-window vote the product uses, so a
// field run validates the detector people actually get (a field test of continuous sampling would validate a
// detector nobody uses).
//
// Per day: the vote tier, the voted kind (the SAME votedKind the product uses), each of the four checks, and the
// counts for diagnosis (taken / missed / in the strip). NO COORDINATE (R277) - the export is check sides and
// counts, exactly what Room holds; there is nothing else to leak.
//
// AN-NEXT-2 / R324: ALSO the provider counts - gpsChecks and networkChecks, how many of the day's checks came from
// GPS vs the NETWORK (wifi/cell) fallback. COUNTS ONLY (two integers from daily_tally), so the field scorer can see
// how often network location decided a day. Still no coordinate and still no accuracy value - these are counts.

fun exportFieldRun(tallies: List<TallyEntity>): String {
    val array = JSONArray()
    for (tally in tallies) {
        val checks = tally.toDayChecks()
        val item = JSONObject()
        item.put("dayDate", tally.dayDate)
        item.put("tier", voteTier(checks).name)
        item.put("proposedKind", votedKind(checks)?.name ?: JSONObject.NULL)
        item.put("check1", tally.check1 ?: JSONObject.NULL)
        item.put("check2", tally.check2 ?: JSONObject.NULL)
        item.put("check3", tally.check3 ?: JSONObject.NULL)
        item.put("check4", tally.check4 ?: JSONObject.NULL)
        item.put("checksTaken", checks.taken().size)
        item.put("checksMissed", checks.missedCount())
        item.put("stripChecks", checks.stripCount())
        item.put("gpsChecks", tally.gpsCheckCount)
        item.put("networkChecks", tally.networkCheckCount)
        array.put(item)
    }
    return array.toString()
}
