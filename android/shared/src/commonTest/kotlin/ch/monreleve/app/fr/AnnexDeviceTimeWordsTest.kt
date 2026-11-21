package ch.monreleve.app.fr

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// AN-ANNEX-TRUTH (R1261, iOS Ruling 6 / Android Ruling 22): the in-app releve's annex is the PDF's, ported (SPEC
// 12, ReleveCopy's header). The app stamps clientClaimedAt on EVERY write (R275: EntryRepository.record calls
// deviceClaimNow on each tap), online or not, so a row's device time says nothing about connectivity - and a
// label or note saying the day was entered OFFLINE claims, for every day recorded online, more than the record
// supports. The web half is web/tests/db/annex-device-time.test.ts.
//
// PRESENCE FIRST (R169): the row's line does carry the device time, so the absence of offline wording cannot pass
// on a line that dropped the stamp.

/** Any wording that says a day was entered without a connection; judged on the words, not on one string. */
private val OFFLINE_CLAIM =
    Regex("hors[\\s  -]+(ligne|connexion)|offline|sans\\s+(r[eé]seau|connexion)", RegexOption.IGNORE_CASE)

class AnnexDeviceTimeWordsTest {
    @Test
    fun aRowCarryingTheDeviceTimeDoesNotSayTheDayWasEnteredOffline() {
        val deviceTime = "21/11/2026 14:31"
        val meta = ReleveCopy.annexEntryMeta("FULL", "MANUAL", "21/11/2026 14:32", null, deviceTime)

        assertTrue(meta.endsWith(deviceTime), "the row's line carries the device time: $meta")
        assertFalse(OFFLINE_CLAIM.containsMatchIn(meta), "a row recorded online is labelled as entered offline: $meta")
    }

    @Test
    fun theNoteUnderTheAnnexNamesTheServerAndMakesNoOfflineClaim() {
        val note = ReleveCopy.ANNEX_DEVICE_TIME_NOTE

        assertTrue(note.contains("serveur"), "the note says which time the server attributes: $note")
        assertFalse(OFFLINE_CLAIM.containsMatchIn(note), "the note says the device time means offline: $note")
    }
}
