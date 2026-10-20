package ch.monreleve.app.dossier

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.SyncState

// AN11 increment 2 (R287, R206). THE ONE PREDICATE for "a day recorded on this device but not yet synced,
// in this tax year". Aujourd'hui's unsynced count and the releve's R287 line are the SAME fact - a day the
// device holds that the server has not received - so they read it from one home rather than each filtering
// its own way, which is the drift R206 exists to prevent.
//
// PENDING ONLY, deliberately. R287's sentence says "pas encore synchronisés": a FAILED row is not "not
// yet" - the server saw it and refused it (R198), so it is a different problem the pending line must not
// absorb. A day in a different tax year is not in this releve's scope either.
//
// KMP-3 (R446): MOVED to :shared commonMain, package unchanged (R368). Nineteen lines and
// two imports, both of which KMP-2b had already taken - so the only reason it was still in
// :app was that nobody had moved it. It matters more than its size: it decides the sentence
// an offline reader sees above a releve that is missing a day ("1 jour enregistre sur cet
// appareil n'est pas encore synchronise"), and an iOS releve has to say the same thing from
// the same predicate rather than filtering its own way (R206).

/** The device's PENDING rows for [taxYear] - recorded here, not yet acknowledged by the server. */
fun pendingEntriesForYear(
    entries: List<EntryEntity>,
    taxYear: Int,
): List<EntryEntity> = entries.filter { it.dayDate.startsWith("$taxYear-") && it.syncState == SyncState.PENDING }
