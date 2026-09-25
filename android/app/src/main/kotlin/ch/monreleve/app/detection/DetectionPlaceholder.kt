package ch.monreleve.app.detection

/**
 * Placeholder for on-device detection (AN6+). detection/ is the ONLY package a
 * coordinate type may appear in (SPEC 5 / D18); no coordinate crosses this
 * boundary, and detection/ never imports data/remote. The compile-time fence
 * (increment 3) is the most important in the file - it is D18 made mechanical.
 */
@Suppress("FunctionOnlyReturningConstant") // placeholder; a real function replaces it at AN6
internal fun detectionPlaceholder(): Boolean = true
