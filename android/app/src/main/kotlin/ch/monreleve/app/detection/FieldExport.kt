package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyEntity
import org.json.JSONArray
import org.json.JSONObject

// AN6a increment 6. The app's field export - what a tester hands over at the end of an AN6b run,
// and what score-field-run.mjs reads. Per day: the tier, the proposed kind (derived by the SAME
// proposedKind the app uses, so the export matches what was proposed), and the tally counts for
// diagnosis. NO COORDINATE (R277) - the export is minutes, counts and a tier, exactly what Room
// holds; there is nothing else to leak.

fun exportFieldRun(tallies: List<TallyEntity>): String {
    val array = JSONArray()
    for (tally in tallies) {
        val tier = tally.tier?.let { runCatching { Tier.valueOf(it) }.getOrNull() } ?: Tier.LOW
        val daily = DailyTally(tally.minutesSwitzerland, tally.minutesElsewhere, tally.fixCount, tally.bufferFixCount)
        val item = JSONObject()
        item.put("dayDate", tally.dayDate)
        item.put("tier", tier.name)
        item.put("proposedKind", proposedKind(daily, tier)?.name ?: JSONObject.NULL)
        item.put("minutesSwitzerland", tally.minutesSwitzerland)
        item.put("minutesElsewhere", tally.minutesElsewhere)
        item.put("fixCount", tally.fixCount)
        item.put("bufferFixCount", tally.bufferFixCount)
        array.put(item)
    }
    return array.toString()
}
