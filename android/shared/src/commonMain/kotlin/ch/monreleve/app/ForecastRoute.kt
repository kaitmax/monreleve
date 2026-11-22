package ch.monreleve.app

// IOS-MOVE-TABS R1360: moved from :app's MainActivity.kt (where it was internal) with the four-tab wiring
// (MainTabs.kt), so both shells hold the same route. Same package, so its name is unchanged.

/**
 * AN-FORECAST: the forecast screens reached from within the shell (not bottom-nav tabs) - a small overlay route beside
 * the AppTab state, null when a tab is showing. AN-SIM adds the simulator, reached from Prevision.
 */
enum class ForecastRoute { RYTHME, PREVISION, SIMULATION }
