package ch.monreleve.app.fr.format

// AN3 increment 1. The three Kotlin locale traps the relay named, each
// MEASURED by actually triggering it - not merely asserted as avoided.
//
// Every trap below is demonstrated by switching the JVM's own default
// locale and re-running an UNPINNED equivalent of what Numbers.kt/Dates.kt
// do, so the failure is real rather than argued. The pinned formatters
// under test (formatPercent, formatDays, formatDateTime) are then run
// under the SAME switched locale to prove they are immune - the two halves
// of one proof, matching this project's own standing shape: a plant that
// fails, and the real code that does not.

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

private val NBSP: Char = 0x00A0.toChar()
private val NNBSP: Char = 0x202F.toChar()

/** Runs a block under a switched default locale, always restoring it afterward. */
private fun <T> underDefaultLocale(
    locale: Locale,
    block: () -> T,
): T {
    val ambient = Locale.getDefault()

    return try {
        Locale.setDefault(locale)
        block()
    } finally {
        Locale.setDefault(ambient)
    }
}

class LocaleTrapsTest : FunSpec({
    context("trap 1 - String.format is locale-sensitive") {
        test("an unpinned %.1f emits a period under a locale that groups with one, proving the trap is real") {
            val brokenUnderGerman =
                underDefaultLocale(Locale.GERMANY) {
                    // %f with NO Locale argument uses Locale.getDefault() -
                    // exactly the call shape this file exists to warn
                    // against. de-DE renders the decimal separator as a
                    // comma too (matching French here), so the digit-GROUP
                    // separator is the one that actually diverges: German
                    // groups thousands with a period, which is the trap
                    // that would corrupt a day count above 999.
                    @Suppress("ImplicitDefaultLocale")
                    String.format("%,.1f", 1234.5)
                }

            // German groups with '.', never NNBSP - the unpinned call
            // really does diverge from SPEC 6.4's required separator.
            brokenUnderGerman.contains('.') shouldBe true
            brokenUnderGerman.contains(NNBSP) shouldBe false
        }

        test("formatDays stays correct under the same switched locale, because it never calls unpinned String.format") {
            underDefaultLocale(Locale.GERMANY) {
                formatDays(1234.5) shouldBe "1${NNBSP}234,5"
            }
        }
    }

    context("trap 2 - DecimalFormat carries a DecimalFormatSymbols that must be pinned, not defaulted") {
        test("an unpinned DecimalFormat under Turkish emits the wrong separators, proving the trap is real") {
            val brokenUnderTurkish =
                underDefaultLocale(Locale.forLanguageTag("tr-TR")) {
                    // The exact mistake this file's own digits() avoids:
                    // constructing DecimalFormat with no Locale argument, so
                    // DecimalFormatSymbols resolves from Locale.getDefault().
                    DecimalFormat("#,##0.0").format(1234.5)
                }

            // tr-TR groups with '.' and decimals with ',' - the grouping
            // character is swapped relative to SPEC 6.4's NNBSP requirement,
            // and it is a PERIOD, not even the same character family.
            brokenUnderTurkish.contains('.') shouldBe true
            brokenUnderTurkish.contains(NNBSP) shouldBe false
        }

        test("formatPercent stays correct under the same locale, since its symbols are pinned to Locale.ROOT") {
            underDefaultLocale(Locale.forLanguageTag("tr-TR")) {
                formatPercent(34.6, 1) shouldBe "34,6$NBSP%"
            }
        }

        test("an unpinned DecimalFormatSymbols(Locale.getDefault()) itself carries the wrong characters") {
            // One layer more direct: the symbols object itself, not yet
            // applied to a format call, already carries the wrong
            // characters under a switched default.
            underDefaultLocale(Locale.forLanguageTag("tr-TR")) {
                val symbols = DecimalFormatSymbols(Locale.getDefault())

                symbols.decimalSeparator shouldBe ','
                symbols.groupingSeparator shouldBe '.'
            }
        }
    }

    context("trap 3 - the JVM's default locale on a device is the user's") {
        test("formatPercent, formatDays and formatDateTime are immune across a spread of real device locales") {
            // Not just the two locales chosen for their sharpest divergence
            // above - a spread, because "immune under one hostile locale"
            // is a weaker claim than "immune regardless of which locale the
            // user's device reports".
            for (tag in listOf("de-DE", "tr-TR", "ar-SA", "ja-JP", "en-US", "fr-CA")) {
                underDefaultLocale(Locale.forLanguageTag(tag)) {
                    withClue("under default locale $tag") {
                        formatPercent(34.6, 1) shouldBe "34,6$NBSP%"
                        formatDays(1234.5) shouldBe "1${NNBSP}234,5"
                        formatDateTime("2027-06-18T16:03:00Z") shouldBe
                            "18.06.2027$NBSP${0x00E0.toChar()}${NBSP}18:03"
                    }
                }
            }
        }

        test("restores the ambient default locale afterward, so this file leaves no trace on later tests") {
            val before = Locale.getDefault()

            underDefaultLocale(Locale.forLanguageTag("ar-SA")) {
                Locale.getDefault().toLanguageTag() shouldBe "ar-SA"
            }

            Locale.getDefault() shouldBe before
        }
    }
})
