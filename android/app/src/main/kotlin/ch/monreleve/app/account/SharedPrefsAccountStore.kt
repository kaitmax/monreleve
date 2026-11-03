package ch.monreleve.app.account

import android.content.Context

// AN-FIX F4 (R303). The account currently signed in on this device, as an opaque tag (AccountTag).
// Set at the magic-link callback (CallbackController) from the address the link carried; read at the
// tap (EntryRepository) to scope the row, at drain (SyncWorker -> SyncEngine) to send only this
// account's rows, and on every screen (the controllers, through the repository) to show only this
// account's rows. An interface so those are JVM-testable against a fake; the SharedPreferences
// implementation needs a device.
//
// Cleared on sign-out (DeviceLocalStore, R295) alongside the record it scopes, and excluded from
// backup (res/xml backup rules) like the token and pending stores - though the tag is already an
// opaque SHA-256 digest, never the address.
//
// IOS-2a R768: the AccountStore CONTRACT moved to :shared commonMain (account/AccountStore.kt there), with the
// sign-in controllers that set it. This file keeps the Android implementation and its keys, renamed after its class
// (was account/AccountStore.kt; OnDeviceFormatGoldenTest reads the keys here).

private const val ACCOUNT_PREFS = "monreleve.account"
private const val KEY_TAG = "tag"

class SharedPrefsAccountStore(context: Context) : AccountStore {
    private val prefs = context.applicationContext.getSharedPreferences(ACCOUNT_PREFS, Context.MODE_PRIVATE)

    override fun current(): String? = prefs.getString(KEY_TAG, null)

    override fun setCurrent(tag: String) {
        prefs.edit().putString(KEY_TAG, tag).commit()
    }

    override fun clear() {
        prefs.edit().remove(KEY_TAG).commit()
    }
}
