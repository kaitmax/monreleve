package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN-CALENDAR (R475). A SETTING IS NEVER CAPTURED WHEN A CONTROLLER OR A remember { } BLOCK IS BUILT.
 *
 * WHAT THIS EXISTS TO STOP, stated as the thing that happened. KMP-4 switched Parametres to Demi-journees and the
 * calendar's sheet kept offering one whole-day slot until the app was restarted (REPORT-KMP-4 NOTICED 1).
 * CalendarController held `private val settings: Settings? = settingsStore.load()` - the settings read ONCE, when
 * the shell built it, and kept for the life of the shell. The same line stood in three more controllers. It is
 * AN-ACCOUNT-TAG's defect (R423) one store over: a value read at construction where a change is the very event
 * the screen must follow. AccountCaptureFenceTest guards the account; this guards the settings.
 *
 * WHAT IS REFUSED: a settings-family read (SETTINGS_READ) that runs once - in a member or top-level initialiser, an
 * init block or a remember block - so that its answer is kept. WHAT IS ALLOWED: a read at use (a function body,
 * a lambda handed over as a provider). SettingsReadScanner decides which is which from the blocks around the read,
 * and its rules and stated limits are pinned by the snippet tests at the bottom of this file.
 *
 * WHERE THE CONTROLLERS LIVE, AND WHY, so the roots are argued rather than assumed (R460). Every controller is in
 * :app today: KMP-3's R446 kept them there - "The controllers do NOT move in this session: whether screens share
 * their state holders is decided with Compose Multiplatform, later." The :shared root is walked anyway, pinned by
 * the contract this fence polices, so the day a controller follows SettingsStore into commonMain it is scanned
 * rather than silently left behind - R452's lesson, taken before the move instead of after it. The debug tree
 * holds SessionInjectionActivity, the one writer of settings outside Parametres while the shell lives.
 */
private const val FENCE = "settings capture fence"

private val settingsCaptureRoots =
    listOf(
        FenceRoot(File("src/main/kotlin/ch/monreleve/app"), pin = "CalendarController.kt"),
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app"), pin = "SettingsStore.kt"),
        FenceRoot(File("src/debug/kotlin/ch/monreleve/app"), pin = "SessionInjection.kt"),
    )

/** A read found in the tree: the file it is in, the line itself, and where it runs. */
private data class TreeRead(val file: File, val read: SettingsRead) {
    val text: String get() = file.readLines()[read.line - 1].trim()

    fun describe(): String = "${file.name}:${read.line}  ${text.take(90)}  <- ${read.site.described}"
}

/**
 * An exemption ARGUES FOR ITSELF and is ASSERTED, never merely listed (R206's corollary). Each names the member it
 * covers, says why keeping a copy is right there, and carries the evidence that the copy is kept current: a
 * pattern that must still match in that file. ParametresController is the settings' ONE writer while the shell
 * lives (onboarding and the /me restore write before the shell exists), so the copies it holds are the values it
 * wrote itself.
 */
private data class Exemption(val file: String, val member: String, val reason: String, val keptCurrentBy: Regex) {
    fun covers(found: TreeRead): Boolean = found.file.name == file && found.read.member == member
}

private val EXEMPT =
    listOf(
        Exemption(
            "ParametresController.kt",
            "savedSettings",
            "Parametres is the settings' one writer in the shell and replaces this copy on every save it makes",
            Regex("""^\s*savedSettings\s*=\s*\w""", RegexOption.MULTILINE),
        ),
        Exemption(
            "ParametresController.kt",
            "mutableState",
            "the first frame of the toggles this controller alone writes; each setter updates the state it shows",
            Regex("""mutableState\.update\s*\{"""),
        ),
    )

private fun treeReads(): List<TreeRead> {
    settingsCaptureRoots.assertFound(FENCE)
    return settingsCaptureRoots.ktFiles().flatMap { file -> settingsReads(file.readText()).map { TreeRead(file, it) } }
}

/** The capture sites [settingsReads] finds in a snippet. */
private fun capturesIn(snippet: String): List<ReadSite> = settingsReads(snippet).map { it.site }.filter { it.capture }

/** Every shape the fence must catch, with where the read runs. Each one is a capture, wherever it is written. */
private val CAPTURE_SHAPES: List<Pair<ReadSite, String>> =
    listOf(
        // The four original lines' shape.
        ReadSite.MEMBER to
            """
            class C(settingsStore: S) {
                private val settings: Settings? = settingsStore.load()
            }
            """.trimIndent(),
        // ParametresController's shape: the read on a continuation line, inside a call with a lambda.
        ReadSite.MEMBER to
            """
            class C(private val store: S) {
                private var saved: Settings =
                    checkNotNull(store.load()) { "x" }
            }
            """.trimIndent(),
        // An if inside an init block still runs at construction.
        ReadSite.INIT to
            """
            class C(private val settingsStore: S) {
                private var g = 0
                init {
                    if (true) {
                        g = settingsStore.load()!!.employmentRate
                    }
                }
            }
            """.trimIndent(),
        ReadSite.REMEMBER to
            """
            @Composable
            fun F(store: S) {
                val s = remember { store.load() }
            }
            """.trimIndent(),
        // Keys before the block, and an inline call inside it.
        ReadSite.REMEMBER to
            """
            @Composable
            fun F(modeStore: M) {
                val s = rememberSaveable(k) { modeStore.load().let { it } }
            }
            """.trimIndent(),
        ReadSite.TOP_LEVEL to "private val cached = SharedPrefsSettingsStore(context).load()",
        // A string whose template holds quotes must not throw the scanner off the code after it.
        ReadSite.MEMBER to
            """
            class C(private val eveningStore: E) {
                fun f() = "${'$'}{listOf("a").joinToString(", ")}"
                private val on = eveningStore.isEnabled()
            }
            """.trimIndent(),
    )

