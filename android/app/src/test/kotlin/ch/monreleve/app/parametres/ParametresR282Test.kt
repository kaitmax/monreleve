package ch.monreleve.app.parametres

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// AN12 (R282) as amended by AN-AUTO (R315). R282 kept the MANUAL product from naming a feature it lacked. The
// automatic-detection feature now EXISTS (opt-in, labelled beta), so « détection » and « automatique » are
// permitted in the Parametres copy - the whole point of R315. What the product STILL lacks is unchanged and
// still must not be named: the daily reminder/notification (OUT OF SCOPE, parked PARKAN). This asserts the
// absence of only those, over the actual rendered strings (comments stripped first - they legitimately explain
// R282/R315 and name the detection UI).

private val COPY_FILES =
    listOf(
        File("src/main/kotlin/ch/monreleve/app/fr/ParametresCopy.kt"),
        File("src/main/kotlin/ch/monreleve/app/fr/LicencesCopy.kt"),
    )

// The features the product does NOT have, by the words they would appear as. R315 removed « détection » and
// « automatique » (the feature now exists); « rappel » and « notification » remain, because the daily reminder
// for the proposal is out of scope (parked).
private val FORBIDDEN = listOf("rappel", "notification")

private val LINE_COMMENT = Regex("""//[^\n]*""")
private val BLOCK_COMMENT = Regex("""/\*[\s\S]*?\*/""")
private val STRING_LITERAL = Regex(""""((?:[^"\\]|\\.)*)"""")

private fun renderedCopy(file: File): List<String> {
    val withoutComments = file.readText().replace(BLOCK_COMMENT, " ").replace(LINE_COMMENT, " ")
    return STRING_LITERAL.findAll(withoutComments).map { it.groupValues[1] }.toList()
}

class ParametresR282Test {
    @Test
    fun theParametresCopyNamesNothingTheProductStillLacks() {
        val copy = COPY_FILES.flatMap { renderedCopy(it) }
        assertTrue("expected Parametres/Licences copy strings to scan, found none", copy.isNotEmpty())

        for (term in FORBIDDEN) {
            val hits = copy.filter { it.lowercase().contains(term) }
            assertTrue(
                "R282/R315: the product must not name a feature it does not have - found '$term' in: $hits",
                hits.isEmpty(),
            )
        }
    }

    @Test
    fun theParametresCopyMayNowNameAutomaticDetection() {
        // R315: the feature exists, so the copy DOES name it. Asserting its presence keeps this file honest -
        // a future edit that silently dropped the auto-detection row would fail here, not pass by omission.
        val copy = COPY_FILES.flatMap { renderedCopy(it) }
        assertTrue(
            "R315: the Parametres copy must name automatic detection (the feature now exists)",
            copy.any { it.lowercase().contains("détection automatique") },
        )
    }

    @Test
    fun theScanIsNotVacuous() {
        // A planted still-forbidden word WOULD be caught: prove the matcher fires on a term it exists to catch,
        // so a green run means absence, not a broken scan (R133).
        assertTrue(
            "the forbidden-term matcher must fire on a string that contains one",
            listOf("Rappel quotidien").any { s -> FORBIDDEN.any { s.lowercase().contains(it) } },
        )
    }
}
