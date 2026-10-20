package ch.monreleve.app.settings

import android.content.Context

// AN5b increment 1. The Android implementation of SettingsStore, whose contract moved to
// :shared commonMain in KMP-3 (R446/R447).
//
// NOTHING HERE CHANGED IN THE MOVE, and the keys below are why that matters: they are the
// file a person's phone already holds. monreleve.settings, these seven key names, and the
// two different ways a null is written are what an upgrade in place reads back.
//
// THE TWO NULLS, because they are not stored alike and a reader of the contract alone would
// not guess it. SharedPreferences' putString(key, null) REMOVES the key, so a null
// activityStartDate or name is simply ABSENT from the file. An Int has no such form, so a
// null exactTotalWorkDays is PRESENT as the sentinel -1. Both read back as null, which is
// what the contract requires; this is one platform's way of meeting it, not the rule.
//
// commit(), not apply(), inherited unchanged from AN5b: a settings save is immediately
// followed by a navigation decision that reads it back.
//
// OnDeviceFormatGoldenTest pins this key set against what was read off a running phone
// before anything moved (R448).

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
