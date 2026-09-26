package ch.monreleve.app.fr.format

// AN3 increment 1. Kotlin port of web/tests/unit/ui-core/format-date.test.ts.
//
// RULING R28 carried, and Dates.kt's own header records the one place the
// two platforms genuinely differ: java.time.LocalDate validates a real
// calendar day directly (DateTimeParseException on 30 February, on 29
// February in a non-leap year, on a month outside 1-12), where JavaScript's
// Date rolls an impossible day over into the next month. This file proves
// that empirically against the SAME rejection list the TS suite carries,
// rather than trusting the platform's documentation.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

private val NBSP: Char = 0x00A0.toChar()
private val A_GRAVE: Char = 0x00E0.toChar()

private fun codepoints(text: String): List<String> {
    return text.map { String.format(java.util.Locale.ROOT, "U+%04X", it.code) }
}

/** Midwinter, so a westward zone shift would land on the previous day. */
private const val DECEMBER_DAY = "2026-12-18"

/** SPEC's own datetime example: 18.06.2027 a 18:03 Paris = 16:03 UTC. */
private const val JUNE_EVENING = "2027-06-18T16:03:00Z"

class DatesTest : FunSpec({
    context("formatDate takes an ISO day string (R28)") {
        test("renders Swiss dots") {
            formatDate(DECEMBER_DAY) shouldBe "18.12.2026"
        }

        test("separates with U+002E and never U+002F") {
            codepoints(formatDate(DECEMBER_DAY)) shouldBe
                listOf(
                    "U+0031", "U+0038", "U+002E", "U+0031", "U+0032", "U+002E", "U+0032", "U+0030", "U+0032", "U+0036",
                )
        }

        test("keeps the two-digit day and month it was given") {
            formatDate("2027-01-05") shouldBe "05.01.2027"
        }

        test("renders the year in four digits") {
            formatDate(DECEMBER_DAY).contains("2026") shouldBe true
            formatDate(DECEMBER_DAY).length shouldBe 10
        }
    }

    context("formatDate refuses anything that is not a calendar day") {
        listOf(
            "18.12.2026",
            "2026-12-18T00:00:00Z",
            "2026-12-8",
            "26-12-18",
            "2026/12/18",
            "",
            "nonsense",
        ).forEach { bad ->
            test("rejects ${bad.ifEmpty { "(empty string)" }}") {
                runCatching { formatDate(bad) }.isFailure shouldBe true
            }
        }

        test("rejects a well-formed but impossible day") {
            // THE ONE THAT NEEDS MORE THAN A REGEX. Unlike JS's Date, which
            // rolls these over into the next month, LocalDate.parse throws
            // directly - measured here, not assumed from the platform's own
            // documentation.
            runCatching { formatDate("2026-02-30") }.isFailure shouldBe true
            runCatching { formatDate("2026-02-29") }.isFailure shouldBe true
            runCatching { formatDate("2026-13-01") }.isFailure shouldBe true
            runCatching { formatDate("2026-00-10") }.isFailure shouldBe true
            runCatching { formatDate("2026-12-32") }.isFailure shouldBe true
            runCatching { formatDate("2026-12-00") }.isFailure shouldBe true
        }

        test("accepts a real leap day") {
            // 2028 IS a leap year, and rejecting a real 29 February would be
            // just as wrong as accepting a fake one.
            formatDate("2028-02-29") shouldBe "29.02.2028"
        }
    }

    context("formatDateTime renders an instant in a pinned zone") {
        test("renders the SPEC example") {
            formatDateTime(JUNE_EVENING) shouldBe "18.06.2027$NBSP$A_GRAVE${NBSP}18:03"
        }

        test("uses a precomposed a-grave, not a combining sequence") {
            val rendered = formatDateTime(JUNE_EVENING)
            val index = rendered.indexOf(A_GRAVE)

            (index > 0) shouldBe true
            rendered[index].code shouldBe 0x00E0
            rendered.contains("a" + 0x0300.toChar()) shouldBe false
        }

        test("binds the timestamp into one unbreakable token with U+00A0 (R29)") {
            val rendered = formatDateTime(JUNE_EVENING)
            val index = rendered.indexOf(A_GRAVE)

            rendered[index - 1].code shouldBe 0x00A0
            rendered[index + 1].code shouldBe 0x00A0
            (rendered[index - 1].code == 0x0020) shouldBe false
            (rendered[index + 1].code == 0x0020) shouldBe false
        }

        test("separates the time with a colon") {
            val rendered = formatDateTime(JUNE_EVENING)

            rendered.contains(':') shouldBe true
            rendered[rendered.length - 3].code shouldBe 0x003A
        }

        test("renders 24-hour time with no meridiem") {
            formatDateTime(JUNE_EVENING).contains("18:03") shouldBe true
            formatDateTime("2027-06-18T02:07:00Z") shouldBe "18.06.2027$NBSP$A_GRAVE${NBSP}04:07"
            Regex("(?i)PM|AM").containsMatchIn(formatDateTime(JUNE_EVENING)) shouldBe false
        }

        test("pins Europe/Paris - the wall clock of the audience") {
            DATE_TIME_ZONE shouldBe "Europe/Paris"
        }

        test("honours an explicit zone, which is how we know the zone is real") {
            formatDateTime(JUNE_EVENING, "UTC") shouldBe "18.06.2027$NBSP$A_GRAVE${NBSP}16:03"
            formatDateTime(JUNE_EVENING, "Asia/Kolkata") shouldBe "18.06.2027$NBSP$A_GRAVE${NBSP}21:33"
        }

        test("rejects a timestamp it cannot read") {
            runCatching { formatDateTime("nonsense") }.isFailure shouldBe true
            runCatching { formatDateTime("") }.isFailure shouldBe true
        }

        test("rejects a bare calendar day - an instant needs a time component") {
            runCatching { formatDateTime(DECEMBER_DAY) }.isFailure shouldBe true
        }
    }

    context("the output does not depend on the ambient time zone") {
        // Nothing in this repo sets the JVM's default time zone, so the host
        // zone is whatever the machine reports. Both formatters take their
        // zone as an explicit parameter or a pinned constant - never
        // ZoneId.systemDefault() - so there is no mechanism by which the
        // ambient zone could reach the output. Proven by actually reading
        // the ambient zone and asserting it plays no role, rather than
        // trusting the source has no systemDefault() call by inspection
        // alone.
        test("renders identically regardless of the JVM's own default zone") {
            val ambient = java.util.TimeZone.getDefault()

            try {
                for (zoneId in listOf("UTC", "America/New_York", "Pacific/Kiritimati", "Asia/Kolkata")) {
                    java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(zoneId))

                    formatDate(DECEMBER_DAY) shouldBe "18.12.2026"
                    formatDateTime(JUNE_EVENING) shouldBe "18.06.2027$NBSP$A_GRAVE${NBSP}18:03"
                }
            } finally {
                java.util.TimeZone.setDefault(ambient)
            }
        }
    }
})
