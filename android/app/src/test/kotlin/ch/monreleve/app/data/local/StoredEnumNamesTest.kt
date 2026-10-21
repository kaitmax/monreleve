package ch.monreleve.app.data.local

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * KMP-4 (R465). EVERY NAME THE DATABASE STORES, WRITTEN OUT.
 *
 * Room persists each of these enums as its constant NAME, as TEXT, and the entry vocabulary goes on the wire
 * under the same name - so a constant renamed here is a stored value no installed phone can read back, and a
 * server disagreement, at once. These lists are therefore literals ON PURPOSE (R171: a literal is permitted
 * where the value IS the assertion): they are the strings the entry and weekly_rhythm tables hold on every
 * installed device. Every value the S9's database held before this task changed anything is among them.
 *
 * R465's BEFORE check is this file plus EntryVocabularyBindingTest: that one asserts KMP-0's second set
 * (dossier.EntryKind / dossier.Portion) carries exactly these names in this order; this one says what the
 * names ARE. When the two sets collapse into one, this file is the one that stays, unedited.
 */
class StoredEnumNamesTest {
    @Test
    fun entryKind() {
        assertEquals(listOf("CH", "HOME", "MISSION_FR", "MISSION_THIRD", "ABSENT"), EntryKind.entries.map { it.name })
    }

    @Test
    fun portion() {
        assertEquals(listOf("FULL", "AM", "PM"), Portion.entries.map { it.name })
    }

    @Test
    fun provenance() {
        assertEquals(
            listOf("MANUAL", "DETECTED_CONFIRMED", "DETECTED_CORRECTED"),
            Provenance.entries.map { it.name },
        )
    }

    @Test
    fun absenceReason() {
        assertEquals(listOf("CONGE", "MALADIE", "FERIE", "AUTRE"), AbsenceReason.entries.map { it.name })
    }

    @Test
    fun syncState() {
        assertEquals(listOf("PENDING", "SYNCED", "FAILED"), SyncState.entries.map { it.name })
    }

    @Test
    fun rhythmKind() {
        assertEquals(listOf("SUISSE", "DOMICILE"), RhythmKind.entries.map { it.name })
    }
}
