package ch.monreleve.app.data.local

import ch.monreleve.app.dossier.AggregatableEntry
import ch.monreleve.app.dossier.EntryKind as SharedEntryKind
import ch.monreleve.app.dossier.Portion as SharedPortion

// KMP-0 increment 6c (R372, R206). THE BOUNDARY between Room's wire vocabulary and the shared aggregation's
// platform-free vocabulary. :shared's dossier logic takes AggregatableEntry over dossier.EntryKind/Portion;
// a Room row carries data.local.EntryKind/Portion (the web wire contract, the Room column type). This file
// is the one place the two meet - the twin of settings.Settings.toAggregatableUser(). ONE HOME for the row
// mapping (R206): the call sites that inlined `AggregatableEntry(it.dayDate, it.portion, it.kind)` call
// it.toAggregatable() instead.
//
// Each `when` over the data.local values is exhaustive, so a new wire kind/portion is a compile error here
// until it is mapped - the drift guard R372 relies on, with the shared side's countDays `when` as its twin.
// EntryVocabularyBindingTest asserts the two enums' constant names match, so the mapping is a name identity.

/** A Room row as the shared aggregation's day record (R372 boundary mapping). */
fun EntryEntity.toAggregatable(): AggregatableEntry =
    AggregatableEntry(dayDate = dayDate, portion = portion.toShared(), kind = kind.toShared())

/** The wire kind as the aggregation vocabulary (same names; the binding test asserts it). */
fun EntryKind.toShared(): SharedEntryKind =
    when (this) {
        EntryKind.CH -> SharedEntryKind.CH
        EntryKind.HOME -> SharedEntryKind.HOME
        EntryKind.MISSION_FR -> SharedEntryKind.MISSION_FR
        EntryKind.MISSION_THIRD -> SharedEntryKind.MISSION_THIRD
        EntryKind.ABSENT -> SharedEntryKind.ABSENT
    }

/** The wire portion as the aggregation vocabulary. */
fun Portion.toShared(): SharedPortion =
    when (this) {
        Portion.FULL -> SharedPortion.FULL
        Portion.AM -> SharedPortion.AM
        Portion.PM -> SharedPortion.PM
    }
