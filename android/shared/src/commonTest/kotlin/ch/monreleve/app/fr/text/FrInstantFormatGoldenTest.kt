package ch.monreleve.app.fr.text

import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-1a R570, moved from iosTest by AN-FR-TEXT R622. THE INSTANT FORMATTERS AGAINST ANDROID'S OUTPUT: every
// golden captured from java.time on Android (Paris, UTC, New York and Zurich; both DST changes of 2026 and 2027;
// offset inputs; fractional seconds; the refusals with their messages) through commonMain's formatDateTime and
// formatDossierStamp (FrInstants.kt). In commonTest it runs on the JVM AND the simulator, so it is also the proof
// that :app, which formats through these since R621, prints what its deleted java.time copy printed.
// The calendar-day and number formats are checked by FrTextGoldenTest the same way.

private fun check(
    name: String,
    goldens: List<GoldenPair>,
    actual: (String) -> String,
) {
    val misses = ArrayList<String>()
    for ((input, expected) in goldens) {
        val got =
            try {
                actual(input)
            } catch (e: IllegalArgumentException) {
                "IAE:" + e.message
            }
        if (got != expected) misses.add("$name input=$input expected=$expected got=$got")
    }
    assertTrue(misses.isEmpty(), "${misses.size} of ${goldens.size} $name goldens differ; first: ${misses.take(5)}")
}

class FrInstantFormatGoldenTest {
    @Test
    fun dateTimeInParisMatchesAndroid() =
        check(
            "DATETIME_PARIS",
            FrenchFormatGoldens.DATETIME_PARIS,
        ) { formatDateTime(it) }

    @Test
    fun dateTimeInUtcNewYorkAndZurichMatchesAndroid() {
        check("DATETIME_UTC", FrenchFormatGoldens.DATETIME_UTC) { formatDateTime(it, "UTC") }
        check("DATETIME_NY", FrenchFormatGoldens.DATETIME_NY) { formatDateTime(it, "America/New_York") }
        check("DATETIME_ZURICH", FrenchFormatGoldens.DATETIME_ZURICH) { formatDateTime(it, "Europe/Zurich") }
    }

    @Test
    fun dossierStampMatchesAndroid() = check("STAMP", FrenchFormatGoldens.STAMP) { formatDossierStamp(it) }

    @Test
    fun refusalsCarryAndroidsMessages() {
        check("DATETIME_INVALID", FrenchFormatGoldens.DATETIME_INVALID) { formatDateTime(it) }
        check("STAMP_INVALID", FrenchFormatGoldens.STAMP_INVALID) { formatDossierStamp(it) }
    }

    @Test
    fun theGoldensAreNotEmpty() {
        assertTrue(FrenchFormatGoldens.DATETIME_PARIS.size >= 380)
        assertTrue(FrenchFormatGoldens.STAMP.size >= 380)
    }
}
