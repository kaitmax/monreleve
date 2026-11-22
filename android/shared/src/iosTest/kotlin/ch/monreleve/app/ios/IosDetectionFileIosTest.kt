package ch.monreleve.app.ios

import platform.Foundation.NSUserDefaults
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-SHELL-2 (R1334, R1337). iOS's DETECTION FILE IS SWEPT AS ANDROID'S IS (DetectionModeStore's contract, R295/R527),
// over the REAL persistent stores in a suite of the test's own:
//   - clear (a sign-out, a deletion): the evening opt-in, its last-notified day AND every employer figure go;
//   - clearForSessionEnd (a session the server ended): the opt-in and the day go, the employer figures STAY (R527).
// Each case first asserts the value is THERE (R169's corollary - an erase of nothing proves nothing), then reads it
// back through NEW instances, as a relaunch would.

class IosDetectionFileIosTest {
    private val suite = uniqueName("ios-shell-2-detection-file")

    private fun defaults() = NSUserDefaults(suiteName = suite)

    private fun evening() = UserDefaultsEveningNotificationStore(defaults())

    private fun employer() = UserDefaultsEmployerFigureStore(defaults()) { "tag-a" }

    private fun file(): IosDetectionFile {
        val evening = evening()
        val employer = employer()
        return IosDetectionFile(eraseEvening = evening::erase, eraseEmployerFigures = employer::erase)
    }

    private fun fill() {
        evening().setEnabled(true)
        evening().markNotified("2026-11-16")
        employer().save(2025, 41.25)
        assertTrue(evening().isEnabled(), "the opt-in is there before the sweep")
        assertEquals("2026-11-16", evening().lastNotifiedDay(), "the day is there before the sweep")
        assertEquals(41.25, employer().figureFor(2025), "the figure is there before the sweep")
    }

    @AfterTest
    fun cleanUp() = NSUserDefaults.standardUserDefaults.removePersistentDomainForName(suite)

    @Test
    fun aSignOutOrADeletionErasesTheOptInTheDayAndEveryEmployerFigure() {
        fill()
        file().clear()
        assertFalse(evening().isEnabled(), "R303: the next account does not inherit the opt-in")
        assertNull(evening().lastNotifiedDay(), "the day goes with the file, as Android's clear takes it")
        assertNull(employer().figureFor(2025), "R289/R295: the voluntary sign-out and the deletion take the figures")
    }

    @Test
    fun aServerEndedSessionErasesTheOptInAndKeepsTheEmployerFigures() {
        fill()
        file().clearForSessionEnd()
        assertFalse(evening().isEnabled(), "R527: notifications off for whoever comes back")
        assertNull(evening().lastNotifiedDay())
        assertEquals(41.25, employer().figureFor(2025), "R527: the same person's typed figure is kept")
    }
}
