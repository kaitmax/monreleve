package ch.monreleve.app.data.local

import ch.monreleve.app.dossier.AggregatableEntry

// KMP-0 increment 6c (R372, R206) wrote this file as THE BOUNDARY between Room's vocabulary and a second,
// platform-free copy of EntryKind/Portion that :shared's dossier logic took, because Room could not then
// cross the module line. It has since (KMP-2b), so KMP-4 (R465) collapsed the two sets into one - data.local's
// EntryKind/Portion, which are the Room column type and the wire type - and there is no boundary left to map
// across. toShared() is GONE rather than kept as an identity function; it had no inverse.
//
// What remains is the ONE HOME for the row-to-aggregation projection (R206): the call sites that inlined
// `AggregatableEntry(it.dayDate, it.portion, it.kind)` call it.toAggregatable() instead - the twin of
// settings.Settings.toAggregatableUser().

/** A Room row as the shared aggregation's day record: the three columns the aggregation reads. */
fun EntryEntity.toAggregatable(): AggregatableEntry =
    AggregatableEntry(dayDate = dayDate, portion = portion, kind = kind)
