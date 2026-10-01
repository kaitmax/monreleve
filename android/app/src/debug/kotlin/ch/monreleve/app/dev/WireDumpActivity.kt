package ch.monreleve.app.dev

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.sync.entriesRequestBody

// AN14a increment 4 - R307, the RUNTIME half (the owed emulator drive).
//
// The checkMinifiedWireContract gate task proves every /v1 field key and enum value SURVIVES in the
// minified release dex - but presence is not use (R133). This activity closes that gap: it runs the REAL,
// MINIFIED EntriesWire.entriesRequestBody over a fixture that exercises EVERY enum value, and logs the JSON
// the minified build would actually send. A host script (android/scripts/an14a-wire.mjs) installs the
// MINIFIED audit variant, launches this by name, reads the JSON back from logcat, and asserts every key and
// enum value the doc's field list names appears in what the minified serialiser produced - the faithful
// artifact-side R307 check. The plant is faithful too: rename a key in EntriesWire.kt, drive, and the
// emitted JSON carries the wrong key, which the host diff catches.
//
// It lives in src/debug (never src/main), so checkReleaseNoDevComponent proves it never ships, and the
// src/main dev/ no-string-literal fence does not reach it (the fixture dates and the log tag are literals).
// Reached only by: adb shell am start -n ch.monreleve.app/ch.monreleve.app.dev.WireDumpActivity

private const val WIRE_DUMP_TAG = "AN14A_WIRE_DUMP"

class WireDumpActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        fun row(
            mutationId: String,
            kind: EntryKind,
            portion: Portion = Portion.FULL,
            provenance: Provenance = Provenance.MANUAL,
            absenceReason: AbsenceReason? = null,
            detectedKind: EntryKind? = null,
        ): EntryEntity =
            EntryEntity(
                clientMutationId = mutationId,
                dayDate = "2026-04-07",
                portion = portion,
                kind = kind,
                absenceReason = absenceReason,
                note = "aide-memoire",
                provenance = provenance,
                detectedKind = detectedKind,
                detectedAt = "2026-04-07T17:02:11.000Z",
                clientClaimedAt = "2026-04-07T18:44:02.000Z",
                serverId = null,
                firstRecordedAt = null,
                lastModifiedAt = null,
                syncState = SyncState.PENDING,
            )

        val rows = mutableListOf<EntryEntity>()
        // Every portion (one plain CH row each).
        Portion.entries.forEachIndexed { index, portion ->
            rows += row("portion-$index", EntryKind.CH, portion = portion)
        }
        // Every non-absent kind.
        listOf(EntryKind.CH, EntryKind.HOME, EntryKind.MISSION_FR, EntryKind.MISSION_THIRD)
            .forEachIndexed { index, kind -> rows += row("kind-$index", kind) }
        // Every absence reason (kind ABSENT; required iff ABSENT).
        AbsenceReason.entries.forEachIndexed { index, reason ->
            rows += row("absence-$index", EntryKind.ABSENT, absenceReason = reason)
        }
        // Every provenance (DETECTED_* require a detectedKind).
        Provenance.entries.forEachIndexed { index, provenance ->
            rows +=
                row(
                    "provenance-$index",
                    EntryKind.HOME,
                    provenance = provenance,
                    detectedKind = if (provenance == Provenance.MANUAL) null else EntryKind.HOME,
                )
        }

        val json = entriesRequestBody(rows)
        // One delimited line the host script extracts; the fixture is small enough to stay under logcat's
        // per-message limit. The BEGIN/END markers make the capture unambiguous.
        Log.i(WIRE_DUMP_TAG, "BEGIN $json END")
    }
}
