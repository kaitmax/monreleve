package ch.monreleve.app.debug

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.sync.MAX_NOTE_LENGTH
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.OffsetDateTime

// DebugSeeder is the AN-AUDIT measurement dataset generator (R197). This proves it is a PURE, DETERMINISTIC
// function of (asOf, scenario): exact counts, disjoint calendar ranges, pinned boundary rows, and every
// consistency invariant the app's own write path would uphold. It lives in src/testDebug so it compiles
// against the debug variant, the only one carrying DebugSeeder (as SessionInjectionTest does).
//
// The expectations here are computed INDEPENDENTLY of DebugSeeder - a second weekday enumeration, hand-pinned
// boundary dates, a codepoint whitelist built in this file - so a bug in the generator's day math or note
// construction fails a test rather than being mirrored by it.

private val AS_OF = LocalDate.of(2026, 9, 30)
private const val ANCHOR = 2026
private const val OVERSIZE_FACTOR = 20

private fun weekdaysIn(
    year: Int,
    upTo: LocalDate? = null,
): List<LocalDate> {
    val end = upTo ?: LocalDate.of(year, 12, 31)
    return generateSequence(LocalDate.of(year, 1, 1)) { it.plusDays(1) }
        .takeWhile { !it.isAfter(end) }
        .filter { it.dayOfWeek != DayOfWeek.SATURDAY && it.dayOfWeek != DayOfWeek.SUNDAY }
        .toList()
}

private fun gen(scenario: SeedScenario): List<EntryEntity> = DebugSeeder.generate(AS_OF, scenario)

private fun EntryEntity.year(): Int = dayDate.substring(0, 4).toInt()

