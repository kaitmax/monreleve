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

// AN-AUTO increment 4. The background sampler's fresh fix: request a single GPS update, classify it against
// the bundled polygon, and DISCARD the coordinate in the same breath (D18). GPS (FINE), not NETWORK, because
// the 150 m buffer (D25) needs precision a balanced-power fix cannot give. The whole life of the coordinate is
// the `location.latitude`/`location.longitude` read handed straight to classify inside this function - never
// returned, stored, logged or sent. Returns the Classification, or null if there is no permission, no provider,
// or no fix within the timeout (the sampler then records nothing for that wake - a thin signal is withheld).
@SuppressLint("MissingPermission") // guarded by the checkSelfPermission below
suspend fun awaitClassifiedFix(
    context: Context,
    border: BorderPolygon,
    timeoutMillis: Long = DEFAULT_FIX_TIMEOUT_MILLIS,
): Classification? {
    val granted =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    if (!granted || manager == null || !manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) return null

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
        manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0L, 0f, listener, Looper.getMainLooper())
        continuation.invokeOnCancellation { manager.removeUpdates(listener) }
        // A wake has a bounded budget; if no fix arrives, record nothing rather than hold the worker open.
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            manager.removeUpdates(listener)
            if (continuation.isActive) continuation.resume(null)
        }, timeoutMillis)
    }
}

private const val DEFAULT_FIX_TIMEOUT_MILLIS = 30_000L
