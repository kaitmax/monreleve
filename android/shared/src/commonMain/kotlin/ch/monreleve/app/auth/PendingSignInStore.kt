package ch.monreleve.app.auth

// AN4 increment 4. The address a sign-in link was requested FOR on this device - the login-CSRF defence: a
// callback whose address does not match the pending request is refused (CallbackController's MISMATCH). Persisted
// (not in-memory) so it survives the process death between requesting the link and the link re-opening the app,
// and kept out of backups: an email is a credential in this product's threat model.
//
// IOS-2a R768: THE CONTRACT MOVED TO :shared commonMain with the controllers that read it. Each platform's store stays
// on its platform: Android's in :app, in a file renamed after the class it now holds
// (auth/SharedPrefsPendingSignInStore.kt, where OnDeviceFormatGoldenTest reads its keys); iOS's
// KeychainPendingSignInStore in iosMain.
interface PendingSignInStore {
    fun remember(email: String)

    fun pending(): String?

    fun clear()
}
