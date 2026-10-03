package ch.monreleve.app.detection

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

// AN6a increment 5. The bridge from the OS location layer to the classifier: read the current
// GPS fix (which `adb emu geo fix` sets on the emulator) and classify it. This is where the
// dev replay proves position-from-the-device, not from an in-app constant. It lives in
// detection/ because it touches a coordinate; the returned Classification carries none.
//
// The coordinate's whole life is the two reads location.latitude/location.longitude handed
// straight to classify - never stored, logged or returned (D18).

/** The dev-replay refresh broadcast (kept out of dev/ so no string literal lands there, fence 4). */
const val DETECTION_REPLAY_REFRESH = "ch.monreleve.app.dev.DETECTION_REPLAY_REFRESH"

// R322 / F-DETECT-GPS. The providers the background sampler tries, IN ORDER. GPS first because the 150 m
// border buffer (D25) needs precision only GPS gives; NETWORK (wifi/cell) second because a telework day is
// spent INDOORS, where GPS_PROVIDER alone returns no fix - REPORT-AN-AUTO-2's real-day read found the worker
// ran every window (logcat SUCCESS) yet recorded NOTHING, so no day could be proposed and every day fell to
// manual. NETWORK works indoors, is already covered by the ACCESS_FINE_LOCATION grant, and needs NO new
// dependency (no Play Services / FusedLocationProviderClient - R136). D18 is untouched: each fix is classified
// and the coordinate discarded in the same breath, per provider.
//
// The strings are LocationManager.GPS_PROVIDER / NETWORK_PROVIDER's frozen platform values ("gps"/"network",
// unchanged since API 1 and relied on by requestLocationUpdates below). Kept as literals so this ordered list
// is readable in a pure JVM unit test without loading android.location.LocationManager at class init
// (LiveLocationFallbackTest asserts the order and the fallback).
internal val FIX_PROVIDERS: List<String> = listOf("gps", "network")

// R322. The fallback ORCHESTRATION, pure and testable: try each provider in order and stop at the FIRST fix.
// A null from every provider (disabled, or no fix within the budget) means the check is MISSED - exactly the
// old behaviour when GPS alone was tried, now reached only after NETWORK has also been silent. It speaks only
// in Classification; no coordinate crosses this seam (D18).
internal suspend fun firstClassifiedFix(
    providers: List<String>,
    fixFromProvider: suspend (provider: String) -> Classification?,
): Classification? {
    for (provider in providers) {
        fixFromProvider(provider)?.let { return it }
    }
    return null
}

/**
 * The classification of the device's last known GPS fix, or null if there is no permission or no
 * fix yet. Never returns or retains the coordinate.
 */
@SuppressLint("MissingPermission") // guarded by the checkSelfPermission below
fun classifyCurrentLocation(
    context: Context,
    border: BorderPolygon,
): Classification? {
    val granted =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    val location =
        if (granted && manager != null) manager.getLastKnownLocation(LocationManager.GPS_PROVIDER) else null
    return location?.let { border.classify(it.latitude, it.longitude) }
}

// AN-AUTO increment 4, R322 (the indoor fix). The background sampler's fresh fix: ask each provider in
// FIX_PROVIDERS, in order, for a single update and stop at the first that classifies, DISCARDING the coordinate
// in the same breath (D18). GPS first for the 150 m buffer's precision (D25); NETWORK as the indoor fallback,
// because GPS alone returns no fix indoors and left every check MISSED (see FIX_PROVIDERS). The whole life of a
// coordinate is the `location.latitude`/`location.longitude` read handed straight to classify inside
// requestOneFix - never returned, stored, logged or sent. Returns the first Classification, or null if there is
// no permission, no manager, or no provider yields a fix within its timeout (the sampler then records nothing
// for that wake - a thin signal is withheld). Each provider is given up to timeoutMillis, so a wake that must
// fall through to NETWORK can take up to FIX_PROVIDERS.size * timeoutMillis; outdoors GPS answers first and
// NETWORK is never consulted.
suspend fun awaitClassifiedFix(
    context: Context,
    border: BorderPolygon,
    timeoutMillis: Long = DEFAULT_FIX_TIMEOUT_MILLIS,
): Classification? {
    val granted =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    if (!granted || manager == null) return null
    return firstClassifiedFix(FIX_PROVIDERS) { provider ->
        requestOneFix(manager, provider, border, timeoutMillis)
    }
}

// R322. One fix from ONE provider: null if that provider is disabled or stays silent within the timeout, so the
// caller can fall through to the next. The coordinate's whole life is the classify(latitude, longitude) call
// here; nothing but the Classification leaves (D18).
@SuppressLint("MissingPermission") // guarded by awaitClassifiedFix's ACCESS_FINE_LOCATION check above
private suspend fun requestOneFix(
    manager: LocationManager,
    provider: String,
    border: BorderPolygon,
    timeoutMillis: Long,
): Classification? {
    if (!manager.isProviderEnabled(provider)) return null
    return suspendCancellableCoroutine { continuation ->
        // The coordinate's whole life: classify(latitude, longitude) here, then nothing but the Classification.
        val listener =
            object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    manager.removeUpdates(this)
                    if (!continuation.isActive) return
                    val side = border.classify(location.latitude, location.longitude)
                    continuation.resume(side)
                }

                // Deprecated no-op overrides kept for pre-API-30 LocationListener source compatibility.
                @Deprecated("required by the interface on older API levels")
                override fun onStatusChanged(
                    provider: String?,
                    status: Int,
                    extras: android.os.Bundle?,
                ) = Unit

                override fun onProviderEnabled(provider: String) = Unit

                override fun onProviderDisabled(provider: String) {
                    manager.removeUpdates(this)
                    if (continuation.isActive) continuation.resume(null)
                }
            }
        manager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
        continuation.invokeOnCancellation { manager.removeUpdates(listener) }
        // A wake has a bounded budget; if no fix arrives, record nothing rather than hold the worker open.
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            manager.removeUpdates(listener)
            if (continuation.isActive) continuation.resume(null)
        }, timeoutMillis)
    }
}

private const val DEFAULT_FIX_TIMEOUT_MILLIS = 30_000L
