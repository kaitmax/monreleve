package ch.monreleve.app.detection

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// AN-ALERT (R340): A PROJECTION/ALERT IS NEVER A RECORD. The alert's compute, decision, store and glue never
// write to the entries, the mutation queue, the server, the releve, the PDF or the annex. Proven two ways:
//   - the DEVICE store proof (entry/pending/tally unchanged across every WHEN case; only the rhythm, a planning
//     preference, is ever written) is recorded in REPORT-AN-ALERT's WALKTHROUGH;
//   - HERE, a SOURCE scan of the alert's files asserts none of them contains an entry-write (`.record(`,
//     `.upsert(`, `RecordCommand`), so a future edit that tried to record a day from the alert path turns this
//     red. The compute itself runs the SHARED engine, which ForecastR340Test proves writes nothing
//     (forecastResults); decideThresholdAlert and composeDaily are pure values-in/values-out
//     (ThresholdAlertDecisionTest).
//
// Fence 7 already forbids EntryRepository/RecordCommand in detection/; this adds the DAO-level upsert/record
// patterns and extends the scan to the alert's forecast/ and settings/ files. Comments are stripped first,
// because the files' own prose says "records nothing" (which would otherwise self-trigger).

// AN-FENCE-ROOTS (R461). THIS FENCE READS :app ONLY, AND THAT IS CORRECT: all four named files were
// verified still in app/src/main/kotlin by this task's R458 census, and the SHARED half of the alert's
// compute has its own guard (ForecastR340Test), named in the header above. R460 was already satisfied
// here before this task - theAlertFilesAreReadSoTheScanIsNotVacuous asserts each file exists and is
// non-trivial, so a move fails loudly naming the file.
//
// IOS-2d R813/R819: and a move DID fail it loudly - ThresholdForecast.kt moved to :shared commonMain, and
// ThresholdCrossing split out of ThresholdAlert.kt into :shared's settings/ThresholdCrossing.kt. The paths follow
// the files (the scan is unchanged); the split-off half is listed so the moved code stays under the scan.
//
// IOS-2e R828: and again - ThresholdAlert.kt (the store's interface, its in-memory implementation, AlertThreshold)
// moved to :shared commonMain, and its SharedPreferences half split out into :app's SharedPrefsThresholdAlertStore.kt.
// Both halves are listed; the scan is unchanged.
//
// IOS-MOVE-TWINS R1242: and again - ThresholdAlertDecision.kt moved to :shared commonMain (PARK-IF4, the iosMain copy
// deleted). The path follows the file; the scan is unchanged.
private val ALERT_FILES =
    listOf(
        File("../shared/src/commonMain/kotlin/ch/monreleve/app/forecast/ThresholdForecast.kt"),
        File("../shared/src/commonMain/kotlin/ch/monreleve/app/settings/ThresholdCrossing.kt"),
        File("../shared/src/commonMain/kotlin/ch/monreleve/app/detection/ThresholdAlertDecision.kt"),
        File("../shared/src/commonMain/kotlin/ch/monreleve/app/settings/ThresholdAlert.kt"),
        File("src/main/kotlin/ch/monreleve/app/settings/SharedPrefsThresholdAlertStore.kt"),
        File("src/main/kotlin/ch/monreleve/app/detection/EveningNotifier.kt"),
    )

private fun stripComments(text: String): String =
    text
        .replace(Regex("""/\*[\s\S]*?\*/"""), "")
        .replace(Regex("""//.*"""), "")

private val WRITE_PATTERNS =
    listOf(
        Regex("""\.record\("""),
        Regex("""\.upsert\("""),
        Regex("""\bRecordCommand\b"""),
    )

class ThresholdAlertR340Test {
    @Test
    fun theAlertFilesAreReadSoTheScanIsNotVacuous() {
        for (f in ALERT_FILES) {
            assertTrue("alert file not found (renamed/moved?): ${f.path}", f.exists() && f.readText().length > 100)
        }
    }

    @Test
    fun noAlertFileWritesAnEntryOrRecord() {
        val offenders = mutableListOf<String>()
        for (f in ALERT_FILES) {
            val text = stripComments(f.readText())
            for (p in WRITE_PATTERNS) {
                if (p.containsMatchIn(text)) {
                    offenders += "${f.name}: entry-write ${p.pattern} - the alert must never record (R340)"
                }
            }
        }
        assertTrue("R340 alert-never-records violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }
}
