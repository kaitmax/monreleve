package ch.monreleve.app.fr.format

// AN3 increment 1. Kotlin port of web/tests/unit/ui-core/format-number.test.ts.
//
// THREE TRAPS, each measured on this build rather than assumed - matching
// the TS reference's own three, ported to what Kotlin gives instead of ICU
// parts:
//
// 1. THE SPEC'S OWN LITERALS ARE ASCII. Extracting the codepoints of
//    SPEC 6.4's "34,6 %" and "1 234,5" gives U+0020 in both - the U+00A0
//    and U+202F are prose annotations, not the characters in the file. So
//    a pasted expected string asserts the WRONG codepoint. Every expected
//    string here is built from NBSP/nnbsp built via Int.toChar(), never
//    typed as a literal or a \u escape - the latter was measured, while
//    writing Numbers.kt, to round-trip back into the literal character in
//    this environment before it reached disk (see that file's header).
//
// 2. NO NORMALISER RUNS HERE THAT COULD BE A NO-OP. Unlike the TS side,
//    this file asserts the FORMATTER's own output directly rather than a
//    separate normaliseNumber seam, because DecimalFormatSymbols is set
//    once, explicitly, inside digits() - there is no second code path that
//    could search for a separator it already expects.
//
// 3. THE JVM DEFAULT LOCALE IS THE USER'S. LocaleTrapsTest.kt is the file
//    that measures this directly, by actually switching Locale.setDefault
//    and re-running unpinned code; this file's job is only the correctness
//    of the pinned formatter's OUTPUT.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.util.Locale

private val NBSP: Char = 0x00A0.toChar()
private val NNBSP: Char = 0x202F.toChar()
private const val COMMA = ','

private fun codepoints(text: String): List<String> = text.map { String.format(Locale.ROOT, "U+%04X", it.code) }

class NumbersTest : FunSpec({
    context("formatPercent") {
        test("renders SPEC 6.4 example exactly") {
            formatPercent(34.6, 1) shouldBe "34${COMMA}6$NBSP%"
        }

        test("separates figure from percent sign with U+00A0, not a plain space") {
            val rendered = formatPercent(34.6, 1)
            val spaceIndex = rendered.length - 2

            rendered[spaceIndex].code shouldBe 0x00A0
            (rendered[spaceIndex].code == 0x0020) shouldBe false
            (rendered[spaceIndex].code == 0x202F) shouldBe false
            codepoints(rendered) shouldBe listOf("U+0033", "U+0034", "U+002C", "U+0036", "U+00A0", "U+0025")
        }

        test("uses a comma for the decimal separator") {
            formatPercent(34.6, 1)[2].code shouldBe 0x002C
        }

        test("keeps a trailing zero at the requested precision") {
            formatPercent(45.0, 1) shouldBe "45${COMMA}0$NBSP%"
            formatPercent(40.0, 1) shouldBe "40${COMMA}0$NBSP%"
        }

        test("takes a required precision, and renders exactly what it is asked for") {
            formatPercent(39.16, 2) shouldBe "39${COMMA}16$NBSP%"
            formatPercent(39.16, 1) shouldBe "39${COMMA}1$NBSP%"
        }

        test("truncates rather than rounding up, so a rate cannot cross a ceiling") {
            formatPercent(39.95, 1) shouldBe "39${COMMA}9$NBSP%"
            formatPercent(39.99, 1) shouldBe "39${COMMA}9$NBSP%"
            formatPercent(49.89, 1) shouldBe "49${COMMA}8$NBSP%"
        }

        test("never multiplies by 100") {
            formatPercent(100.0, 1) shouldBe "100${COMMA}0$NBSP%"
        }

        test("rejects a non-finite value") {
            runCatching { formatPercent(Double.NaN, 1) }.isFailure shouldBe true
            runCatching { formatPercent(Double.POSITIVE_INFINITY, 1) }.isFailure shouldBe true
        }
    }

    context("formatDays") {
        test("renders SPEC 6.4 example exactly") {
            formatDays(1234.5) shouldBe "1$NNBSP" + "234${COMMA}5"
        }

        test("groups thousands with U+202F, not U+00A0 and not a plain space") {
            val rendered = formatDays(1234.5)

            rendered[1].code shouldBe 0x202F
            (rendered[1].code == 0x00A0) shouldBe false
            (rendered[1].code == 0x0020) shouldBe false
            codepoints(rendered) shouldBe
                listOf("U+0031", "U+202F", "U+0032", "U+0033", "U+0034", "U+002C", "U+0035")
        }

        test("groups at a thousand exactly") {
            formatDays(1000.0) shouldBe "1$NNBSP" + "000"
            formatDays(1000.0).length shouldBe 5
        }

        test("omits the decimal for a whole number of days") {
            formatDays(240.0) shouldBe "240"
            formatDays(0.0) shouldBe "0"
        }

        test("keeps the half day") {
            formatDays(96.5) shouldBe "96${COMMA}5"
            formatDays(0.5) shouldBe "0${COMMA}5"
        }

        test("rejects a non-finite value") {
            runCatching { formatDays(Double.NaN) }.isFailure shouldBe true
        }
    }

    context("formatSignedDays") {
        test("returns the absolute value and the sign separately") {
            formatSignedDays(12.5) shouldBe SignedDays("12${COMMA}5", negative = false)
            formatSignedDays(-12.5) shouldBe SignedDays("12${COMMA}5", negative = true)
        }

        test("carries no sign character in the text") {
            formatSignedDays(-1234.5).text shouldBe "1$NNBSP" + "234${COMMA}5"
            (formatSignedDays(-1.0).text.contains('-')) shouldBe false
            (formatSignedDays(-1.0).text.contains(0x2212.toChar())) shouldBe false
        }

        test("treats zero as not negative") {
            formatSignedDays(0.0) shouldBe SignedDays("0", negative = false)
            formatSignedDays(-0.0) shouldBe SignedDays("0", negative = false)
        }
    }

    context("formatPoints") {
        test("renders two decimals of percentage points") {
            formatPoints(2.09) shouldBe "2${COMMA}09"
        }

        test("rounds HALF_UP so an exact gap is recovered, not truncated to a point less") {
            // 41,25 - 39,16 = 2,09, but the double is ~2,0899999; it must read 2,09, never 2,08.
            formatPoints(41.25 - 39.16) shouldBe "2${COMMA}09"
        }

        test("keeps both decimals, including trailing zeros") {
            formatPoints(2.0) shouldBe "2${COMMA}00"
            formatPoints(0.0) shouldBe "0${COMMA}00"
        }

        test("rejects a non-finite value") {
            runCatching { formatPoints(Double.NaN) }.isFailure shouldBe true
        }
    }

    context("the test file itself") {
        test("contains no literal NBSP or NNBSP in its own source") {
            // AN-FENCE-ROOTS (R460): assert the subject was found. This test's subject is its OWN source
            // file, by a hardcoded path - rename the file and a bare FileNotFoundException is the only
            // signal. subjectFile() names the file and where it looked.
            val source =
                ch.monreleve.app.fences
                    .subjectFile(
                        "NBSP self-check",
                        "src/test/kotlin/ch/monreleve/app/fr/format/NumbersTest.kt",
                    ).readText()

            source.contains(0x00A0.toChar()) shouldBe false
            source.contains(0x202F.toChar()) shouldBe false
        }
    }
})
