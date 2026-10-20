package ch.monreleve.app.data.local

// AN-FORECAST (R341). The planning-only kind a weekday is worked at: SUISSE (in Switzerland) or
// DOMICILE (teletravail, from home). A LOCAL-ONLY enum, never on the wire - the weekly rhythm is a
// planning preference, not a record (R340) and not a server field. Persisted by Room as its constant
// name, the same way the wire enums are, with no @TypeConverter to drift.

enum class RhythmKind { SUISSE, DOMICILE }

/**
 * The entry kind a rhythm day projects to: a Suisse day is a day worked in Switzerland (CH), a Domicile
 * day is telework (HOME). The forecast imagines each rhythm weekday as this kind (dossier/Forecast.kt).
 */
fun RhythmKind.toEntryKind(): EntryKind =
    when (this) {
        RhythmKind.SUISSE -> EntryKind.CH
        RhythmKind.DOMICILE -> EntryKind.HOME
    }
