package ch.monreleve.app.calc

/**
 * Placeholder for the Kotlin engine port (AN2). Pure Kotlin by contract
 * (SPEC 5): calc/ imports nothing from android.*, androidx.*, or any project
 * package, and has no clock and no I/O - the same fence as the TypeScript engine.
 * The fence (increment 3) is proven against this package.
 */
@Suppress("FunctionOnlyReturningConstant") // placeholder; a real function replaces it at AN2
internal fun enginePlaceholder(): Boolean = true
