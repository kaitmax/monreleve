package ch.monreleve.app.auth

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain
import java.io.File

// AN4 increment 2 (AC3). The token store must survive neither a cloud backup nor
// a device-to-device transfer - a restored session on a new device would be a
// credential the user never re-authenticated for. minSdk is 26, so BOTH rules
// files are needed: fullBackupContent for 26-30, dataExtractionRules for 31+. One
// without the other leaves a third of the fleet's backups carrying the token, so
// this asserts the exclusion in BOTH - and, for dataExtractionRules, in BOTH its
// cloud-backup and device-transfer sections (the transfer channel is the one
// fullBackupContent cannot express).
private const val TOKEN_PREFS = "monreleve.auth.xml"

class BackupRulesTest : FunSpec({
    test("fullBackupContent (API 26-30) excludes the token SharedPreferences") {
        val text = File("src/main/res/xml/backup_rules.xml").readText()
        text shouldContain "domain=\"sharedpref\""
        text shouldContain TOKEN_PREFS
    }

    test("dataExtractionRules (API 31+) excludes the token prefs from cloud backup AND device transfer") {
        val text = File("src/main/res/xml/data_extraction_rules.xml").readText()
        val cloud = text.substringAfter("<cloud-backup>").substringBefore("</cloud-backup>")
        val transfer = text.substringAfter("<device-transfer>").substringBefore("</device-transfer>")
        cloud shouldContain TOKEN_PREFS
        transfer shouldContain TOKEN_PREFS
    }
})
