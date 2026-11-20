package ch.monreleve.app.detection

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

// AN-PLAY-PACK (R1124). WHETHER THIS BUILD HAS DETECTION, READ FROM WHAT ITS MANIFEST DECLARES. The
// manual-only fallback (-PmanualOnly=true) removes both location permissions from the merged manifest; this reads
// the permissions the installed package REQUESTS and answers from them, so there is no second flag that could
// disagree with the manifest (R181: derived from the thing it describes). Without detection the app shows no
// detection entry point: onboarding skips its mode step (onboarding/ManualOnlyOnboarding.kt) and Paramètres has no
// detection switch (MainActivity passes no handler). Not a permission GRANT check - that is LocationPermission.kt's
// - but what the build can ever ask for.

/** True when the requested permissions include BOTH location permissions automatic detection needs. */
fun detectionDeclared(requested: Array<String>?): Boolean =
    requested != null && FINE_LOCATION in requested && BACKGROUND_LOCATION in requested

/** Whether this installed build declares detection's permissions (false in the manual-only fallback). */
fun detectionAvailable(context: Context): Boolean {
    val packageManager = context.packageManager
    val info =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.getPackageInfo(
                context.packageName,
                PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()),
            )
        } else {
            @Suppress("DEPRECATION")
            packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
        }
    return detectionDeclared(info.requestedPermissions)
}
