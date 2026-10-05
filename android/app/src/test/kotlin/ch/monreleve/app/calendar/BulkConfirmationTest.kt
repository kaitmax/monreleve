package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.dossier.LatenessForecast
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

// AN-CAL2 (section 2, C4). The confirmation's two conditional lines, computed purely. « N jours déjà
// renseignés seront modifiés » appears exactly when some chosen days already hold a value; « Ces jours seront
// marqués saisie tardive » exactly when some chosen days are older than the late threshold (R286, never a 7).

private fun row(dayDate: String): EntryEntity =
    EntryEntity(
        clientMutationId = "m-$dayDate",
        dayDate = dayDate,
        portion = Portion.FULL,
        kind = EntryKind.HOME,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = null,
        firstRecordedAt = null,
        lastModifiedAt = null,
        syncState = SyncState.PENDING,
    )

class BulkConfirmationTest : FunSpec({
    // Observed "now" is 2026-06-15T10:00Z. A day is late if recorded more than BACKFILL_DAYS (7) after it:
    // 2026-06-07 is 8 days before -> late; 2026-06-10 is 5 days before -> on time.
    val now = Instant.parse("2026-06-15T10:00:00Z")

    test("the confirmation lists the chosen days sorted and carries the late threshold (R286)") {
        val conf =
            bulkConfirmation(
                selectedDays = setOf("2026-06-10", "2026-06-08", "2026-06-09"),
                entries = emptyList(),
                kind = RecordedKind.ABSENCE,
                absence = null,
                now = now,
            )
        conf.days shouldBe listOf("2026-06-08", "2026-06-09", "2026-06-10")
        conf.lateThresholdDays shouldBe LatenessForecast.BACKFILL_DAYS
    }

    test("« déjà renseignés » counts exactly the chosen days that already hold a value (C4)") {
        val conf =
            bulkConfirmation(
                selectedDays = setOf("2026-06-10", "2026-06-11", "2026-06-12"),
                entries = listOf(row("2026-06-10"), row("2026-06-12")),
                kind = RecordedKind.SUISSE,
                absence = null,
                now = now,
            )
        conf.alreadyRecordedCount shouldBe 2
    }

    test("no « déjà renseignés » line when none of the chosen days hold a value (C4)") {
        val conf =
            bulkConfirmation(
                selectedDays = setOf("2026-06-10", "2026-06-11"),
                entries = listOf(row("2026-06-02")),
                kind = RecordedKind.SUISSE,
                absence = null,
                now = now,
            )
        conf.alreadyRecordedCount shouldBe 0
    }

    test("« saisie tardive » counts exactly the chosen days older than the threshold (C4)") {
        val conf =
            bulkConfirmation(
                // 06-05 and 06-06 are > 7 days before now (late); 06-10 is 5 days before (on time).
                selectedDays = setOf("2026-06-05", "2026-06-06", "2026-06-10"),
                entries = emptyList(),
                kind = RecordedKind.SUISSE,
                absence = null,
                now = now,
            )
        conf.lateCount shouldBe 2
    }

    test("no « saisie tardive » line when every chosen day is within the threshold (C4)") {
        val conf =
            bulkConfirmation(
                selectedDays = setOf("2026-06-10", "2026-06-11", "2026-06-12"),
                entries = emptyList(),
                kind = RecordedKind.SUISSE,
                absence = null,
                now = now,
            )
        conf.lateCount shouldBe 0
    }
})
