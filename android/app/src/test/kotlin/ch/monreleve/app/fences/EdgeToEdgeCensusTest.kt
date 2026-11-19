package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN-EDGE-INSETS (R1171). EVERY SCREEN IS HOSTED BY THE ONE ROOT WRAPPER THAT HANDLES THE SYSTEM BARS.
 *
 * WHAT THIS EXISTS TO STOP, as the thing that happened (REPORT-AN-API36-PASS N1, Android Ruling 8): targetSdk 36
 * forces edge-to-edge on Android 15+, and only the screens inside MainShell's Scaffold respected the system bars. On
 * the welcome screen, sign-in, every onboarding step, the detection disclosure, Prevision and Comparaison the main
 * button sat under the navigation bar - with 3-button navigation a tap on Prevision's button opened Recents. Nothing
 * failed, because nothing asked: the S9 (API 29) never draws behind its bars, and no gate runs a device.
 *
 * THE RULE (R1170): the system-bar insets are applied ONCE, by [WRAPPER] (ui/shell/AppRoot.kt), at the composition
 * root of every activity the app ships - and consumed there, so a Scaffold or NavigationBar beneath it adds nothing.
 *
 * DISCOVERY, NOT A TYPED LIST (R246). Both subjects are read from their sources of truth:
 *   - THE ROOTS: every <activity> the MAIN manifest declares (the activities a shipped APK can open). Each one's
 *     `setContent { ... }` must consist of exactly one `AppRoot { ... }`.
 *   - THE SCREENS: every top-level, non-private `fun <Name>Screen(` under the two ui/ roots (:shared commonMain and
 *     :app main). A screen added tomorrow is in the census on the day it is written.
 * A screen is HOSTED when it has at least one call site in the shipped sources and EVERY call site is either in a
 * wrapped activity's file, or inside the body of another discovered screen that is itself hosted (LicencesScreen
 * inside ParametresScreen). An :app overload delegating to its :shared namesake (OnboardingScreen, ParametresScreen)
 * is a call of the same name from inside itself and proves nothing either way, so it is not counted.
 *
 * WHAT IT CANNOT SEE, stated rather than implied: it is a lexical scan, not a compiler. A top-level function in a
 * wrapped activity's file that some OTHER file calls from outside the wrapper would read as hosted; a screen invoked
 * through a function reference is not a call site it recognises. The runtime halves are AppRootScreenshotTest, which
 * measures the padding and its consumption (R154), and the emulator proof in REPORT-AN-EDGE-INSETS (R1173).
 *
 * dev/ IS OUT OF SCOPE, and the reason is asserted rather than assumed: its activities are declared only in
 * src/debug/AndroidManifest.xml, and checkReleaseNoDevComponent proves the release APK holds none of them.
 */

private const val WRAPPER = "AppRoot"
private const val WRAPPER_FILE = "src/main/kotlin/ch/monreleve/app/ui/shell/AppRoot.kt"
private const val MAIN_MANIFEST = "src/main/AndroidManifest.xml"
private const val APP_PACKAGE = "ch.monreleve.app"
private const val APP_KOTLIN = "src/main/kotlin"
private const val DEV_DIR = "src/main/kotlin/ch/monreleve/app/dev"
private const val DEV_EXCLUSION_REASON =
    "dev/ activities are declared only in src/debug/AndroidManifest.xml (AN14a F1), and checkReleaseNoDevComponent " +
        "proves the built release APK declares no ch.monreleve.app.dev.* component - no shipped destination is there"
private const val FENCE = "EdgeToEdgeCensusTest"

private val SCREEN_ROOTS =
    listOf(
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app/ui"), pin = "WelcomeScreen.kt"),
        FenceRoot(File("src/main/kotlin/ch/monreleve/app/ui"), pin = "ResolvingScreen.kt"),
    )

// The shipped sources a call site can live in. dev/ is filtered out of the first, with DEV_EXCLUSION_REASON.
private val SHIPPED_ROOTS =
    listOf(
        FenceRoot(File(APP_KOTLIN), pin = "MainActivity.kt"),
        FenceRoot(File("../shared/src/commonMain/kotlin"), pin = "SharedModule.kt"),
    )

