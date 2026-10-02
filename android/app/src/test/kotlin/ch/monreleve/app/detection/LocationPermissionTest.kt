package ch.monreleve.app.detection

import ch.monreleve.app.settings.LoggingMode
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// AN-AUTO increment 3b (R316). The revocation decision, pure so the JVM can prove it. The Context-touching
// permission reads (fineLocationGranted / backgroundLocationGranted / locationFullyGranted) are exercised
// on the phone (A1); this fixes the ONE branch that decides the fallback: auto mode + no permission -> revoked.

class LocationPermissionTest {
    @Test
    fun autoModeWithTheGrantIsNotRevoked() {
        assertFalse(autoDetectionPermissionLost(LoggingMode.AUTO_DETECT, fullyGranted = true))
    }

    @Test
    fun autoModeWithoutTheGrantIsRevoked() {
        // The person turned the permission off in system settings: fall back to manual, stop sampling (R316).
        assertTrue(autoDetectionPermissionLost(LoggingMode.AUTO_DETECT, fullyGranted = false))
    }

    @Test
    fun manualModeIsNeverRevoked() {
        // Manual mode never sampled, so a missing permission is nothing to fall back from.
        assertFalse(autoDetectionPermissionLost(LoggingMode.MANUAL, fullyGranted = false))
    }
}
