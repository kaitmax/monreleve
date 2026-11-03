package ch.monreleve.app.account

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.convert
import kotlinx.cinterop.reinterpret
import kotlinx.cinterop.usePinned
import platform.CoreCrypto.CC_SHA256
import platform.CoreCrypto.CC_SHA256_DIGEST_LENGTH

// IOS-2a R768. iOS's account tag: the same SHA-256 of the same normalised address as Android's MessageDigest
// (AccountTag.android.kt), computed by CommonCrypto - part of the iOS platform, so no dependency. The opt-in is the
// one KeychainTokenStore and NsDataBytes already carry for a C call, scoped to this function.

private const val HEX_BYTE_MASK = 0xFF
private const val HEX_RADIX = 16

@OptIn(ExperimentalForeignApi::class)
actual fun accountTagOf(email: String): String? {
    val normalised = email.trim().lowercase()
    if (normalised.isEmpty()) return null
    val input = normalised.encodeToByteArray()
    val digest = ByteArray(CC_SHA256_DIGEST_LENGTH)
    input.usePinned { source ->
        digest.usePinned { target ->
            CC_SHA256(source.addressOf(0), input.size.convert(), target.addressOf(0).reinterpret())
        }
    }
    return digest.joinToString("") { (it.toInt() and HEX_BYTE_MASK).toString(HEX_RADIX).padStart(2, '0') }
}