// The modifiers, parameters and window calls through which a site would handle the system bars itself.
private val INSET_HANDLING =
    Regex(
        """\b(windowInsetsPadding|systemBarsPadding|safeDrawingPadding|safeContentPadding|safeGesturesPadding|""" +
            """navigationBarsPadding|statusBarsPadding|displayCutoutPadding|consumeWindowInsets|""" +
            """contentWindowInsets|fitsSystemWindows|setDecorFitsSystemWindows|enableEdgeToEdge)\b""",
    )

// Top-level (column 0) and not private: a private helper is part of the screen that declares it.
private val SCREEN_DECLARATION =
    Regex("""^(?:(?:public|internal)\s+)?fun\s+([A-Z]\w*Screen)\s*\(""", RegexOption.MULTILINE)

private val FUNCTION_DECLARATION = Regex("""\bfun\s+(?:<[^>]*>\s*)?([A-Za-z_]\w*)\s*\(""")

private class Source(
    val file: File,
) {
    val text: String = file.readText()

    // Comments and string contents blanked, same length, so offsets and line numbers still hold.
    val code: String = blankCommentsAndStrings(text)

    val label: String = file.invariantSeparatorsPath.substringAfterLast("android/").removePrefix("../")

    val isShared: Boolean = "/shared/src/commonMain/" in file.canonicalFile.invariantSeparatorsPath

    fun lineOf(offset: Int): Int = text.substring(0, offset).count { it == '\n' } + 1

    /** (name, body open, body close) of every function with a brace body, in source order. */
    val functions: List<Triple<String, Int, Int>> by lazy {
        FUNCTION_DECLARATION.findAll(code).mapNotNull { m ->
            val paramsClose = closingBracket(code, m.range.last, '(', ')')
            val bodyStart = code.indexOfAny(charArrayOf('{', '='), paramsClose + 1)
            if (bodyStart < 0 || code[bodyStart] == '=') return@mapNotNull null
            Triple(m.groupValues[1], bodyStart, closingBracket(code, bodyStart))
        }.toList()
    }

    /** The functions whose body holds [offset], outermost first. */
    fun enclosing(offset: Int): List<String> =
        functions.filter { (_, open, close) -> offset in open..close }.sortedBy { it.second }.map { it.first }
}

private class CallSite(
    val source: Source,
    val offset: Int,
    // The discovered screen whose body holds this call, or null when it sits in no screen.
    val enclosingScreen: String?,
    // The outermost function holding this call when NO Android shipped source calls that function - iOS's own
    // host (pilot/AujourdhuiPilot, called only from iosMain) - so this call is not an Android destination.
    val offAndroidHost: String? = null,
) {
    override fun toString(): String = "${source.label}:${source.lineOf(offset)}"
}

class EdgeToEdgeCensusTest {
    private fun shippedSources(): List<Source> {
        SHIPPED_ROOTS.assertFound("$FENCE (shipped sources)")
        val dev = File(DEV_DIR)
        assertTrue("$FENCE: the dev/ exclusion must state its reason", DEV_EXCLUSION_REASON.length > 40)
        assertTrue(
            "$FENCE: dev/ is excluded by name but is not there (looked in ${dev.absolutePath}) - an exclusion " +
                "of nothing is a stale instruction (R181); remove it or repoint it",
            dev.isDirectory,
        )
        val devPrefix = dev.canonicalPath + File.separator
        return SHIPPED_ROOTS.ktFiles().filterNot { it.canonicalPath.startsWith(devPrefix) }.map(::Source)
    }

