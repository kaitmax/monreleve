package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * AN-SESSION-END (R1181). NO DEVICE STORE THAT BYPASSES THE "SESSION ENDED" SEAM.
 *
 * The seam (auth/SessionEndSeam.kt) sits on the way out of DeviceLocalStore's three scopes, as the SessionEndingStore
 * the one construction hands out. It holds only while nobody builds a DeviceLocalStore - or a SessionEndingStore over
 * some other seam - anywhere else: a second construction is a store whose sign-out wipes the phone and leaves the
 * sampler scheduled, which is A3's N3 again and which no behavioural test of the first store can see. So the fence is
 * on the shape: every construction in the sources a platform's app runs must be in that platform's one file. A list
 * that comes back EMPTY means the construction moved out of sight (R452), not a pass.
 *
 * IOS-MOVE-SEAM R1282 (M1's Q2, iOS Ruling 7): ONE CONSTRUCTION PER PLATFORM. The seam's contract and the wrapper moved
 * to :shared commonMain (R1280), but commonMain does not BUILD the store - it cannot, the stores beneath are each
 * platform's own (the Keystore and SharedPreferences; the Keychain and UserDefaults). Each platform builds it once:
 *   Android  account/DeviceLocalStores.kt  deviceLocalStore(context)     over processSessionEndSeam
 *   iOS      ios/IosLocalStores.kt         iosDeviceLocalStore(...)      over iosSessionEndSeam (R1281)
 * So this fence asserts exactly one site per platform, each over the sources THAT platform compiles. commonMain is in
 * both sets: a construction there would be a second site on BOTH, and fails both. Before this move iosMain was not
 * scanned (its store had no seam to bypass - I0's FINDING 2); now it is, pinned on its one construction's file.
 *
 * Test sources are not scanned: a test builds stores over fakes.
 *
 * IOS-MOVE-TWINS R1242: DeviceLocalStore moved to :shared commonMain (PARK-IF4), which makes it constructible from
 * :shared's commonMain and androidMain - both compiled into the Android process. Before the move neither could see the
 * class, so neither needed scanning; now both are roots, each pinned (R460), so the gate moves with the code (R401).
 */
class SessionEndSeamFenceTest {
    private val commonMain = FenceRoot(File("../shared/src/commonMain/kotlin"), pin = "SharedModule.kt")

    private val androidRoots =
        listOf(
            FenceRoot(File("src/main/kotlin"), pin = "MainActivity.kt"),
            FenceRoot(File("src/debug/kotlin"), pin = "SessionInjectionActivity.kt"),
            commonMain,
            FenceRoot(File("../shared/src/androidMain/kotlin"), pin = "AccountTag.android.kt"),
        )

    /** R1282: the sources the iOS app compiles - commonMain and iosMain, pinned on the iOS construction's own file. */
    private val iosRoots =
        listOf(
            commonMain,
            FenceRoot(File("../shared/src/iosMain/kotlin"), pin = IOS_CONSTRUCTION),
        )

    @Test
    fun theFenceFoundEveryTreeTheAndroidProcessRuns() {
        androidRoots.assertFound(FENCE)
    }

    @Test
    fun theDeviceStoreIsBuiltOnlyInsideTheOneConstruction() {
        androidRoots.assertFound(FENCE)
        assertEquals(
            "$FENCE: DeviceLocalStore must be constructed only in $ONE_CONSTRUCTION, which wraps it in the " +
                "SessionEndingStore - a store built anywhere else clears an account without ending its session " +
                "(the sampler stays scheduled). Ask for deviceLocalStore(context). Sites found:\n" +
                androidRoots.sites(DEVICE_STORE).joinToString("\n"),
            listOf(ONE_CONSTRUCTION),
            androidRoots.sites(DEVICE_STORE).map { it.substringBefore(':') },
        )
    }

    @Test
    fun theSeamStoreIsBuiltOnlyInsideTheOneConstruction() {
        androidRoots.assertFound(FENCE)
        assertEquals(
            "$FENCE: SessionEndingStore must be constructed only in $ONE_CONSTRUCTION, over the process's seam. " +
                "Sites found:\n" + androidRoots.sites(SEAM_STORE).joinToString("\n"),
            listOf(ONE_CONSTRUCTION),
            androidRoots.sites(SEAM_STORE).map { it.substringBefore(':') },
        )
    }

    @Test
    fun theFenceFoundEveryTreeTheIosAppRuns() {
        iosRoots.assertFound(FENCE)
    }

    @Test
    fun onIosTheDeviceStoreIsBuiltOnlyInsideItsOneConstruction() {
        iosRoots.assertFound(FENCE)
        assertEquals(
            "$FENCE (R1282): on iOS, DeviceLocalStore must be constructed only in $IOS_CONSTRUCTION, which wraps it " +
                "in the SessionEndingStore over iosSessionEndSeam - a store built anywhere else clears an account " +
                "and leaves its reminders scheduled (I0's FINDING 2). Ask for iosDeviceLocalStore(...). Sites " +
                "found:\n" + iosRoots.sites(DEVICE_STORE).joinToString("\n"),
            listOf(IOS_CONSTRUCTION),
            iosRoots.sites(DEVICE_STORE).map { it.substringBefore(':') },
        )
    }

    @Test
    fun onIosTheSeamStoreIsBuiltOnlyInsideItsOneConstruction() {
        iosRoots.assertFound(FENCE)
        assertEquals(
            "$FENCE (R1282): on iOS, SessionEndingStore must be constructed only in $IOS_CONSTRUCTION, over the " +
                "iOS seam. Sites found:\n" + iosRoots.sites(SEAM_STORE).joinToString("\n"),
            listOf(IOS_CONSTRUCTION),
            iosRoots.sites(SEAM_STORE).map { it.substringBefore(':') },
        )
    }

    /** "File.kt:line  text" for every construction of [call] outside comments and outside its own declaration. */
    private fun List<FenceRoot>.sites(call: Regex): List<String> =
        ktFiles().flatMap { file ->
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
        const val IOS_CONSTRUCTION = "IosLocalStores.kt"
        const val LINE_SHOWN = 100
        val DEVICE_STORE = Regex("""\bDeviceLocalStore\s*\(""")
        val SEAM_STORE = Regex("""\bSessionEndingStore\s*\(""")

        /** `class DeviceLocalStore(` and `class SessionEndingStore(` declare; they do not construct. */
        val DECLARATION = Regex("""\bclass\s+(DeviceLocalStore|SessionEndingStore)\b""")
    }
}
