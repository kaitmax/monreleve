package ch.monreleve.app.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import org.json.JSONObject
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// AN4 increment 2. Token storage at rest.
//
// NOT EncryptedSharedPreferences: androidx.security:security-crypto was DEPRECATED
// in April 2025 (1.1.0-alpha07) over main-thread StrictMode violations and keyset
// corruption on some OEMs, and the relay forbids building on a deprecated API.
// SPEC 10 NAMES EncryptedSharedPreferences, so SPEC's mechanism is out of date
// (the same shape as R209's Auth.js line) - see REPORT-AN4.txt DEVIATIONS. This
// uses the platform Android Keystore directly (R136), which delivers SPEC 10's
// actual requirement - "stored in Keystore-backed storage" - with no new
// dependency: an AES-256-GCM key that never leaves the Keystore, the pair
// serialised to JSON, encrypted, and the ciphertext + a fresh per-save IV kept in
// an ordinary SharedPreferences (excluded from backup, see the manifest rules).
//
// setUserAuthenticationRequired(false): silent refresh must work while the phone
// is locked, so the key is not gated on a device unlock.
//
// An unreadable stored blob - an invalidated key, a corrupted ciphertext - is not
// a crash: load() drops the pair and returns null, and the caller signs in again.
// The local mirror of the server's `unknown_token` "corrupted stored token" case.

private const val ANDROID_KEYSTORE = "AndroidKeyStore"
private const val KEY_ALIAS = "ch.monreleve.app.auth.tokenKey"
private const val PREFS_NAME = "monreleve.auth"
private const val PREF_IV = "token.iv"
private const val PREF_BLOB = "token.blob"
private const val TRANSFORMATION = "AES/GCM/NoPadding"
private const val KEY_SIZE_BITS = 256
private const val GCM_TAG_BITS = 128

class KeystoreTokenStore(context: Context) : TokenStore {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override fun save(pair: TokenPair) {
        val plain =
            JSONObject()
                .put("accessToken", pair.accessToken)
                .put("refreshToken", pair.refreshToken)
                .put("accessExpiresAt", pair.accessExpiresAt)
                .put("refreshExpiresAt", pair.refreshExpiresAt)
                .toString()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        prefs
            .edit()
            .putString(PREF_IV, Base64.getEncoder().encodeToString(iv))
            .putString(PREF_BLOB, Base64.getEncoder().encodeToString(ciphertext))
            .commit()
    }

    override fun load(): TokenPair? {
        val ivB64 = prefs.getString(PREF_IV, null)
        val blobB64 = prefs.getString(PREF_BLOB, null)
        if (ivB64 == null || blobB64 == null) return null
        // runCatching, not a broad catch clause: any failure to read the stored
        // bytes (KeyPermanentlyInvalidated, AEADBadTag, malformed JSON or Base64)
        // means the session is unreadable, so drop it and return null.
        return runCatching { decrypt(ivB64, blobB64) }.getOrElse {
            clear()
            null
        }
    }

    override fun clear() {
        prefs.edit().remove(PREF_IV).remove(PREF_BLOB).commit()
    }

    private fun decrypt(
        ivB64: String,
        blobB64: String,
    ): TokenPair {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry
        val iv = Base64.getDecoder().decode(ivB64)
        val ciphertext = Base64.getDecoder().decode(blobB64)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, entry.secretKey, GCMParameterSpec(GCM_TAG_BITS, iv))
        val json = JSONObject(String(cipher.doFinal(ciphertext), Charsets.UTF_8))
        return TokenPair(
            accessToken = json.getString("accessToken"),
            refreshToken = json.getString("refreshToken"),
            accessExpiresAt = json.getString("accessExpiresAt"),
            refreshExpiresAt = json.getString("refreshExpiresAt"),
        )
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec
                .Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(KEY_SIZE_BITS)
                .setUserAuthenticationRequired(false)
                .build(),
        )
        return generator.generateKey()
    }
}