    /** The activity classes the MAIN manifest declares, each with its source file. */
    private fun manifestActivities(): List<Pair<String, Source>> {
        val manifest = subjectFile(FENCE, MAIN_MANIFEST).readText()
        val withoutComments = manifest.replace(Regex("<!--.*?-->", RegexOption.DOT_MATCHES_ALL), "")
        val names =
            Regex("""<activity\s[^>]*?android:name="([^"]+)"""", RegexOption.DOT_MATCHES_ALL)
                .findAll(withoutComments)
                .map { it.groupValues[1] }
                .toList()
        assertTrue(
            "$FENCE: the main manifest declares no MainActivity - the parse found $names, so it is reading the " +
                "wrong file or the wrong shape (R460 positive control)",
            names.any { it.endsWith("MainActivity") },
        )
        return names.map { name ->
            val qualified = if (name.startsWith(".")) APP_PACKAGE + name else name
            name to Source(subjectFile(FENCE, "$APP_KOTLIN/${qualified.replace('.', '/')}.kt"))
        }
    }

    /** null when every `setContent { }` in [source] is exactly one `AppRoot { }`; otherwise why it is not. */
    private fun rootDefect(source: Source): String? {
        val code = source.code
        val opens = Regex("""\bsetContent\s*\{""").findAll(code).map { it.range.last }.toList()
        val defects =
            opens.mapNotNull { open ->
                val body = code.substring(open + 1, closingBracket(code, open)).trim()
                val line = source.lineOf(open)
                val head = Regex("""^$WRAPPER\s*(\([^()]*\))?\s*\{""").find(body)
                when {
                    head == null -> {
                        val first = body.takeWhile { it != '{' && it != '(' && !it.isWhitespace() }
                        "setContent at line $line opens with `$first`, not `$WRAPPER { }`"
                    }
                    body.substring(closingBracket(body, head.range.last) + 1).isNotBlank() ->
                        "setContent at line $line draws something beside `$WRAPPER { }`, outside it"
                    else -> null
                }
            }
        val none = "declares no setContent { } - a screen this census cannot see"
        return if (opens.isEmpty()) none else defects.firstOrNull()
    }

    private fun screens(): Set<String> {
        SCREEN_ROOTS.assertFound("$FENCE (screens)")
        val declared =
            SCREEN_ROOTS.ktFiles().flatMap { file ->
                SCREEN_DECLARATION.findAll(Source(file).code).map { it.groupValues[1] }.toList()
            }.toSet()
        // Positive controls: a screen outside the Scaffold (N1), a tab inside it, and the :app shell's own screen.
        for (probe in listOf("WelcomeScreen", "AujourdhuiScreen", "ResolvingScreen")) {
            assertTrue("$FENCE: discovery did not find $probe - it found ${declared.sorted()}", probe in declared)
        }
        return declared
    }

    private fun callSites(
        screen: String,
        screens: Set<String>,
        sources: List<Source>,
    ): List<CallSite> =
        sources.flatMap { source ->
            Regex("""(?<![\w.:])$screen\s*\(""").findAll(source.code)
                .filterNot { m -> source.code.substring(0, m.range.first).trimEnd().endsWith("fun") }
                .mapNotNull { m ->
                    val enclosing = source.enclosing(m.range.first)
                    // An overload delegating to its namesake proves nothing about where the screen is shown.
                    if (enclosing.lastOrNull() == screen) return@mapNotNull null
                    val inScreen = enclosing.lastOrNull { it in screens && it != screen }
                    val outer = enclosing.firstOrNull()
                    // ONLY in :shared. An :app function can be a framework entry point - CallbackActivity's onCreate
                    // has no caller in any source, the framework calls it (R246) - and this census's own first run
                    // classed CallbackScreen as off-Android on exactly that. Nothing outside :app enters commonMain.
                    val offAndroid =
                        outer?.takeIf { inScreen == null && source.isShared && !calledFrom(it, sources) }
                    CallSite(source, m.range.first, inScreen, offAndroid)
                }.toList()
        }

    /** Whether any shipped Android source calls [function] (its own declaration excluded). */
    private fun calledFrom(
        function: String,
        sources: List<Source>,
    ): Boolean =
        sources.any { source ->
            Regex("""(?<![\w.:])$function\s*\(""").findAll(source.code).any { m ->
                !source.code.substring(0, m.range.first).trimEnd().endsWith("fun")
            }
        }

    @Test
    fun everyScreenIsHostedByTheRootWrapper() {
        val sources = shippedSources()
        val roots = manifestActivities().map { (name, source) -> Triple(name, source, rootDefect(source)) }
        val wrappedFiles = roots.filter { it.third == null }.map { it.second.file.canonicalPath }.toSet()
        val screens = screens()
        val all = screens.associateWith { callSites(it, screens, sources) }
        val sites = all.mapValues { (_, list) -> list.filter { it.offAndroidHost == null } }
        val offAndroid = all.values.flatten().filter { it.offAndroidHost != null }

        // A least fixed point: a screen hosted only through a screen that is not hosted is not hosted.
        val hosted = mutableSetOf<String>()
        do {
            val before = hosted.size
            for (screen in screens) {
                val list = sites.getValue(screen)
                val each =
                    list.all { site ->
                        site.source.file.canonicalPath in wrappedFiles ||
                            site.enclosingScreen?.let { it in hosted } == true
                    }
                if (list.isNotEmpty() && each) hosted += screen
            }
        } while (hosted.size != before)

        val unhosted = screens.filterNot { it in hosted }.sorted()
        val census =
            buildString {
                appendLine("$FENCE (R1171): ${screens.size} screens, ${hosted.size} hosted by $WRAPPER.")
                appendLine("ROOTS (the main manifest's activities):")
                roots.forEach { (name, _, defect) -> appendLine("  $name: ${defect ?: "wrapped by $WRAPPER"}") }
                appendLine("NOT ANDROID DESTINATIONS (inside a function no Android shipped source calls):")
                offAndroid.forEach { appendLine("  $it in ${it.offAndroidHost}") }
            }
        // R133: the census states what it counted, so a pass is a statement about a number and not an absence.
        println(census)
        val report =
            buildString {
                append(census)
                appendLine("UNHOSTED SCREENS (${unhosted.size}) - on an edge-to-edge window (targetSdk 36,")
                appendLine("Android 15+) they draw under the system bars:")
                for (screen in unhosted) {
                    val list = sites.getValue(screen)
                    val where =
                        if (list.isEmpty()) {
                            "called nowhere in the Android shipped sources"
                        } else {
                            list.joinToString { site ->
                                site.enclosingScreen?.let { "$site (inside $it, not hosted)" }
                                    ?: "$site (not under a wrapped root)"
                            }
                        }
                    appendLine("  $screen <- $where")
                }
                append("Fix: host the composition in $WRAPPER (ui/shell/AppRoot.kt), never per call site (R1170).")
            }
        assertTrue(report, unhosted.isEmpty())
    }

    @Test
    fun theRootWrapperAppliesTheSystemBarInsets() {
        val code = blankCommentsAndStrings(subjectFile(FENCE, WRAPPER_FILE).readText())
        assertTrue("$WRAPPER_FILE declares no `fun $WRAPPER(`", Regex("""\bfun\s+$WRAPPER\s*\(""") in code)
        // The default the app runs with: the system bars and the display cutout (landscape) - not the IME.
        assertTrue(
            "$WRAPPER's default insets must be WindowInsets.systemBars united with WindowInsets.displayCutout",
            Regex("""WindowInsets\.systemBars\s*\.union\(\s*WindowInsets\.displayCutout\s*\)""") in code,
        )
        // windowInsetsPadding pads AND consumes, so a Scaffold or NavigationBar beneath it pads nothing more.
        assertTrue(
            "$WRAPPER applies no .windowInsetsPadding(insets)",
            Regex("""\.windowInsetsPadding\(\s*insets\s*\)""") in code,
        )
    }

    @Test
    fun noOtherShippedSourceHandlesTheSystemBarInsets() {
        val wrapper = File(WRAPPER_FILE).canonicalPath
        val offenders =
            shippedSources().filter { it.file.canonicalPath != wrapper }.flatMap { source ->
                INSET_HANDLING.findAll(source.code)
                    .map { "${source.label}:${source.lineOf(it.range.first)} ${it.value}" }
                    .toList()
            }
        assertTrue(
            "$FENCE (R1170): the system-bar insets are handled at ONE root, $WRAPPER - these sites handle them " +
                "again, per call site:\n  " + offenders.joinToString("\n  "),
            offenders.isEmpty(),
        )
    }
}

/** The index of the bracket closing the one at [open] in [code] (comments and strings already blanked). */
private fun closingBracket(
    code: String,
    open: Int,
    opener: Char = '{',
    closer: Char = '}',
): Int {
    var depth = 0
    for (i in open until code.length) {
        when (code[i]) {
            opener -> depth++
            closer -> if (--depth == 0) return i
        }
    }
    error("unbalanced '$opener' at offset $open")
}
