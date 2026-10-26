package ch.monreleve.app.design

import androidx.compose.ui.graphics.Color

// IOS-1b-A R602c: MOVED FROM :app's design/DayCell.kt to :shared commonMain (package unchanged). These are the
// calendar grid's VOCABULARY - which kind, how trustworthy, who recorded it (R202) - and the shared CalendarModel
// and the shared Aujourd'hui controller speak them, so they live where both can. The DayCell composable that
// draws them stays in design/DayCell.kt until the design system moves (R603).

/** The four letters SPEC 847 names. Mission's two destinations (FR/third-state) share one letter and a neutral dot. */
enum class DayKind(val letter: String, val dotColour: (Colours) -> Color) {
    SUISSE("S", { it.switzerland }),
    DOMICILE("D", { it.france }),
    MISSION("M", { it.neutral }),
    ABSENCE("A", { it.tertiary }),
}

/** Bundles the four dot colours DayKind reads from, so DayCell needs no direct Tokens import inside the enum. */
data class Colours(val switzerland: Color, val france: Color, val neutral: Color, val tertiary: Color)

/**
 * WHETHER the record can be trusted - independent of WHERE (DayKind).
 *
 * PENDING is a recorded day whose quality the SERVER has not yet fixed (R216): the client may
 * predict lateness to warn (LatenessForecast), but it must not adjudicate the flag. Until the row
 * syncs and the server returns its firstRecordedAt, on-time-versus-late is not yet a fact, so the
 * cell draws no coloured bar - a lettered cell with no bar is already distinct from both an on-time
 * cell (green bar) and an unrecorded one (grey bar). "Pending, never late" (AN10 increment 3).
 */
enum class RecordQuality { ON_TIME, LATE, PENDING, MISSING, NONE }

/**
 * WHO produced the record, in the UI's own vocabulary (R202) - the wire's Provenance enum
 * (data/local) never enters design/ or ui/. Detected days exist on the phone (AN-AUTO records them; AN-PULL
 * brings them down), so every surface names the day's own provenance (AN-GRANULARITY R519).
 * Rendered in the cell's a11y announcement (SPEC 8: provenance is shown wherever an entry is,
 * "never as an icon alone"); DETECTED_CORRECTED also draws the corner mark.
 */
enum class DayProvenance { MANUAL, DETECTED_CONFIRMED, DETECTED_CORRECTED }
