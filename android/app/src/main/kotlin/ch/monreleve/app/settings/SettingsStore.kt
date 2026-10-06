package ch.monreleve.app.settings

import android.content.Context

// AN5b increment 1. The device's cache of the person's settings, so Aujourd'hui computes offline
// from the first launch (the settings were also PATCHed to /api/v1/me at onboarding). An interface
// so OnboardingController is JVM-testable against a fake; the SharedPreferences implementation needs
// a device.
//
// NO COORDINATE, NO CREDENTIAL - just the six calculation settings. Persisted (not in-memory) so a
// signed-in user reopening the app lands on a computable Aujourd'hui without a network round trip.

interface SettingsStore {
    /** The cached settings, or null if onboarding has not completed on this device. */
    fun load(): Settings?

    fun save(settings: Settings)

    fun clear()

    /**
     * AN-ONBOARD-2 (R335): onboarded means COMPLETE - every field the releve needs, not merely "some settings
     * exist". Keyed on the ONE completeness definition (ReleveCompleteness.toMeView/isComplete) the server path
     * also uses, so a locally-cached account missing a name (the Q1 case) is sent back to finish onboarding
     * rather than onto Aujourd'hui with a PDF that 422s.
     */
    fun isOnboarded(): Boolean = load()?.toMeView()?.isComplete() ?: false
}

private const val SETTINGS_PREFS = "monreleve.settings"
private const val KEY_CANTON = "canton"
private const val KEY_EMPLOYMENT_RATE = "employmentRate"
private const val KEY_DENOMINATOR_KIND = "denominatorKind"
private const val KEY_EXACT_TOTAL = "exactTotalWorkDays"
private const val KEY_GRANULARITY = "granularity"
private const val KEY_ACTIVITY_START = "activityStartDate"
private const val KEY_NAME = "name"
private const val ABSENT_INT = -1

class SharedPrefsSettingsStore(context: Context) : SettingsStore {
    private val prefs = context.applicationContext.getSharedPreferences(SETTINGS_PREFS, Context.MODE_PRIVATE)

    override fun load(): Settings? {
        val canton = prefs.getString(KEY_CANTON, null)
        val denominatorKind = prefs.getString(KEY_DENOMINATOR_KIND, null)
        val granularity = prefs.getString(KEY_GRANULARITY, null)
        // Any of the three required strings absent means onboarding has not completed here.
        if (canton == null || denominatorKind == null || granularity == null) return null

        val exactTotal = prefs.getInt(KEY_EXACT_TOTAL, ABSENT_INT)
        return Settings(
            canton = canton,
            employmentRate = prefs.getInt(KEY_EMPLOYMENT_RATE, ABSENT_INT),
            denominatorKind = denominatorKind,
            exactTotalWorkDays = if (exactTotal == ABSENT_INT) null else exactTotal,
            granularity = granularity,
            activityStartDate = prefs.getString(KEY_ACTIVITY_START, null),
            name = prefs.getString(KEY_NAME, null),
        )
    }

    override fun save(settings: Settings) {
        prefs.edit()
            .putString(KEY_CANTON, settings.canton)
            .putInt(KEY_EMPLOYMENT_RATE, settings.employmentRate)
            .putString(KEY_DENOMINATOR_KIND, settings.denominatorKind)
            .putInt(KEY_EXACT_TOTAL, settings.exactTotalWorkDays ?: ABSENT_INT)
            .putString(KEY_GRANULARITY, settings.granularity)
            .putString(KEY_ACTIVITY_START, settings.activityStartDate)
            .putString(KEY_NAME, settings.name)
            .commit()
    }

    override fun clear() {
        prefs.edit().clear().commit()
    }
}
