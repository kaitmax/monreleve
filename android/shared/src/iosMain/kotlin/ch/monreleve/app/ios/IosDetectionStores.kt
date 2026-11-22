package ch.monreleve.app.ios

import ch.monreleve.app.settings.EmployerFigureStore
import ch.monreleve.app.settings.EveningNotificationStore
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import platform.Foundation.NSUserDefaults

// IOS-SHELL-2 (R1334, R1337). THE TWO PERSISTENT STORES OF iOS's "DETECTION FILE" - what Android keeps in
// monreleve.detection beside the logging mode: the evening opt-in with its last-notified day (R323), and the employer
// figures (AN-RECON R342). Both over NSUserDefaults, as UserDefaultsSettingsStore is, under keys of their own.
//
// WHY PERSISTENT. IOS-SHELL-1 held the opt-in in memory (its DEVIATION 7, iOS Ruling 13): every launch forgot it, so
// the foreground re-plan (R1330) would have planned nothing after a relaunch. An in-memory employer figure would be
// lost the
// same way (iOS Ruling 11 Q2). The contracts the other stores run (commonTest contracts/, iosTest
// ImplementationContractTests.kt) hold both to "another instance reads what this one wrote".
//
// THE SWEEPS ARE IosDetectionFile's (IosShell.kt), as Android's are SharedPrefsDetectionModeStore's: a sign-out and a
// deletion take the opt-in, the day AND the figures; a server-ended session takes the opt-in and the day and KEEPS the
// figures (R527 - already their account's own, on this phone only, brought back by nothing if erased). Each store
// therefore exposes ONE erase of everything it holds, and nothing finer.
//
// A reinstall wipes UserDefaults, so neither survives one (unlike the Keychain - the first-launch clear's reason).

/** The evening opt-in's key. */
internal const val EVENING_ENABLED_KEY = "ch.monreleve.app.detection.evening.enabled"

/** The day the evening notification was last shown (ISO, Europe/Paris), as Android's store keeps it. */
internal const val EVENING_LAST_DAY_KEY = "ch.monreleve.app.detection.evening.lastNotifiedDay"

/** The employer figures, ONE key holding every "<accountTag>.<year>" -> rate - one atomic write, one erase. */
internal const val EMPLOYER_FIGURES_KEY = "ch.monreleve.app.detection.employer.v1"

/** The evening reminder's opt-in and last-notified day, over NSUserDefaults (off by default - D19). */
class UserDefaultsEveningNotificationStore(
    private val defaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
) : EveningNotificationStore {
    override fun isEnabled(): Boolean = defaults.boolForKey(EVENING_ENABLED_KEY)

    override fun setEnabled(enabled: Boolean) {
        defaults.setBool(enabled, forKey = EVENING_ENABLED_KEY)
    }

    override fun lastNotifiedDay(): String? = defaults.stringForKey(EVENING_LAST_DAY_KEY)

    override fun markNotified(dayDate: String) {
        defaults.setObject(dayDate, forKey = EVENING_LAST_DAY_KEY)
    }

    /** The sweep: the opt-in AND the day, both gone (Android's file clear erases both). */
    fun erase() {
        defaults.removeObjectForKey(EVENING_ENABLED_KEY)
        defaults.removeObjectForKey(EVENING_LAST_DAY_KEY)
    }
}

private val figuresSerializer = MapSerializer(String.serializer(), Double.serializer())

/**
 * The employer figures (R342), account-tagged and per year, over ONE NSUserDefaults key. The account is read at each
 * call (AN-ACCOUNT-TAG R423), never captured; no account reads and writes nothing (R303).
 */
class UserDefaultsEmployerFigureStore(
    private val defaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
    private val accountTag: () -> String?,
) : EmployerFigureStore {
    private fun keyFor(year: Int): String? = accountTag()?.let { "$it.$year" }

    private fun all(): Map<String, Double> =
        defaults.stringForKey(EMPLOYER_FIGURES_KEY)?.let { text ->
            runCatching { Json.decodeFromString(figuresSerializer, text) }.getOrNull()
        } ?: emptyMap()

    override fun figureFor(year: Int): Double? = keyFor(year)?.let { all()[it] }

    override fun save(
        year: Int,
        rate: Double,
    ) {
        val key = keyFor(year) ?: return
        defaults.setObject(Json.encodeToString(figuresSerializer, all() + (key to rate)), forKey = EMPLOYER_FIGURES_KEY)
    }

    /** The sweep: every account's figures, every year (a sign-out and a deletion - never a server-ended session). */
    fun erase() {
        defaults.removeObjectForKey(EMPLOYER_FIGURES_KEY)
    }
}
