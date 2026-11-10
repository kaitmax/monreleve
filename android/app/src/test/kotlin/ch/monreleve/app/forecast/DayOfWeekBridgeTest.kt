package ch.monreleve.app.forecast

import ch.monreleve.app.fr.RythmeCopy
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.toJavaDayOfWeek
import kotlinx.datetime.toJavaLocalDate
import kotlinx.datetime.toKotlinDayOfWeek
import kotlin.test.Test
import kotlin.test.assertTrue
import java.time.DayOfWeek as JavaDayOfWeek
import kotlinx.datetime.DayOfWeek as KotlinDayOfWeek
import kotlinx.datetime.LocalDate as KotlinLocalDate

// IOS-2d R813. THE ORACLE FOR THE WEEKDAY SWAP: java.time.DayOfWeek and kotlinx.datetime.DayOfWeek (0.7.1, its own
// enum since KMP-DT) are proven equal on every property the forecast reads - for all SEVEN days, not only the five a
// rhythm sets: the name (equality, Java serialization's enum form), the ordinal (RythmeCopy.DAYS[ordinal], the screens'
// only arithmetic on a day), the ISO number (java.time's getValue() 1..7 against kotlinx's isoDayNumber), the week's
// ends (Monday first, Sunday last), and the library's converters both ways. Plus the week a date falls in on the days
// R813 names (29 Feb 2024, the 2026 DST Sundays, 31 Dec 2026 / 1 Jan 2027) read by both libraries.
//
// It needs BOTH libraries, so it is JVM-only and STAYS in :app's test scope - it is the evidence that the swap is
// behaviour-neutral, not the pin (ForecastDaysPinTest is the pin, and moves). It holds before and after the swap.
class DayOfWeekBridgeTest {
    @Test
    fun theTwoEnumsAgreeOnNameOrdinalIsoNumberAndOrderForAllSevenDays() {
        val m = mutableListOf<String>()
        val java = JavaDayOfWeek.entries
        val kotlin = KotlinDayOfWeek.entries
        if (java.size != DAYS_IN_A_WEEK || kotlin.size != DAYS_IN_A_WEEK) m += "sizes ${java.size} / ${kotlin.size}"
        val javaNames = java.map { it.name }
        val kotlinNames = kotlin.map { it.name }
        if (javaNames != kotlinNames) m += "names $javaNames / $kotlinNames"
        for (day in java) m += mismatchesOf(day)
        val weekStart = java.first() == JavaDayOfWeek.MONDAY && kotlin.first() == KotlinDayOfWeek.MONDAY
        if (!weekStart) m += "the week starts elsewhere: ${java.first()} / ${kotlin.first()}"
        if (java.last().value != DAYS_IN_A_WEEK || kotlin.last().isoDayNumber != DAYS_IN_A_WEEK) m += "Sunday is not 7"
        assertTrue(m.isEmpty(), "java.time vs kotlinx DayOfWeek: ${m.size} mismatch(es)\n" + m.joinToString("\n"))
    }

    /** One java.time day against its kotlinx counterpart: name, ordinal, ISO number, both converters, the entry. */
    private fun mismatchesOf(day: JavaDayOfWeek): List<String> {
        val m = mutableListOf<String>()
        val k = day.toKotlinDayOfWeek()
        if (k.name != day.name) m += "<$day> converts to $k"
        if (k.ordinal != day.ordinal) m += "<$day> ordinal ${day.ordinal} / ${k.ordinal}"
        if (k.isoDayNumber != day.value) m += "<$day> getValue ${day.value} / isoDayNumber ${k.isoDayNumber}"
        if (KotlinDayOfWeek(day.value) != k) m += "<$day> DayOfWeek(${day.value}) is ${KotlinDayOfWeek(day.value)}"
        if (k.toJavaDayOfWeek() != day) m += "<$day> round trip ${k.toJavaDayOfWeek()}"
        if (KotlinDayOfWeek.entries[day.ordinal] != k) m += "<$day> the kotlinx entry at its ordinal differs"
        return m
    }

    @Test
    fun eachRhythmWeekdaysLabelIsTheSameUnderBothEnums() {
        val m = mutableListOf<String>()
        val weekdays = JavaDayOfWeek.entries.filter { it.value <= RythmeCopy.DAYS.size }
        if (weekdays.size != RythmeCopy.DAYS.size) m += "positive control: ${weekdays.size} weekdays"
        for (day in weekdays) {
            val viaJava = RythmeCopy.DAYS[day.ordinal]
            val viaKotlin = RythmeCopy.DAYS[day.toKotlinDayOfWeek().ordinal]
            if (viaJava != viaKotlin) m += "<$day> $viaJava / $viaKotlin"
        }
        assertTrue(m.isEmpty(), "labels by ordinal: ${m.size} mismatch(es)\n" + m.joinToString("\n"))
    }

    @Test
    fun bothLibrariesNameTheSameWeekdayOnR813sDates() {
        val m = mutableListOf<String>()
        val dates =
            listOf(
                KotlinLocalDate(2024, 2, 28),
                KotlinLocalDate(2024, 2, 29),
                KotlinLocalDate(2024, 3, 1),
                KotlinLocalDate(2026, 3, 29),
                KotlinLocalDate(2026, 10, 25),
                KotlinLocalDate(2026, 12, 31),
                KotlinLocalDate(2027, 1, 1),
            )
        for (date in dates) {
            val javaDay = date.toJavaLocalDate().dayOfWeek
            if (date.dayOfWeek != javaDay.toKotlinDayOfWeek()) m += "<$date> kotlinx ${date.dayOfWeek} / java $javaDay"
            val iso = date.dayOfWeek.isoDayNumber
            if (iso != javaDay.value) m += "<$date> ISO $iso / ${javaDay.value}"
        }
        assertTrue(m.isEmpty(), "weekday of a date: ${m.size} mismatch(es)\n" + m.joinToString("\n"))
    }

    private companion object {
        const val DAYS_IN_A_WEEK = 7
    }
}
