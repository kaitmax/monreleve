package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * AN-SESSION-END (R1181). NO DEVICE STORE THAT BYPASSES THE "SESSION ENDED" SEAM.
 *
 * The seam (auth/SessionEndSeam.kt) sits on the way out of DeviceLocalStore's three scopes, as the SessionEndingStore
 * the one construction (account/DeviceLocalStores.kt) hands out. It holds only while nobody builds a DeviceLocalStore -
 * or a SessionEndingStore over some other seam - anywhere else: a second construction is a store whose sign-out wipes
 * the phone and leaves the sampler scheduled, which is A3's N3 again and which no behavioural test of the first store
 * can see. So the fence is on the shape: every construction in the sources the Android process runs must be in that
 * one file. A list that comes back EMPTY means the construction moved out of sight (R452), not a pass.
 *
 * iosMain is not scanned: the iOS composition builds its own DeviceLocalStore (ios/IosLocalStores.kt) on a
 * platform with no sampler, and A8/A7's attachments are Android's. Test sources are not scanned: a test builds
 * stores over fakes.
 *
 * IOS-MOVE-TWINS R1242: DeviceLocalStore moved to :shared commonMain (PARK-IF4), which makes it constructible from
 * :shared's commonMain and androidMain - both compiled into the Android process. Before the move neither could see the
 * class, so neither needed scanning; now both are roots, each pinned (R460), so the gate moves with the code (R401).
 */
class SessionEndSeamFenceTest {
    private val roots =
        listOf(
            FenceRoot(File("src/main/kotlin"), pin = "MainActivity.kt"),
            FenceRoot(File("src/debug/kotlin"), pin = "SessionInjectionActivity.kt"),
            FenceRoot(File("../shared/src/commonMain/kotlin"), pin = "SharedModule.kt"),
            FenceRoot(File("../shared/src/androidMain/kotlin"), pin = "AccountTag.android.kt"),
        )

    @Test
    fun theFenceFoundEveryTreeTheAndroidProcessRuns() {
        roots.assertFound(FENCE)
    }

    @Test
    fun theDeviceStoreIsBuiltOnlyInsideTheOneConstruction() {
        roots.assertFound(FENCE)
        assertEquals(
            "$FENCE: DeviceLocalStore must be constructed only in $ONE_CONSTRUCTION, which wraps it in the " +
                "SessionEndingStore - a store built anywhere else clears an account without ending its session " +
                "(the sampler stays scheduled). Ask for deviceLocalStore(context). Sites found:\n" +
                sites(DEVICE_STORE).joinToString("\n"),
            listOf(ONE_CONSTRUCTION),
            sites(DEVICE_STORE).map { it.substringBefore(':') },
        )
    }

    @Test
    fun theSeamStoreIsBuiltOnlyInsideTheOneConstruction() {
        roots.assertFound(FENCE)
        assertEquals(
            "$FENCE: SessionEndingStore must be constructed only in $ONE_CONSTRUCTION, over the process's seam. " +
                "Sites found:\n" + sites(SEAM_STORE).joinToString("\n"),
            listOf(ONE_CONSTRUCTION),
            sites(SEAM_STORE).map { it.substringBefore(':') },
        )
    }

    /** "File.kt:line  text" for every construction of [call] outside comments and outside its own declaration. */
    private fun sites(call: Regex): List<String> =
        roots.ktFiles().flatMap { file ->
            file.readLines().mapIndexedNotNull { index, raw ->
                val line = raw.trim()
                val isComment = line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")
                if (!isComment && !DECLARATION.containsMatchIn(line) && call.containsMatchIn(line)) {
                    "${file.name}:${index + 1}  ${line.take(LINE_SHOWN)}"
                } else {
                    null
                }
            }
        }

    private companion object {
        const val FENCE = "R1181 one session-end seam"
        const val ONE_CONSTRUCTION = "DeviceLocalStores.kt"
        const val LINE_SHOWN = 100
        val DEVICE_STORE = Regex("""\bDeviceLocalStore\s*\(""")
        val SEAM_STORE = Regex("""\bSessionEndingStore\s*\(""")

        /** `class DeviceLocalStore(` and `class SessionEndingStore(` declare; they do not construct. */
        val DECLARATION = Regex("""\bclass\s+(DeviceLocalStore|SessionEndingStore)\b""")
    }
}
