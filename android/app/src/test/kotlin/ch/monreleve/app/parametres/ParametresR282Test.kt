package ch.monreleve.app.parametres

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// AN12 (R282, AC3). The manual product mentions NOTHING it lacks: no mode chooser, no automatic-mode toggle,
// no detection-consent setting, no reminder settings. This asserts their absence over the Parametres and
// Licences copy - the actual rendered strings, with comments stripped first, because the comments legitimately
// explain R282 and name the detection UI the copy must not.

private val COPY_FILES =
    listOf(
        File("src/main/kotlin/ch/monreleve/app/fr/ParametresCopy.kt"),
        File("src/main/kotlin/ch/monreleve/app/fr/LicencesCopy.kt"),
    )

// The features the manual product does not have, by the words they would appear as. « détection » covers the
// mode chooser and the consent setting; « automatique » the automatic mode; « rappel » and « notification »
// the reminders; « consentement » the detection consent.
private val FORBIDDEN = listOf("détection", "automatique", "rappel", "notification", "consentement")

private val LINE_COMMENT = Regex("""//[^\n]*""")
private val BLOCK_COMMENT = Regex("""/\*[\s\S]*?\*/""")
private val STRING_LITERAL = Regex(""""((?:[^"\\]|\\.)*)"""")

private fun renderedCopy(file: File): List<String> {
    val withoutComments = file.readText().replace(BLOCK_COMMENT, " ").replace(LINE_COMMENT, " ")
    return STRING_LITERAL.findAll(withoutComments).map { it.groupValues[1] }.toList()
}

class ParametresR282Test {
    @Test
    fun theParametresCopyNamesNothingTheManualProductLacks() {
        val copy = COPY_FILES.flatMap { renderedCopy(it) }
        assertTrue("expected Parametres/Licences copy strings to scan, found none", copy.isNotEmpty())

        for (term in FORBIDDEN) {
            val hits = copy.filter { it.lowercase().contains(term) }
            assertTrue(
                "R282: the manual product must not name a feature it does not have - found '$term' in: $hits",
                hits.isEmpty(),
            )
        }
    }

    @Test
    fun theScanIsNotVacuous() {
        // A planted forbidden word in a copy string WOULD be caught: prove the matcher fires on the term it
        // exists to catch, so a green run means absence, not a broken scan (R133).
        assertTrue(
            "the forbidden-term matcher must fire on a string that contains one",
            listOf("Détection automatique").any { s -> FORBIDDEN.any { s.lowercase().contains(it) } },
        )
    }
}
