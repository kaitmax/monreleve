package ch.monreleve.app.ui.screens.parametres

import ch.monreleve.app.fr.ParametresCopy
import org.junit.Assert.assertEquals
import org.junit.Test

// AN-PARAMS. The « Début d'activité » row's value is DERIVED from the stored ISO day (R181 - presentation only,
// never a second source): empty shows « Toute l'année », a stored day shows in the Swiss format (dd.MM.yyyy, the
// product's format everywhere - SPEC 11.5 / the relay), and an unparseable stored value falls back to its raw
// text rather than crashing a row. The storage format (AAAA-MM-JJ, R28) no longer leaks onto the screen; this
// asserts the three branches of startDateDisplay, which the function's own KDoc promises a JVM test covers.
//
// The empty branch asserts against ParametresCopy.START_DATE_EMPTY by REFERENCE, not a retyped « Toute l'année »
// (R181/R206 - one home; a retyped French literal would also risk the apostrophe guards). The formatted branch
// asserts the literal « 15.03.2026 » because that rendered value IS the assertion (R171) - it proves the Swiss
// dd.MM.yyyy order actually reaches the row, which a delegation to formatDate alone would not.

class ParametresListRowsTest {
    @Test
    fun emptyStartDateShowsTheWholeYearText() {
        assertEquals(ParametresCopy.START_DATE_EMPTY, startDateDisplay(""))
    }

    @Test
    fun blankStartDateIsTreatedAsEmpty() {
        assertEquals(ParametresCopy.START_DATE_EMPTY, startDateDisplay("   "))
    }

    @Test
    fun aStoredIsoDayShowsInTheSwissFormat() {
        assertEquals("15.03.2026", startDateDisplay("2026-03-15"))
    }

    @Test
    fun anUnparseableStoredValueFallsBackToItsRawText() {
        // getOrDefault: a malformed stored value shows as-is rather than throwing inside a composable row.
        assertEquals("pas-une-date", startDateDisplay("pas-une-date"))
    }
}
