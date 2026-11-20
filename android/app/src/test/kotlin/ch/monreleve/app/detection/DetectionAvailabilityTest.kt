package ch.monreleve.app.detection

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN-PLAY-PACK (R1124). WHETHER THIS BUILD HAS DETECTION IS READ FROM WHAT ITS MANIFEST DECLARES - never from a
 * second flag beside it. The manual-only fallback (-PmanualOnly=true) removes both location permissions from the
 * manifest; the app derives "detection available" from the permissions the installed package REQUESTS, so the
 * manifest and the entry points cannot disagree (R181: derived from the thing it describes, never transcribed).
 * Both directions (R196): the detection build's set answers yes, and every set missing either permission answers no.
 */
class DetectionAvailabilityTest {
    private val internet = "android.permission.INTERNET"
    private val notifications = "android.permission.POST_NOTIFICATIONS"

    @Test
    fun theDetectionBuildsDeclaredSetMeansDetectionIsAvailable() {
        assertTrue(detectionDeclared(arrayOf(internet, FINE_LOCATION, BACKGROUND_LOCATION, notifications)))
    }

    @Test
    fun theManualOnlyBuildsDeclaredSetMeansNoDetection() {
        assertFalse(detectionDeclared(arrayOf(internet, notifications)))
    }

    @Test
    fun eitherPermissionAloneIsNotDetection() {
        assertFalse(detectionDeclared(arrayOf(internet, FINE_LOCATION)))
        assertFalse(detectionDeclared(arrayOf(internet, BACKGROUND_LOCATION)))
    }

    @Test
    fun aPackageThatRequestsNothingHasNoDetection() {
        // PackageInfo.requestedPermissions is NULL, not empty, when a package requests none.
        assertFalse(detectionDeclared(null))
        assertFalse(detectionDeclared(emptyArray()))
    }
}
