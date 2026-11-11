package ch.monreleve.app.account

// AN12 increment 2 (R295) and increment 3 (R289). The ONE seam through which the device's account data is cleared - on
// sign-out and on deletion - so the two scopes cannot drift apart. IOS-2e R828: the interface moved here from :app's
// account/LocalStore.kt, unchanged; Android's implementation, DeviceLocalStore, stays in :app (it clears Room, the
// Keystore tokens, WorkManager's queue and the exports directory - each through a seam the app supplies).

interface LocalStore {
    /**
     * R295 + R297: sign-out clears the record, the cache, the tokens, any queued sync, the exported files AND
     * the settings. The pending sign-in is kept (it is not account data; deletion clears it).
     */
    suspend fun clearForSignOut()

    /** R289: deletion clears the sign-out set PLUS the pending sign-in - a first-run state. */
    suspend fun clearForDeletion()
}