/** Every read the fence must let through: each runs when it is called, however it is nested. */
private val READS_AT_USE: List<String> =
    listOf(
        """
        class C(private val settingsStore: S) {
            fun f() = settingsStore.load()
            fun g() {
                val s = settingsStore.load()
            }
        }
        """.trimIndent(),
        // A provider - the account's correct shape (R423), applied to a setting.
        """
        class C(private val settingsStore: S) {
            private val current: () -> Settings? = { settingsStore.load() }
        }
        """.trimIndent(),
        // A collector launched from init runs later, on each emission.
        """
        class C(private val settingsStore: S) {
            init {
                scope.launch { flow.collect { settingsStore.load() } }
            }
        }
        """.trimIndent(),
        // A provider built inside remember: the read happens when it is called.
        """
        @Composable
        fun F(store: S) {
            val holder = remember { Holder { store.load() } }
        }
        """.trimIndent(),
        // `::class` is a reference, not a class body.
        """
        class C {
            val k = Foo::class
            fun f() {
                val s = settingsStore.load()
            }
        }
        """.trimIndent(),
        // A class with no body must not lend its header to the next block.
        """
        data class D(val a: Int)

        fun f() {
            val s = settingsStore.load()
        }
        """.trimIndent(),
        // Comments and strings are not code.
        """
        class C {
            // private val settings = settingsStore.load()
            val t = "settingsStore.load()"
        }
        """.trimIndent(),
        // Credentials are not settings: SessionManager reads them per request.
        """
        class C(private val tokenStore: T) {
            private val pair = tokenStore.load()
        }
        """.trimIndent(),
    )

class SettingsCaptureFenceTest {
    @Test
    fun theWalkReachesEachTreeEachNamedByAFileOnlyItCanHold() {
        settingsCaptureRoots.assertFound(FENCE)
    }

    @Test
    fun theScanSeesRealSettingsReadsAndTellsTheTwoKindsApart() {
        // R133/R169: an absence is evidence only beside a presence. These are reads AT USE that exist in the tree
        // today - if the pattern or the scanner stopped seeing reads, this fails rather than the fence passing over
        // nothing.
        val atUse = treeReads().filter { it.read.site == ReadSite.AT_USE }.map { it.file.name to it.text }
        val expected =
            listOf(
                "AujourdhuiController.kt" to "val mode = detectionModeStore.load()",
                "EveningNotifier.kt" to "val settings = SharedPrefsSettingsStore(context).load() ?: return",
                "MainActivity.kt" to "val settings = store.load()",
            )
        for (known in expected) {
            assertTrue("$FENCE: the scan no longer sees the read at use $known", known in atUse)
        }
    }

    @Test
    fun noSettingIsCapturedWhenAControllerOrARememberBlockIsBuilt() {
        val offences = treeReads().filter { found -> found.read.site.capture && EXEMPT.none { it.covers(found) } }
        assertEquals(
            "a setting read ONCE and kept is a setting the screen cannot follow - KMP-4's calendar kept offering " +
                "whole days after Parametres switched to half-days, until a restart. Read it where it is used " +
                "(R475): hold the store, call load() when the value is needed.",
            emptyList<String>(),
            offences.map { it.describe() },
        )
    }

    @Test
    fun eachExemptionArguesForItselfAndIsStillNeeded() {
        val reads = treeReads()
        assertEquals("the exemption list grew; a new entry must survive its own argument (R206)", 2, EXEMPT.size)
        for (exemption in EXEMPT) {
            assertTrue("$exemption gives no reason", exemption.reason.length > 40)
            val covered = reads.filter { exemption.covers(it) && it.read.site.capture }
            assertTrue(
                "$exemption covers no capture any more - remove it rather than keep a dead exemption",
                covered.isNotEmpty(),
            )
            assertTrue(
                "$exemption: nothing keeps that copy current any more",
                exemption.keptCurrentBy.containsMatchIn(covered.first().file.readText()),
            )
        }
    }

    @Test
    fun eachCaptureShapeIsCaughtWhereverItIsWritten() {
        for ((site, snippet) in CAPTURE_SHAPES) {
            assertEquals("the shape was not caught:\n$snippet", listOf(site), capturesIn(snippet))
        }
    }

    @Test
    fun aReadAtUseIsLetThroughHoweverItIsNested() {
        for (snippet in READS_AT_USE) {
            assertEquals("a read at use was called a capture:\n$snippet", emptyList<ReadSite>(), capturesIn(snippet))
        }
    }
}
