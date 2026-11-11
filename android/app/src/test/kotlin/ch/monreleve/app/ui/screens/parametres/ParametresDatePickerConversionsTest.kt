package ch.monreleve.app.ui.screens.parametres

import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-2e R830. THE TWO CONVERSIONS ANDROID'S « Début d'activité » DATE DIALOG MAKES, PINNED BEFORE THE DIALOG BECAME
// A SLOT. Material3's DatePicker speaks epoch milliseconds; the stored value is an ISO day (R28). isoToMillis turns the
// current value into the picker's initialSelectedDateMillis, millisToIso turns the picked millis back into a day. The
// pin was written and run green against the two functions where they sat (ParametresDateField.kt, private until
// this pin made them internal - a visibility edit only), and stays with them in :app, where Android's dialog stays
// (R830).
//
// THE CONVENTION IS SHOWN, NOT ASSUMED: Material3 hands over (and expects) the UTC MIDNIGHT that starts the day, so
// every ISO day maps to a whole multiple of 86 400 000 ms, and any millisecond of that UTC day maps back to it - even
// one that is already the next day in Paris (23:30 UTC on 31 Dec is 00:30 on 1 Jan in Paris, and is still 31 Dec
// here). Each millisecond literal below is the day count since 1970-01-01 times 86 400 000, worked out by hand.

private const val DAY_MS = 86_400_000L

class ParametresDatePickerConversionsTest {
    @Test
    fun anIsoDayOpensThePickerAtThatDaysUtcMidnight() {
        val vectors =
            listOf(
                // winter: 20 468 days
                "2026-01-15" to 1_768_435_200_000L,
                // summer (CEST in Paris; the millis stay UTC): 20 649 days
                "2026-07-15" to 1_784_073_600_000L,
                // 1 Jan: 20 454 days
                "2026-01-01" to 1_767_225_600_000L,
                // 31 Dec: 20 818 days
                "2026-12-31" to 1_798_675_200_000L,
                // leap day: 19 782 days
                "2024-02-29" to 1_709_164_800_000L,
                "1970-01-01" to 0L,
            )
        val mismatches = mutableListOf<String>()
        for ((iso, millis) in vectors) {
            val seen = isoToMillis(iso)
            if (seen != millis) mismatches += "isoToMillis($iso) = $seen, not $millis"
            if (millis % DAY_MS != 0L) mismatches += "$iso: $millis is not a UTC midnight"
        }
        // No initial selection - the picker opens on today - for an empty, blank or unreadable value.
        for (none in listOf("", "   ", "abc", "2026-02-29", "2026-13-01", " 2026-01-15", "2026-1-5")) {
            val seen = isoToMillis(none)
            if (seen != null) mismatches += "isoToMillis([$none]) = $seen, not null"
        }
        assertTrue(mismatches.isEmpty(), mismatches.joinToString("\n"))
    }

    @Test
    fun aPickedMillisecondIsReadAsItsUtcDay() {
        val vectors =
            listOf(
                1_768_435_200_000L to "2026-01-15",
                1_784_073_600_000L to "2026-07-15",
                // 22:00 UTC: already 16 Jul in Paris
                1_784_073_600_000L + 22 * 3_600_000L to "2026-07-15",
                1_767_225_600_000L to "2026-01-01",
                // the last millisecond of 2025, UTC
                1_767_225_600_000L - 1 to "2025-12-31",
                1_798_675_200_000L to "2026-12-31",
                // 00:30 on 1 Jan in Paris
                1_798_675_200_000L + 23 * 3_600_000L + 30 * 60_000L to "2026-12-31",
                1_709_164_800_000L to "2024-02-29",
                1_709_164_800_000L - 1 to "2024-02-28",
                1_709_164_800_000L + DAY_MS - 1 to "2024-02-29",
                0L to "1970-01-01",
                -1L to "1969-12-31",
            )
        val mismatches = mutableListOf<String>()
        for ((millis, iso) in vectors) {
            val seen = millisToIso(millis)
            if (seen != iso) mismatches += "millisToIso($millis) = $seen, not $iso"
        }
        for (iso in listOf("2026-01-15", "2026-07-15", "2026-01-01", "2026-12-31", "2024-02-29")) {
            val back = isoToMillis(iso)?.let(::millisToIso)
            if (back != iso) mismatches += "round trip of $iso gave $back"
        }
        assertTrue(mismatches.isEmpty(), mismatches.joinToString("\n"))
    }
}