class DebugSeederTest : FunSpec({
    test("the decade covers anchor-9..anchor, weekdays only, the anchor year truncated at asOf") {
        val decade = gen(SeedScenario.DECADE)
        val expected =
            (ANCHOR - 9 until ANCHOR).sumOf { weekdaysIn(it).size } + weekdaysIn(ANCHOR, AS_OF).size
        decade shouldHaveSize expected
        decade.map { it.year() }.toSortedSet() shouldBe (ANCHOR - 9..ANCHOR).toSortedSet()
        decade.all { it.portion == Portion.FULL } shouldBe true
    }

    test("the decade's first row is the first weekday of anchor-9 and its last row does not exceed asOf") {
        val decade = gen(SeedScenario.DECADE).sortedBy { it.dayDate }
        // 2017-01-01 is a Sunday, so the first recorded weekday is Monday 2017-01-02.
        decade.first().dayDate shouldBe "2017-01-02"
        decade.last().dayDate shouldBe weekdaysIn(ANCHOR, AS_OF).last().toString()
        (decade.last().dayDate <= AS_OF.toString()).shouldBeTrue()
    }

    test("the half-day year is anchor-10 with an AM and a PM row for each weekday, no FULL") {
        val half = gen(SeedScenario.HALF_DAY)
        half shouldHaveSize weekdaysIn(ANCHOR - 10).size * 2
        half.all { it.year() == ANCHOR - 10 } shouldBe true
        half.none { it.portion == Portion.FULL } shouldBe true
        half.groupBy { it.dayDate }.values.all { rows ->
            rows.map { it.portion }.toSet() == setOf(Portion.AM, Portion.PM)
        } shouldBe true
    }

    test("the absent year is anchor-11, every weekday an absence with a reason") {
        val absent = gen(SeedScenario.ABSENT)
        absent shouldHaveSize weekdaysIn(ANCHOR - 11).size
        absent.all { it.year() == ANCHOR - 11 } shouldBe true
        absent.all { it.kind == EntryKind.ABSENT && it.absenceReason != null } shouldBe true
        absent.map { it.absenceReason }.toSet() shouldBe AbsenceReason.entries.toSet()
    }

    test("the late year is anchor-12, every day recorded months after the day it records") {
        val late = gen(SeedScenario.LATE)
        late shouldHaveSize weekdaysIn(ANCHOR - 12).size
        late.all { it.year() == ANCHOR - 12 } shouldBe true
        late.all { it.kind != EntryKind.ABSENT && it.absenceReason == null } shouldBe true
        late.all { row ->
            val recorded = OffsetDateTime.parse(row.firstRecordedAt).toLocalDate()
            recorded.isAfter(LocalDate.parse(row.dayDate))
        } shouldBe true
    }

    test("worked rows are MANUAL provenance with no detection fields, and carry no coordinate-shaped data") {
        val worked = gen(SeedScenario.DECADE) + gen(SeedScenario.LATE)
        worked.all {
            it.provenance == Provenance.MANUAL && it.detectedKind == null && it.detectedAt == null
        } shouldBe true
    }

    test("synced rows carry server columns; the oversized-note row is FAILED with none") {
        val settled = gen(SeedScenario.DECADE)
        settled.all {
            it.syncState == SyncState.SYNCED &&
                it.serverId != null &&
                it.firstRecordedAt != null &&
                it.lastModifiedAt != null
        } shouldBe true
    }

    test("the notes scenario carries four pathological notes with the right shapes") {
        val notes = gen(SeedScenario.NOTES)
        notes shouldHaveSize 4
        notes.all { it.year() == ANCHOR - 13 } shouldBe true

        val oversized = notes.single { (it.note?.length ?: 0) > MAX_NOTE_LENGTH }
        oversized.note!!.length shouldBe MAX_NOTE_LENGTH * OVERSIZE_FACTOR
        oversized.syncState shouldBe SyncState.FAILED
        oversized.serverId shouldBe null
        oversized.firstRecordedAt shouldBe null

        val legal = notes.filter { it != oversized }
        legal.all { it.syncState == SyncState.SYNCED && it.serverId != null } shouldBe true
        legal.all { (it.note?.length ?: Int.MAX_VALUE) <= MAX_NOTE_LENGTH } shouldBe true

        val whitespace = whitespaceRowOf(legal)
        whitespace.note!!.codePoints().anyMatch { it == 0x00A0 } shouldBe true
        whitespace.note!!.codePoints().anyMatch { it == 0x3000 } shouldBe true

        legal.any { row -> row.note!!.codePoints().anyMatch { it in 0x0590..0x06FF } } shouldBe true
        legal.any { row -> row.note!!.codePoints().anyMatch { it >= 0x1F000 } } shouldBe true
    }

    test("generate is deterministic - identical inputs produce byte-identical rows") {
        gen(SeedScenario.ALL) shouldBe gen(SeedScenario.ALL)
    }

    test("ALL composes the five scenarios with no (dayDate, portion) collision and no future rows") {
        val all = gen(SeedScenario.ALL)
        val parts =
            listOf(
                SeedScenario.DECADE,
                SeedScenario.HALF_DAY,
                SeedScenario.ABSENT,
                SeedScenario.LATE,
                SeedScenario.NOTES,
            ).sumOf { gen(it).size }
        all shouldHaveSize parts
        all.map { it.dayDate to it.portion }.toSet() shouldHaveSize parts
        all.map { it.dayDate }.max() shouldBe (all.map { it.dayDate }.max())
        (all.map { it.dayDate }.max() <= AS_OF.toString()).shouldBeTrue()
        all.size shouldBeGreaterThan 3000
    }
})

private fun whitespaceRowOf(rows: List<EntryEntity>): EntryEntity =
    rows.single { row ->
        val cps = row.note!!.codePoints().toArray()
        cps.isNotEmpty() && cps.all { it in WHITESPACE_CODEPOINTS }
    }

// An independent whitelist of whitespace codepoints, so the whitespace note is validated against a set built
// here, not the generator's. Character.isWhitespace is deliberately NOT used: it returns false for NBSP
// (U+00A0), U+2007 and U+202F, which are exactly the interesting cases this note exists to carry.
private val WHITESPACE_CODEPOINTS =
    setOf(
        0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020,
        0x00A0, 0x2002, 0x2003, 0x2007, 0x2009, 0x202F, 0x2028, 0x2029, 0x3000,
    )
