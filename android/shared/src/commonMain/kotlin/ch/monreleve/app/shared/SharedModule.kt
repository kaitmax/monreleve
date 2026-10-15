package ch.monreleve.app.shared

// KMP-0 increment 1 (R368). The one trivial commonMain function that proves :shared configures, compiles as
// common code (the metadata compilation fences out java./android.), and is reachable from :app. It carries
// no behaviour the product depends on; the real moves (calc, fr, dossier, forecast logic) follow in later
// increments. It is deliberately pure Kotlin stdlib - no java., no android. - so the common metadata
// compilation that is this module's platform-free proof has something real to compile.

private const val APP_PACKAGE = "ch.monreleve.app"
private const val MODULE_SEGMENT = "shared"

/**
 * The module identifier, built from its package and segment. No platform dependency, so it compiles for
 * every declared target. Composed from two constants rather than a single literal so it is a genuine common
 * function (what increment 1 proves compiles and runs for every target) rather than a constant in disguise.
 */
fun sharedModuleId(): String = "$APP_PACKAGE.$MODULE_SEGMENT"
