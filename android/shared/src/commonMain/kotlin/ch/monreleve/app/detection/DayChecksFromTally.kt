package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyEntity

// IOS-1b-A R602: MOVED FROM :app to :shared commonMain (package unchanged), so the shared Aujourd'hui controller
// can read it on every platform. Platform-free as it stood.
// recordCheck and hasCheck stay in :app (detection/DetectionSampler.kt), beside the DAO they write through.

/** Read the day's four checks from the stored row (an absent row -> all MISSED). No coordinate. */
fun TallyEntity.toDayChecks(): DayChecks =
    DayChecks(
        check1 = check1?.let(::classificationOrNull),
        check2 = check2?.let(::classificationOrNull),
        check3 = check3?.let(::classificationOrNull),
        check4 = check4?.let(::classificationOrNull),
    )

private fun classificationOrNull(name: String): Classification? {
    return runCatching { Classification.valueOf(name) }.getOrNull()
}
