package ch.monreleve.app.detection

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.core.content.ContextCompat

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
