package ch.monreleve.app.data.repo

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.RhythmKind
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.datetime.DayOfWeek

// AN-FORECAST (R341). The pure rhythm mapping - domain <-> entity and the weekday -> EntryKind map the
// forecast imagines from. The DAO itself is Room and is exercised on the device; this pins the mapping.

class RhythmMappingTest : FunSpec({
    test("a Domicile day projects to HOME and a Suisse day to CH; unset days are absent from the map") {
        val rhythm =
            WeeklyRhythm(
                monday = RhythmKind.SUISSE,
                tuesday = RhythmKind.DOMICILE,
                wednesday = null,
                thursday = RhythmKind.DOMICILE,
                friday = RhythmKind.SUISSE,
            )
        rhythm.toEntryKindMap() shouldBe
            mapOf(
                DayOfWeek.MONDAY to EntryKind.CH,
                DayOfWeek.TUESDAY to EntryKind.HOME,
                DayOfWeek.THURSDAY to EntryKind.HOME,
                DayOfWeek.FRIDAY to EntryKind.CH,
            )
        rhythm.domicileCount shouldBe 2
        rhythm.isEmpty shouldBe false
    }

    test("an all-null rhythm is empty and imagines nothing") {
        WeeklyRhythm().isEmpty shouldBe true
        WeeklyRhythm().toEntryKindMap() shouldBe emptyMap()
    }

    test("the entity round-trips through the domain, carrying the account tag back") {
        val rhythm = WeeklyRhythm(monday = RhythmKind.DOMICILE, friday = RhythmKind.SUISSE)
        val entity = rhythm.toEntity("tag-abc")
        entity.accountTag shouldBe "tag-abc"
        entity.toWeeklyRhythm() shouldBe rhythm
    }
})
