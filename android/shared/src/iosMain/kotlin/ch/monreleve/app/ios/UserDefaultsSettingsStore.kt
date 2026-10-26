package ch.monreleve.app.ios

import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import platform.Foundation.NSUserDefaults

// IOS-1a R566. THE iOS SettingsStore, over NSUserDefaults, as ONE KEY holding ONE JSON value.
//
// WHY ONE KEY AND NOT ONE KEY PER FIELD (Android's SharedPrefsSettingsStore has seven). SettingsStore.save is
// "replaces the whole set ... two half-saves racing would otherwise leave a canton from one and a rate from
// another". NSUserDefaults has no multi-key transaction; setObject:forKey: on one key is atomic. So the whole
// set is one encoded string, and a reader sees the old set or the new, never a mixture.
//
// ABSENT AND NULL STAY DIFFERENT FROM A VALUE, as the contract demands: a null exactTotalWorkDays (the simplified
// basis) and a null activityStartDate (the whole year) are JSON nulls, and load returns null for each - never a
// zero, an empty string or a default date. Like Android's store, it persists the six calculation settings and the
// name, and nothing else: loggingMode and detectionConsent are not stored on either platform.
//
// load returns null until a COMPLETE set was saved: no value, a value that does not decode, or one missing
// canton, denominatorKind or granularity (the three with no default) all read as "not onboarded". isOnboarded is
// inherited from the interface and is NOT overridden (R335). clear removes the key; on an empty store it is a
// no-op. No coordinate, no credential: the stored class has exactly the seven fields.

private const val SETTINGS_KEY = "ch.monreleve.app.settings.v1"

// The three fields with no sensible default (canton, denominatorKind, granularity) and the rate are REQUIRED in
// the stored form: a stored value missing one does not decode, and a value that does not decode reads as null.
@Suppress("LongParameterList")
@Serializable
private class StoredSettings(
    val canton: String,
    val employmentRate: Int,
    val denominatorKind: String,
    val exactTotalWorkDays: Int? = null,
    val granularity: String,
    val activityStartDate: String? = null,
    val name: String? = null,
)

class UserDefaultsSettingsStore(
    private val defaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
    private val key: String = SETTINGS_KEY,
) : SettingsStore {
    override fun load(): Settings? {
        val stored =
            defaults.stringForKey(key)?.let { text ->
                runCatching { Json.decodeFromString(StoredSettings.serializer(), text) }.getOrNull()
            } ?: return null
        return Settings(
            canton = stored.canton,
            employmentRate = stored.employmentRate,
            denominatorKind = stored.denominatorKind,
            exactTotalWorkDays = stored.exactTotalWorkDays,
            granularity = stored.granularity,
            activityStartDate = stored.activityStartDate,
            name = stored.name,
        )
    }

    override fun save(settings: Settings) {
        val stored =
            StoredSettings(
                canton = settings.canton,
                employmentRate = settings.employmentRate,
                denominatorKind = settings.denominatorKind,
                exactTotalWorkDays = settings.exactTotalWorkDays,
                granularity = settings.granularity,
                activityStartDate = settings.activityStartDate,
                name = settings.name,
            )
        defaults.setObject(Json.encodeToString(StoredSettings.serializer(), stored), forKey = key)
    }

    override fun clear() {
        defaults.removeObjectForKey(key)
    }
}
