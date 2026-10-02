package ch.monreleve.app.detection

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import ch.monreleve.app.settings.LoggingMode

// AN-AUTO increment 3b (R316). The location permissions automatic mode needs, the granted checks, and the
// revocation decision. FINE for the 150 m buffer (COARSE cannot place a point against the border, D25);
// BACKGROUND, as a SEPARATE grant on API 29+, to sample while the app is closed. No coordinate is read here -
// these are permission names and granted booleans only (D18 lives in LiveLocation, which discards the fix).

/** The in-use location permission (requested FIRST). */
const val FINE_LOCATION = Manifest.permission.ACCESS_FINE_LOCATION

/** The background location permission (requested as a SEPARATE step on API 29+). */
const val BACKGROUND_LOCATION = Manifest.permission.ACCESS_BACKGROUND_LOCATION

/** Whether ACCESS_FINE_LOCATION is granted. */
fun fineLocationGranted(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

/**
 * Whether ACCESS_BACKGROUND_LOCATION is granted. Below API 29 the in-use grant covers background use, so FINE
 * being granted is enough; from API 29 the OS tracks a separate background grant.
 */
fun backgroundLocationGranted(context: Context): Boolean =
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        fineLocationGranted(context)
    } else {
        ContextCompat.checkSelfPermission(context, BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

/** Whether BOTH permissions automatic sampling needs are granted. */
fun locationFullyGranted(context: Context): Boolean = fineLocationGranted(context) && backgroundLocationGranted(context)

/**
 * R316: automatic mode has lost its permission. True when the mode is AUTO_DETECT but the OS no longer grants
 * what sampling needs (the person revoked it in system settings). On true the app falls back to MANUAL and
 * stops sampling - it does NOT crash, nag, or PATCH consent=false (the person may re-grant later).
 */
fun autoDetectionPermissionLost(
    mode: LoggingMode,
    fullyGranted: Boolean,
): Boolean = mode == LoggingMode.AUTO_DETECT && !fullyGranted
