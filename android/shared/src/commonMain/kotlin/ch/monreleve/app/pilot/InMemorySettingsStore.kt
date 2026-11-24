package ch.monreleve.app.pilot

import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore

// IOS-POLISH R1399. Cut verbatim from PilotFixture.kt, which left commonMain for the test source sets: this fake STAYS
// in commonMain because :app's unit tests use it and cannot see :shared's commonTest. It therefore ships in the Release
// framework (REPORT-IOS-POLISH.txt R1404 names the test-fixtures mechanism that would end that).

/** Settings held in memory: the pilot's one frontalier, Geneva, full time, the simplified 240-day year. */
class InMemorySettingsStore(private var settings: Settings?) : SettingsStore {
    override fun load(): Settings? = settings

    override fun save(settings: Settings) {
        this.settings = settings
    }

    override fun clear() {
        settings = null
    }
}
