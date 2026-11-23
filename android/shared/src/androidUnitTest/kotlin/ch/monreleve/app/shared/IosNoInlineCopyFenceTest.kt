package ch.monreleve.app.shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * IOS-AUDIT R1356. NO USER-FACING LITERAL IN iOS's OWN CODE: the French lives in the copy objects (commonMain fr/), as
 * :app's no-inline-string fence (FencesTest, fence 4) requires of :app's ui/ and dev/. That fence never read :shared
 * iosMain or the Swift sources, so iOS could draw or notify with a typed sentence and nothing would see it. This one
 * reads both:
 *   - :shared iosMain (pinned by IosShellUi.kt), and
 *   - ios/MonReleve/Sources (pinned by MonReleveApp.swift) - the app target's Swift; the walk's XCUITest target
 *     (ios/MonReleveWalkUITests) is TEST code, which matches the app's own French on purpose, and is not read.
 *
 * WHAT COUNTS AS USER-FACING. iosMain is full of literals nobody reads on screen - Keychain service names, UserDefaults
 * keys, SQL, log lines, exception messages, Info.plist key names - so "no literal at all" (fence 4's rule) would be
 * wrong here. Two rules instead, each run over the literals a small lexer extracts (comments skipped, string templates
 * and Swift interpolations skipped, so neither a `//` inside a string nor a quote inside `${...}` confuses it):
 *   1. FRENCH: a literal holding an accented or typographic character (U+00C0..U+024F, U+2019, «, », the two no-break
 *      spaces) or one of a CURATED list of French words (R155's design: a list of the words this product's copy uses,
 *      extended when one appears - never derived, because stripping French yields English words).
 *   2. A UI SINK fed a literal directly: Compose's Text(...), a `text`/`label`/`contentDescription`/`title`/
 *      `placeholder` argument, the notice seam's show(...); in Swift, SwiftUI's Text(...)/Label(...) and a
 *      notification's or view's title/subtitle/body/accessibilityLabel. Whatever language it is in, a literal there is
 *      copy that bypassed the copy objects.
 * The copy objects themselves live in commonMain fr/, which this fence does not read; R155's accent guard
 * (ParametresCopyAccentTest) reads them.
 *
 * PRESENCE FIRST (R169, R154): each root is asserted found and pinned, the lexer is exercised on known strings in both
 * directions, and each rule is seen to fire on a known offender, so a fence that matched nothing cannot pass.
 *
 * KNOWN LIMIT, stated: a sentence assembled at run time from fragments that are each English or a single letter
 * evades rule 1, as fence 4's split-concatenation limit does.
 */
class IosNoInlineCopyFenceTest {
    private val iosMain = File("src/iosMain/kotlin")
    private val swiftSources = File("../../ios/MonReleve/Sources")

    @Test
    fun bothRootsAreTheRealOnes() {
        assertTrue("$FENCE: iosMain not found at ${iosMain.absolutePath}", File(iosMain, PIN_KT).isFile)
        assertTrue(
            "$FENCE: Swift sources not found at ${swiftSources.absolutePath}",
            File(swiftSources, PIN_SWIFT).isFile,
        )
    }

    @Test
    fun noUserFacingLiteralInIosMainOrTheSwiftSources() {
        val offenders = mutableListOf<String>()
        for (file in files(iosMain, "kt") + files(swiftSources, "swift")) {
            val swift = file.extension == "swift"
            val text = file.readText()
            literals(text, swift).filter(::looksFrench).forEach { offenders += "${file.path}: French literal \"$it\"" }
            sinkLiterals(text, swift).forEach { offenders += "${file.path}: literal at a UI sink: $it" }
        }
        assertTrue(
            "$FENCE: iOS's own code carries copy that belongs in the copy objects (commonMain fr/):\n" +
                offenders.joinToString("\n"),
            offenders.isEmpty(),
        )
    }

    @Test
    fun theLexerReadsLiteralsAndSkipsCommentsAndTemplates() {
        val kotlin =
            """
            |// a comment "Bonjour le monde"
            |val a = "ch.monreleve.app.session" /* "Votre relevé" */
            |val b = "the year ${'$'}{year.let { "nested" }} landed"
            |val c = ""${'"'}raw "quoted" text""${'"'}
            |val d = "https://example.invalid/path"
            """.trimMargin()
        assertEquals(
            listOf(
                "ch.monreleve.app.session",
                "the year  landed",
                "raw \"quoted\" text",
                "https://example.invalid/path",
            ),
            literals(kotlin, swift = false),
        )
        val swift = "let x = \"count \\(items.filter { \$0 == \"a\" }.count) done\" // \"commentaire\""
        assertEquals(listOf("count  done"), literals(swift, swift = true))
    }

    @Test
    fun eachRuleFiresOnItsShapeAndSparesTheRest() {
        assertTrue(looksFrench("Relevé annuel"))
        assertTrue(looksFrench("Votre code"))
        assertTrue(looksFrench("l’historique"))
        assertTrue(looksFrench("aucune journée"))
        assertTrue(!looksFrench("the export could not be written"))
        assertTrue(!looksFrench("ch.monreleve.app.detection.evening.enabled"))
        assertTrue(!looksFrench("SELECT name FROM sqlite_master"))
        assertTrue(!looksFrench("session ended"))
        assertEquals(1, sinkLiterals("Text(\"Hello\")", swift = false).size)
        assertEquals(1, sinkLiterals("Button(label = \"Go\", onClick = {})", swift = false).size)
        assertEquals(1, sinkLiterals("notices.show(\"Oops\")", swift = false).size)
        assertEquals(0, sinkLiterals("Text(CodeCopy.TITLE)", swift = false).size)
        assertEquals(1, sinkLiterals("content.title = \"Probe\"", swift = true).size)
        assertEquals(1, sinkLiterals("Text(\"Hi\")", swift = true).size)
        assertEquals(0, sinkLiterals("let title = String(\"x\")", swift = true).size)
    }

    private fun files(
        root: File,
        extension: String,
    ): List<File> {
        val all = root.walkTopDown().filter { it.isFile && it.extension == extension }.toList()
        assertTrue("$FENCE: ${root.path} holds no .$extension file - a fence reading nothing passes", all.isNotEmpty())
        return all
    }

    private companion object {
        const val FENCE = "IosNoInlineCopyFenceTest (R1356)"
        const val PIN_KT = "ch/monreleve/app/ios/IosShellUi.kt"
        const val PIN_SWIFT = "MonReleveApp.swift"

        // CURATED (R155): French words of this product's copy that no English literal in iOS's code would hold.
        val FRENCH_WORDS =
            setOf(
                "le", "la", "les", "des", "du", "une", "et", "de", "au", "aux", "votre", "vos", "vous", "aucun",
                "aucune", "pour", "avec", "dans", "est", "sont", "pas", "jour", "jours", "mon", "ma", "mes", "ce",
                "cette", "relevé", "enregistrer", "continuer", "annuler", "fermer", "réessayer", "connexion",
                "impossible", "paramètres", "aujourd",
            )
        private val TYPOGRAPHIC = Regex("[\\u00C0-\\u024F\\u2019\\u00AB\\u00BB\\u00A0\\u202F]")
        private val WORD = Regex("[A-Za-z\\u00C0-\\u024F]+")

        fun looksFrench(literal: String): Boolean =
            TYPOGRAPHIC.containsMatchIn(literal) ||
                WORD.findAll(literal).any { it.value.lowercase() in FRENCH_WORDS }

        private val KOTLIN_SINKS =
            listOf(
                Regex("""\bText\(\s*""""),
                Regex("""\b(text|label|contentDescription|title|placeholder)\s*=\s*""""),
                Regex("""\.show\(\s*""""),
            )
        private val SWIFT_SINKS =
            listOf(
                Regex("""\b(Text|Label)\(\s*""""),
                Regex("""\.(title|subtitle|body|accessibilityLabel|accessibilityHint)\s*=\s*""""),
            )

        /** The sink shapes fed a literal, read with comments removed (a sink named in prose is not a sink). */
        fun sinkLiterals(
            text: String,
            swift: Boolean,
        ): List<String> {
            val code = withoutComments(text, swift)
            return (if (swift) SWIFT_SINKS else KOTLIN_SINKS).flatMap { sink ->
                sink.findAll(code).map { it.value.trim() }.toList()
            }
        }

        /** The text with every comment blanked out and every string kept (the lexer below decides which is which). */
        private fun withoutComments(
            text: String,
            swift: Boolean,
        ): String {
            val out = StringBuilder()
            Lexer(text, swift).walk(onCode = { out.append(it) }, onLiteral = { _, raw -> out.append(raw) })
            return out.toString()
        }

        /** Every string literal's own text, templates and interpolations removed. */
        fun literals(
            text: String,
            swift: Boolean,
        ): List<String> {
            val found = mutableListOf<String>()
            Lexer(text, swift).walk(onCode = {}, onLiteral = { content, _ -> found += content })
            return found
        }
    }

    /**
     * A small lexer: code, comments (skipped) and string literals (handed over with their own text). One character
     * class per branch, read in one pass - the branches are the grammar, not tangled logic, so its size is suppressed
     * rather than split into helpers that would each need the cursor.
     */
    @Suppress("CyclomaticComplexMethod", "NestedBlockDepth", "ReturnCount")
    private class Lexer(
        private val s: String,
        private val swift: Boolean,
    ) {
        private var i = 0

        fun walk(
            onCode: (String) -> Unit,
            onLiteral: (content: String, raw: String) -> Unit,
        ) {
            while (i < s.length) {
                when {
                    s.startsWith("//", i) -> i = s.indexOf('\n', i).let { if (it < 0) s.length else it }
                    s.startsWith("/*", i) -> i = s.indexOf("*/", i + 2).let { if (it < 0) s.length else it + 2 }
                    s.startsWith("\"\"\"", i) -> {
                        val start = i
                        val content = readString(triple = true)
                        onLiteral(content, s.substring(start, i))
                    }
                    s[i] == '"' -> {
                        val start = i
                        val content = readString(triple = false)
                        onLiteral(content, s.substring(start, i))
                    }
                    s[i] == '\'' && !swift -> {
                        // A Kotlin char literal: '"' must not open a string.
                        val end = s.indexOf('\'', i + if (s.startsWith("'\\", i)) 3 else 2)
                        onCode(s.substring(i, if (end < 0) s.length else end + 1))
                        i = if (end < 0) s.length else end + 1
                    }
                    else -> {
                        onCode(s[i].toString())
                        i++
                    }
                }
            }
        }

        /** Reads one string from its opening quote(s); returns its text without templates, leaves i after it. */
        private fun readString(triple: Boolean): String {
            val content = StringBuilder()
            i += if (triple) 3 else 1
            while (i < s.length) {
                if (triple && s.startsWith("\"\"\"", i)) {
                    i += 3
                    return content.toString()
                }
                val c = s[i]
                when {
                    !triple && c == '"' -> {
                        i++
                        return content.toString()
                    }
                    !triple && c == '\n' -> return content.toString()
                    !swift && s.startsWith("\${", i) -> skipBalanced('{', '}', i + 1)
                    swift && s.startsWith("\\(", i) -> skipBalanced('(', ')', i + 1)
                    !triple && c == '\\' -> {
                        content.append(s.getOrElse(i + 1) { ' ' })
                        i += 2
                    }
                    else -> {
                        content.append(c)
                        i++
                    }
                }
            }
            return content.toString()
        }

        /** Skips from the opening [open] at [at] to just after its balanced [close], strings inside included. */
        private fun skipBalanced(
            open: Char,
            close: Char,
            at: Int,
        ) {
            var depth = 0
            i = at
            while (i < s.length) {
                when (s[i]) {
                    open -> depth++
                    close -> {
                        depth--
                        if (depth == 0) {
                            i++
                            return
                        }
                    }
                    '"' -> {
                        readString(triple = false)
                        continue
                    }
                }
                i++
            }
        }
    }
}
