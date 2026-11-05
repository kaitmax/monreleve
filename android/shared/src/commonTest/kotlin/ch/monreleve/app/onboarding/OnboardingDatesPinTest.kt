package ch.monreleve.app.onboarding

import ch.monreleve.app.fr.OnboardingCopy
import kotlin.test.Test
import kotlin.test.assertEquals

// IOS-2b R777. THE ONBOARDING DATES, PINNED BEFORE THEY LEAVE java.time.
//
// Written FIRST in :app's test scope (R457) against the java.time code as it stood, shown green there, shown red on a
// verified plant (R180), and then `git mv`-ed UNEDITED to :shared commonTest once OnboardingDates.kt moved to
// kotlinx-datetime. "The same dates" means identical strings for identical inputs, and it is only known because this
// file asserts it on both implementations. kotlin.test only - no Kotest, no org.json, no java.* - so it compiles in
// commonTest and runs on the JVM and on the iOS simulator alike.
//
// Each group collects every mismatch before failing, so one run names all of them rather than the first.

private const val DAY_MS = 86_400_000L

class OnboardingDatesPinTest {
    private fun <I> mismatches(
        vectors: List<Pair<I, String>>,
        subject: (I) -> String,
    ): List<String> =
        vectors.mapNotNull { (input, expected) ->
            val actual = subject(input)
            if (actual == expected) null else "<$input> expected <$expected> but was <$actual>"
        }

    @Test
    fun isoOfReadsUtcMidnightMillisAsTheIsoDay() {
        val vectors =
            listOf(
                // 29 Feb 2024 at exactly UTC midnight, and its last millisecond
                1_709_164_800_000L to "2024-02-29",
                1_709_251_199_999L to "2024-02-29",
                1_709_251_200_000L to "2024-03-01",
                // 31 Dec and 1 Jan, and the millisecond either side of the year boundary
                1_735_603_200_000L to "2024-12-31",
                1_735_689_600_000L to "2025-01-01",
                1_735_689_599_999L to "2024-12-31",
                1_735_689_600_001L to "2025-01-01",
                // a millis value at exactly UTC midnight, one a millisecond before it, one a millisecond after
                1_782_864_000_000L to "2026-07-01",
                1_782_863_999_999L to "2026-06-30",
                1_782_864_000_001L to "2026-07-01",
                // the epoch and either side of it (the floor, not truncation, below zero)
                0L to "1970-01-01",
                -1L to "1969-12-31",
                1L to "1970-01-01",
                -DAY_MS to "1969-12-31",
                -DAY_MS - 1L to "1969-12-30",
                // Material3's default year range ends, and the extended/signed years either side of ISO's four digits
                -2_208_988_800_000L to "1900-01-01",
                4_133_894_400_000L to "2100-12-31",
                253_402_300_800_000L to "+10000-01-01",
                253_402_300_799_999L to "9999-12-31",
                -62_167_219_200_000L to "0000-01-01",
                -62_167_305_600_000L to "-0001-12-31",
            )
        assertEquals(emptyList(), mismatches(vectors) { isoOf(it) })
    }

    @Test
    fun swissDateShowsAnIsoDaySwissAndAnythingElseAsItIs() {
        val vectors =
            listOf(
                "" to "",
                "   " to "",
                "2024-02-29" to "29.02.2024",
                "2024-12-31" to "31.12.2024",
                "2025-01-01" to "01.01.2025",
                "2026-07-01" to "01.07.2026",
                "1900-01-01" to "01.01.1900",
                "9999-12-31" to "31.12.9999",
                "+10000-01-01" to "01.01.+10000",
                "0000-01-01" to "01.01.0001",
                "-0001-12-31" to "31.12.0002",
                // not trimmed here: an unparseable value is shown as it is
                " 2024-01-05 " to " 2024-01-05 ",
                "2024-02-30" to "2024-02-30",
                "2023-02-29" to "2023-02-29",
                "05.01.2024" to "05.01.2024",
                "abc" to "abc",
            )
        assertEquals(emptyList(), mismatches(vectors) { swissDate(it) })
    }

    @Test
    fun readyPeriodRunsFromTheStartToTheTaxYearsLastDay() {
        val vectors =
            listOf(
                (null to 2026) to OnboardingCopy.READY_PERIOD_ALL,
                ("" to 2026) to OnboardingCopy.READY_PERIOD_ALL,
                ("  " to 2026) to OnboardingCopy.READY_PERIOD_ALL,
                ("2026-07-01" to 2026) to "01.07.2026 – 31.12.2026",
                ("2024-02-29" to 2024) to "29.02.2024 – 31.12.2024",
                ("2025-01-01" to 2025) to "01.01.2025 – 31.12.2025",
                ("abc" to 2026) to "abc – 31.12.2026",
                ("2026-07-01" to 10000) to "01.07.2026 – 31.12.+10000",
                ("2026-07-01" to 0) to "01.07.2026 – 31.12.0001",
            )
        assertEquals(emptyList(), mismatches(vectors) { (start, year) -> readyPeriod(start, year) })
    }

    @Test
    fun isIsoDayAcceptsExactlyWhatTheControllerAcceptsAfterItsTrim() {
        val accepted =
            listOf(
                "2024-02-29",
                "2024-12-31",
                "2025-01-01",
                "2026-07-01",
                "1900-01-01",
                "2100-12-31",
                "0001-01-01",
                "0000-01-01",
                "9999-12-31",
                "+10000-01-01",
            )
        val refused =
            listOf(
                "",
                " ",
                " 2024-01-05 ",
                "2024-02-30",
                "2023-02-29",
                "2024-13-01",
                "2024-00-10",
                "2024-01-00",
                "2024-01-32",
                "2024-1-5",
                "2024-01-5",
                "2024-1-05",
                "24-01-05",
                "2024/01/05",
                "05.01.2024",
                "20240105",
                "2024-01-05T00:00",
                "2024-01-05Z",
                "2024-01",
                "2024",
                "abc",
                "+2024-01-05",
                "10000-01-01",
                "02024-01-05",
                "2024-01-05 ",
                "2024-W01-1",
                "2024-005",
            )
        val wrong =
            accepted.filterNot { isIsoDay(it) }.map { "refused <$it>, which the controller accepts" } +
                refused.filter { isIsoDay(it) }.map { "accepted <$it>, which the controller refuses" }
        assertEquals(emptyList(), wrong)
    }
}
