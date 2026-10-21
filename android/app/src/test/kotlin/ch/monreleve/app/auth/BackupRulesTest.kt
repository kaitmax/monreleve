package ch.monreleve.app.auth

import ch.monreleve.app.fences.subjectFile
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain

// AN4 increment 2 (AC3). The token store must survive neither a cloud backup nor
// a device-to-device transfer - a restored session on a new device would be a
// credential the user never re-authenticated for. minSdk is 26, so BOTH rules
// files are needed: fullBackupContent for 26-30, dataExtractionRules for 31+. One
// without the other leaves a third of the fleet's backups carrying the token, so
// this asserts the exclusion in BOTH - and, for dataExtractionRules, in BOTH its
// cloud-backup and device-transfer sections (the transfer channel is the one
// fullBackupContent cannot express).
// AN-FENCE-ROOTS (R461). THIS FENCE READS :app ONLY, AND THAT IS CORRECT: its subject is two Android
// resource XML files (res/xml), and :shared commonMain has no res/ for them to move to. R460's
// subjectFile() below is what makes leaving it safe - a renamed or moved rules file fails NAMING the
// file and the absolute path it looked at, instead of throwing a bare FileNotFoundException.
private const val FENCE = "backup-rules fence"

private const val TOKEN_PREFS = "monreleve.auth.xml"
private const val PENDING_PREFS = "monreleve.pending.xml"

// AN-FIX F4 / R303: the account scope is excluded on the same terms as the token.
private const val ACCOUNT_PREFS = "monreleve.account.xml"

class BackupRulesTest : FunSpec({
    test("fullBackupContent (API 26-30) excludes the token, pending-sign-in and account SharedPreferences") {
        val text = subjectFile(FENCE, "src/main/res/xml/backup_rules.xml").readText()
        text shouldContain "domain=\"sharedpref\""
        text shouldContain TOKEN_PREFS
        text shouldContain PENDING_PREFS
        text shouldContain ACCOUNT_PREFS
    }

    test("dataExtractionRules (API 31+) excludes all three prefs from cloud backup AND device transfer") {
        val text = subjectFile(FENCE, "src/main/res/xml/data_extraction_rules.xml").readText()
        val cloud = text.substringAfter("<cloud-backup>").substringBefore("</cloud-backup>")
        val transfer = text.substringAfter("<device-transfer>").substringBefore("</device-transfer>")
        cloud shouldContain TOKEN_PREFS
        cloud shouldContain PENDING_PREFS
        cloud shouldContain ACCOUNT_PREFS
        transfer shouldContain TOKEN_PREFS
        transfer shouldContain PENDING_PREFS
        transfer shouldContain ACCOUNT_PREFS
    }
})
