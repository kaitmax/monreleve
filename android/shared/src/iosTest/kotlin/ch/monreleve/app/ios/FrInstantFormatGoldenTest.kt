package ch.monreleve.app.ios

import ch.monreleve.app.fr.text.FrenchFormatGoldens
import ch.monreleve.app.fr.text.GoldenPair
import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-1a R570. THE INSTANT FORMATTERS AGAINST ANDROID'S OUTPUT, on the simulator: every golden captured from
// java.time on Android (Paris, UTC, New York and Zurich; both DST changes of 2026 and 2027; offset inputs;
// fractional seconds; the refusals with their messages) through iOS's formatDateTime and formatDossierStamp.
// The calendar-day and number formats are commonMain and are checked by FrTextGoldenTest on both platforms.

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
