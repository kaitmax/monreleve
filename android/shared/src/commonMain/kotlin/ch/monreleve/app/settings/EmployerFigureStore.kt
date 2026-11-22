package ch.monreleve.app.settings

// IOS-MOVE-CORE R1300 (I0's N4). THE CONTRACT ONLY, split from :app's settings/EmployerFigure.kt so iOS can implement
// it without an :app change. The SharedPreferences store, the in-memory one and the key prefix stay in :app, and the
// reasons the figure stays on the phone (R342) are written there.

/** The employer attestation rate the current account entered for a given year - phone-only (R342). */
interface EmployerFigureStore {
    /** The rate saved for [year] under the active account, or null (no figure, or no active account). */
    fun figureFor(year: Int): Double?

    fun save(
        year: Int,
        rate: Double,
    )
}
