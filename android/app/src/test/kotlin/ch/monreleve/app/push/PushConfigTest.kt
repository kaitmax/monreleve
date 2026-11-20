package ch.monreleve.app.push

import ch.monreleve.app.BuildConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// AN-FCM-CLIENT (R1150). ALL FOUR VALUES OR NOTHING - and nothing is what this repository ships.

class PushConfigTest {
    @Test
    fun allFourValuesMakeAConfiguration() {
        val config = pushConfigOf("project", "1:2:android:3", "key", "2")
        assertEquals(PushConfig.Configured(FirebaseValues("project", "1:2:android:3", "key", "2")), config)
    }

    @Test
    fun anyBlankValueIsNotConfigured() {
        assertEquals(PushConfig.NotConfigured, pushConfigOf("", "", "", ""))
        assertEquals(PushConfig.NotConfigured, pushConfigOf("project", "1:2:android:3", "key", ""))
        assertEquals(PushConfig.NotConfigured, pushConfigOf("project", "  ", "key", "2"))
    }

    @Test
    fun theValuesAreNeverPrinted() {
        val printed = pushConfigOf("project", "1:2:android:3", "a-key-value", "2").toString()
        assertFalse(printed.contains("a-key-value"))
        assertFalse(printed.contains("project"))
    }

    @Test
    fun aBuildWithoutTheFourPropertiesIsNotConfigured() {
        // R1150 / R205: the unit-test build, like gate:clone's and every clean checkout's, carries no Firebase value.
        // A machine that sets FCM_ANDROID_* in its environment would make this fail - which is the point: the gate's
        // build must be the one that ships nothing.
        assertTrue(BuildConfig.FCM_ANDROID_API_KEY.isEmpty())
        assertEquals(PushConfig.NotConfigured, buildPushConfig())
    }
}
