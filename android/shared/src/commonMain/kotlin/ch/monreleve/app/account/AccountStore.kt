package ch.monreleve.app.account

// AN-FIX F4 (R303). The account currently signed in on this device, as an opaque tag (accountTagOf).
// Set at sign-in (CodeController, CallbackController) from the address the person typed or the link carried; read
// at the tap (EntryRepository) to scope the row, at drain (SyncEngine) to send only this account's rows, and on every
// screen to show only this account's rows. Cleared on sign-out alongside the record it scopes.
//
// IOS-2a R768: THE CONTRACT MOVED TO :shared commonMain, because the sign-in controllers that set it moved there. The
// Android implementation and the preference keys it writes stay in :app, in a file renamed after the class it now
// holds (account/SharedPrefsAccountStore.kt - the KMP-3 shape of the settings and dossier stores), where
// OnDeviceFormatGoldenTest reads its keys.
interface AccountStore {
    /** The current account's opaque tag, or null when no account is active. Never UNOWNED. */
    fun current(): String?

    fun setCurrent(tag: String)

    fun clear()
}
