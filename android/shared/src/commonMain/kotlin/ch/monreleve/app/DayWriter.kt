package ch.monreleve.app

// IOS-1b-A R602: MOVED FROM :app to :shared commonMain (package unchanged), so the shared Aujourd'hui controller
// can read it on every platform. Extracted from MainGraph.kt; MainGraphDayWriterCensusTest (:app, IOS-MOVE-GRAPH
// R1311) still finds it by type.

/**
 * A controller that writes a day (SPEC 11.2 Aujourd'hui, SPEC 11.3 the calendar). Every one MUST be
 * built with a real requestSync: a day written to Room but never enqueued for the drain (SPEC 13.2)
 * never reaches the server, which is the AN10 defect exactly. Implemented by the day-writing
 * controllers so MainGraphDayWriterCensusTest can ENUMERATE them by type rather than by a hand-kept list - a
 * controller added here that writes a day is covered the day it is added.
 */
interface DayWriter {
    val requestSync: () -> Unit
}
