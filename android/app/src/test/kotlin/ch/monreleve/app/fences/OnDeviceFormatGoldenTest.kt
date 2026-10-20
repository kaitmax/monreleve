package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * KMP-3 (R448). THE ON-DEVICE FORMATS, PINNED TO WHAT A PHONE ACTUALLY HOLDS.
 *
 * WHAT THE MOVE PUTS AT RISK. KMP-3 lifts the session, the sync engine and three storage
 * INTERFACES into :shared while every Android implementation - the Keystore token store and
 * the three SharedPreferences stores - stays in :app. The promise that has to survive is not
 * about compilation: it is that somebody who installs the next build is still signed in, still
 * has their settings, and still sees their cached releve with no network. Every one of those
 * three facts is a key name in a file on a phone.
 *
 * SO THE GOLDEN WAS READ OFF A PHONE, NOT WRITTEN FROM THE SOURCE. src/test/resources/
 * on-device-formats.txt was captured from a Samsung S9 carrying a signed-in account, six saved
 * settings, two cached dossier years and one pending day, BEFORE anything moved. This test
 * then derives the key set from each store's OWN source constants and compares the two, so a
 * renamed constant fails HERE rather than on somebody's phone (R181: the check derives what it
 * asserts instead of transcribing it beside the thing it describes).
 *
 * IT IS NOT A SUBSTITUTE FOR THE DEVICE COMPARISON, and says so rather than implying coverage
 * it does not have: the actual proof is the same six files pulled again after the move and
 * compared, which is REPORT-KMP-3's R448 section. This is the guard that keeps the next task
 * from breaking it without a phone attached.
 *
 * THE VALUES ARE NOT HERE. The ciphertext, the IV, the account digest and the dossier bodies
 * were captured and deliberately left out of the fixture: this records a FORMAT, and a
 * credential is not part of a format (R448 says never a real token).
 */
class OnDeviceFormatGoldenTest {
    private val golden: List<Triple<String, String, String>> =
        checkNotNull(javaClass.classLoader)
            .getResourceAsStream("on-device-formats.txt")
            .use { stream ->
                checkNotNull(stream) { "on-device-formats.txt is not on the test classpath" }
                    .readBytes()
                    .decodeToString()
            }
            .lineSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("#") }
            .map { line ->
                val parts = line.split(Regex("\\s+"), limit = 3)
                Triple(parts[0], parts[1], parts.getOrElse(2) { "" })
            }
            .toList()

    private fun goldenKeysOf(prefsFile: String): Set<String> =
        golden.filter { it.first == prefsFile }.map { it.second }.toSet()

    /** The string literals assigned to private const val ... in one source file. */
    private fun constantsIn(path: String): Set<String> {
        val file = File(path)
        assertTrue("the golden's subject does not exist: $path", file.isFile)
        return CONST_STRING
            .findAll(file.readText())
            .map { it.groupValues[1] }
            .toSet()
    }

    @Test
    fun `the fixture was read and is not empty`() {
        // R133/R169: a golden read from an empty or missing resource makes every comparison
        // below vacuously true. "All of nothing matches" is the pass this file exists to refuse.
        assertTrue("the golden fixture parsed to nothing", golden.size >= MIN_GOLDEN_ROWS)
        assertTrue(
            "the golden must name the token blob - the one key whose loss signs everybody out",
            golden.any { it.first == "monreleve.auth" && it.second == "token.blob" },
        )
    }

    @Test
    fun `the token store still writes the two keys the phone holds, under the same prefs file`() {
        val constants = constantsIn("src/main/kotlin/ch/monreleve/app/auth/KeystoreTokenStore.kt")

        assertTrue("the prefs FILE name moved: a renamed file is an empty file", constants.contains("monreleve.auth"))
        assertEquals(
            "KeystoreTokenStore's keys no longer match what a phone in the field holds. " +
                "Renaming one signs every existing install out at the next launch.",
            goldenKeysOf("monreleve.auth"),
            constants.filter { it.startsWith("token.") }.toSet(),
        )
    }

    @Test
    fun `the token plaintext still carries exactly the four fields the phone's blob decodes to`() {
        val source = File("src/main/kotlin/ch/monreleve/app/auth/KeystoreTokenStore.kt").readText()

        // Both directions, because one alone is satisfied by a store that writes nothing (R196):
        // every golden field is still put() on encode AND still getString() on decode.
        for ((_, field, _) in golden.filter { it.first == "tokenPlaintext" }) {
            assertTrue(
                "the encrypted token JSON no longer WRITES $field - an older blob would decode short",
                source.contains("\"$field\""),
            )
        }
        assertEquals(
            "the token plaintext gained or lost a field. A blob written by the previous build " +
                "is decoded by getString() on each of these, so a new REQUIRED field makes every " +
                "stored session unreadable and signs the person out.",
            golden.count { it.first == "tokenPlaintext" },
            JSON_GET_STRING.findAll(source).count(),
        )
    }

    @Test
    fun `the settings store still writes exactly the keys the phone holds`() {
        val constants = constantsIn("src/main/kotlin/ch/monreleve/app/settings/SettingsStore.kt")

        assertTrue("the settings prefs FILE name moved", constants.contains("monreleve.settings"))
        assertEquals(
            "SharedPrefsSettingsStore's key set no longer matches the phone's. A renamed key " +
                "reads back absent, and an absent canton sends a fully onboarded person back " +
                "through onboarding.",
            goldenKeysOf("monreleve.settings"),
            constants.filter { it != "monreleve.settings" }.toSet(),
        )
    }

    @Test
    fun `the account and pending stores still write the keys the phone holds`() {
        val account = constantsIn("src/main/kotlin/ch/monreleve/app/account/AccountStore.kt")
        val pending = constantsIn("src/main/kotlin/ch/monreleve/app/auth/PendingSignInStore.kt")

        assertTrue("the account prefs FILE name moved", account.contains("monreleve.account"))
        assertEquals(goldenKeysOf("monreleve.account"), account.filter { it != "monreleve.account" }.toSet())
        assertTrue("the pending prefs FILE name moved", pending.contains("monreleve.pending"))
        assertEquals(goldenKeysOf("monreleve.pending"), pending.filter { it != "monreleve.pending" }.toSet())
    }

    @Test
    fun `the dossier cache still writes one key per year, in the phone's format`() {
        val source = File("src/main/kotlin/ch/monreleve/app/data/local/DossierCache.kt").readText()

        assertTrue("the dossier prefs FILE name moved", source.contains("\"monreleve.dossier\""))
        // The golden records the key as dossier.<year>; the source builds it by interpolation,
        // so the derived form is the literal prefix with the year appended.
        assertTrue(
            "the cached-dossier key format moved. The offline copy is read by this exact key, " +
                "so a change hides every already-cached year behind a blank screen.",
            source.contains("\"dossier.\$year\""),
        )
    }

    private companion object {
        /** A golden this short means the fixture was truncated, not that the product shrank. */
        const val MIN_GOLDEN_ROWS = 12

        /** `private const val NAME = "value"` - the string literal only. */
        val CONST_STRING = Regex("""const\s+val\s+\w+\s*(?::\s*String\s*)?=\s*"([^"]+)"""")

        /** `json.getString("...")` - how the stored blob is read back. */
        val JSON_GET_STRING = Regex("""json\.getString\("[^"]+"\)""")
    }
}
