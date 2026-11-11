package ch.monreleve.app.forecast

import ch.monreleve.app.data.local.RhythmKind

// IOS-2d R813. THE SCREEN'S WORD FOR A WEEKDAY'S RHYTHM, AND ITS ONE MAPPING TO THE STORED KIND. Moved unchanged out of
// ForecastState.kt (the enum) and ForecastController.kt (the two mappings) beside ForecastDays.kt, which uses them, so
// both can be pinned (ForecastDaysPinTest) and shared before the controllers move. In its own file because it is the
// one class here (detekt MatchingDeclarationName).

/** A weekday's rhythm, in the screen's vocabulary. Absent from [ForecastState.rhythmDays] = not set. */
enum class RhythmChoice { SUISSE, DOMICILE }

fun RhythmChoice.toKind(): RhythmKind =
    when (this) {
        RhythmChoice.SUISSE -> RhythmKind.SUISSE
        RhythmChoice.DOMICILE -> RhythmKind.DOMICILE
    }

fun RhythmKind.toChoice(): RhythmChoice =
    when (this) {
        RhythmKind.SUISSE -> RhythmChoice.SUISSE
        RhythmKind.DOMICILE -> RhythmChoice.DOMICILE
    }
