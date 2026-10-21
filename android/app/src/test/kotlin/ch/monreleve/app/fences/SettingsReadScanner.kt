package ch.monreleve.app.fences

/*
 * AN-CALENDAR (R475). WHERE A SETTINGS READ RUNS: once, when something is built - or every time it is used.
 *
 * SettingsCaptureFenceTest asks one question of every read of a settings store: does it run ONCE, when a
 * controller, a file or a composition is built, so that its answer is kept? Or does it run at USE, so that a
 * change made in Parametres is seen the next time? A line pattern cannot tell those apart -
 * `val s = settingsStore.load()` is a capture as a member and a read at use inside a function - so this
 * reads the BLOCKS around each read:
 *
 *   a member or top-level initialiser   runs when the class (or file) is built      -> a capture
 *   an init { } block                   runs when the class is built                -> a capture
 *   a remember { } block                runs when the composable first composes     -> a capture
 *   a function body, any other lambda   runs when it is called                      -> a read at use
 *
 * A LAMBDA INSIDE A CAPTURING BLOCK IS A PROVIDER, NOT A CAPTURE. `remember { Store { settingsStore.load() } }`
 * hands a function over and the read happens when it is called - which is exactly the correct shape
 * AN-ACCOUNT-TAG adopted for the account (R423). Control-flow blocks (if, else, when, try, for) and the standard
 * library's inline calls (let, run, apply, map ...) run in place, so they are transparent: a read inside an `if`
 * inside an init block is still a capture.
 *
 * STATED LIMITS - it is a lexer, not a compiler (R246's "a list is wrong the day it is written"):
 *   - `by lazy { }` is deferred, so a read there is let through although lazy KEEPS the first answer;
 *   - an inline call missing from [INLINE_CALLS] is treated as deferred (a missed capture, never a false one);
 *   - a secondary constructor's body is treated as an ordinary function body;
 *   - a read through a receiver the pattern does not name (a store held under another name) is not seen.
 * Each limit errs towards letting a line through, never towards a false alarm; the fence's own snippet tests pin
 * every rule above so a change to this file that breaks one goes red.
 */

/** Where one settings read runs, and whether running there keeps its answer. */
internal enum class ReadSite(val capture: Boolean, val described: String) {
    AT_USE(false, "read at use"),
    MEMBER(true, "a member's initialiser - it runs once, when the class is built"),
    TOP_LEVEL(true, "a top-level initialiser - it runs once, when the file is loaded"),
    INIT(true, "an init block - it runs once, when the class is built"),
    REMEMBER(true, "a remember block - it runs once, when the composable first composes"),
}

/** One read: its 1-based line, where it runs, and the member it initialises (for MEMBER and TOP_LEVEL). */
internal data class SettingsRead(val line: Int, val site: ReadSite, val member: String?)

/**
 * A read of a SETTINGS-FAMILY store: the six calculation settings (SettingsStore), the logging mode
 * (DetectionModeStore) and the two notification opt-ins (EveningNotificationStore, ThresholdAlertStore). Named by
 * the receivers the code uses - any `...Store`, `store` or `settings` - and by a store built and read in one
 * expression. `tokenStore` is excluded: credentials are read per request by SessionManager and are not settings.
 */
internal val SETTINGS_READ: Regex =
    Regex(
        """\b(?!tokenStore\b)(?:\w*Store|store|settings)\.(?:load|isEnabled)\(\)""" +
            """|\bSharedPrefs\w*Store\([^)]*\)\.(?:load|isEnabled)\(\)""",
    )

/** Every settings read in [source], with where it runs. */
internal fun settingsReads(source: String): List<SettingsRead> {
    val code = blankCommentsAndStrings(source)
    val matches = SETTINGS_READ.findAll(code).toList()
    val sites = BlockScanner(code).sitesAt(matches.map { it.range.first }.toSet())
    return matches.map { match ->
        val (site, member) =
            checkNotNull(sites[match.range.first]) {
                "the scanner never reached the read at offset ${match.range.first} - it lost its place in the file"
            }
        SettingsRead(code.substring(0, match.range.first).count { it == '\n' } + 1, site, member)
    }
}

/**
 * [source] with every comment and every string or char literal (template expressions included) replaced by spaces,
 * newlines kept - so offsets and line numbers still point into the original, and no brace or read inside a comment
 * or a string can be mistaken for code.
 */
internal fun blankCommentsAndStrings(source: String): String = Blanker(source).run()

private class Blanker(private val s: String) {
    private val out = StringBuilder(s.length)
    private var i = 0

    fun run(): String {
        code(insideTemplate = false)
        return out.toString()
    }

    /** Copies code until the end - or, inside a `${ }` template, until the brace that closes it. */
    private fun code(insideTemplate: Boolean) {
        var depth = 0
        while (i < s.length) {
            if (skippedNonCode()) continue
            if (s[i] == '}' && insideTemplate && depth == 0) return
            if (s[i] == '{') depth++
            if (s[i] == '}') depth--
            keep()
        }
    }

    /** Blanks the comment, string or char literal that starts here; false when what starts here is code. */
    private fun skippedNonCode(): Boolean {
        when {
            s.startsWith("//", i) -> while (i < s.length && s[i] != '\n') blank()
            s.startsWith("/*", i) -> blockComment()
            s.startsWith("\"\"\"", i) -> rawString()
            s[i] == '"' || s[i] == '\'' -> quoted(s[i])
            else -> return false
        }
        return true
    }

    /** Kotlin block comments nest. */
    private fun blockComment() {
        var depth = 0
        do {
            when {
                s.startsWith("/*", i) -> depth++.also { blank(2) }
                s.startsWith("*/", i) -> depth--.also { blank(2) }
                else -> blank()
            }
        } while (i < s.length && depth > 0)
    }

    private fun rawString() {
        blank(3)
        while (i < s.length && !s.startsWith("\"\"\"", i)) if (s.startsWith("\${", i)) template() else blank()
        blank(3)
    }

    /** A "string" or a 'c'har, escapes and templates included. */
    private fun quoted(quote: Char) {
        blank()
        while (i < s.length && s[i] != quote && s[i] != '\n') {
            when {
                s[i] == '\\' -> blank(2)
                quote == '"' && s.startsWith("\${", i) -> template()
                else -> blank()
            }
        }
        blank()
    }

    /** A `${ ... }` template: scanned as code (so its own strings and braces stay balanced), then blanked. */
    private fun template() {
        blank(2)
        val start = out.length
        code(insideTemplate = true)
        for (k in start until out.length) if (out[k] != '\n') out.setCharAt(k, ' ')
        blank()
    }

    private fun keep() {
        out.append(s[i])
        i++
    }

    private fun blank(count: Int = 1) {
        repeat(count) {
            if (i < s.length) {
                out.append(if (s[i] == '\n') '\n' else ' ')
                i++
            }
        }
    }
}

private enum class Block { TOP, CLASS, INIT, REMEMBER, CODE, INLINE }

private enum class Decl { NONE, PROPERTY, FUNCTION }

private class Frame(val block: Block) {
    var decl = Decl.NONE
    var member: String? = null
}

private val CLASS_KEYWORDS = setOf("class", "object", "interface")

/** Declarations that cannot belong to a class header, so a header still awaiting its body has none. */
private val ENDS_A_HEADER = setOf("fun", "val", "var", "typealias", "import")

private val REMEMBER_CALLS = setOf("remember", "rememberSaveable")

/** Tokens after which `{` opens a block that runs in place (if/else, when branches, try ...). */
private val INLINE_AFTER = setOf("else", "try", "finally", "do", "->", "when")

/** Calls whose `( ... ) {` opens a block that runs in place. */
private val INLINE_AFTER_PAREN = setOf("if", "when", "for", "while", "catch")

/** Standard-library calls whose lambda runs before the call returns. */
private val INLINE_CALLS =
    setOf(
        "let", "run", "apply", "also", "with", "takeIf", "takeUnless", "use", "synchronized", "repeat",
        "forEach", "map", "mapNotNull", "filter", "first", "firstOrNull", "any", "all", "none", "count",
        "sumOf", "fold", "buildList", "buildString", "checkNotNull", "requireNotNull", "check", "require",
    )

/** Walks code (comments and strings already blanked) keeping the stack of blocks, and reports where reads run. */
private class BlockScanner(private val code: String) {
    private val frames = ArrayDeque<Frame>().apply { addLast(Frame(Block.TOP)) }
    private val parens = ArrayDeque<String?>()
    private var prev: String? = null
    private var closedCall: String? = null
    private var classHeaderAt: Int? = null
    private var rememberAt: Int? = null
    private var expectMember = false

    fun sitesAt(offsets: Set<Int>): Map<Int, Pair<ReadSite, String?>> {
        val found = HashMap<Int, Pair<ReadSite, String?>>()
        var i = 0
        while (i < code.length) {
            if (i in offsets) found[i] = site()
            i = step(i)
        }
        return found
    }

    private fun step(i: Int): Int {
        val c = code[i]
        return when {
            c.isWhitespace() -> i + 1
            c.isLetter() || c == '_' -> identifier(i)
            code.startsWith("->", i) || code.startsWith("::", i) -> {
                prev = code.substring(i, i + 2)
                i + 2
            }
            else -> {
                punctuation(c)
                i + 1
            }
        }
    }

    private fun identifier(start: Int): Int {
        var end = start
        while (end < code.length && (code[end].isLetterOrDigit() || code[end] == '_')) end++
        val name = code.substring(start, end)
        if (name in CLASS_KEYWORDS && prev != "::" && prev != ".") classHeaderAt = parens.size
        if (name in ENDS_A_HEADER && classHeaderAt == parens.size) classHeaderAt = null
        if (name in REMEMBER_CALLS) rememberAt = parens.size
        declare(name)
        prev = name
        return end
    }

    /** At class or file level, tracks which declaration the tokens belong to: a property, or a function. */
    private fun declare(name: String) {
        val frame = frames.last()
        if (frame.block != Block.CLASS && frame.block != Block.TOP) return
        when {
            expectMember -> frame.member = name.also { expectMember = false }
            name == "val" || name == "var" -> frame.decl = Decl.PROPERTY.also { expectMember = true }
            name == "fun" || name == "init" || name in CLASS_KEYWORDS -> frame.decl = Decl.FUNCTION
            (name == "get" || name == "set") && prev != "." -> frame.decl = Decl.FUNCTION
        }
    }

    private fun punctuation(c: Char) {
        when (c) {
            '(' -> parens.addLast(prev)
            ')' -> closedCall = parens.removeLastOrNull()
            '{' -> frames.addLast(Frame(blockOpening()))
            '}' -> closeBlock()
        }
        prev = c.toString()
    }

    private fun blockOpening(): Block {
        val depth = parens.size
        return when {
            classHeaderAt == depth -> Block.CLASS.also { classHeaderAt = null }
            prev == "init" -> Block.INIT
            rememberAt == depth && opensRemember() -> Block.REMEMBER.also { rememberAt = null }
            runsInPlace() -> Block.INLINE
            else -> Block.CODE
        }
    }

    /** `remember {` or `remember(keys) {`. */
    private fun opensRemember(): Boolean = prev in REMEMBER_CALLS || (prev == ")" && closedCall in REMEMBER_CALLS)

    /** A block that runs where it stands: control flow, a when branch, or an inline standard-library call. */
    private fun runsInPlace(): Boolean {
        val afterParen = prev == ")" && (closedCall in INLINE_AFTER_PAREN || closedCall in INLINE_CALLS)
        return prev in INLINE_AFTER || prev in INLINE_CALLS || afterParen
    }

    private fun closeBlock() {
        if (frames.size > 1) frames.removeLast()
        if ((classHeaderAt ?: -1) >= parens.size) classHeaderAt = null
        if ((rememberAt ?: -1) >= parens.size) rememberAt = null
    }

    private fun site(): Pair<ReadSite, String?> {
        val frame = frames.lastOrNull { it.block != Block.INLINE } ?: frames.first()
        val property = frame.decl == Decl.PROPERTY
        return when (frame.block) {
            Block.INIT -> ReadSite.INIT to null
            Block.REMEMBER -> ReadSite.REMEMBER to null
            Block.CLASS -> if (property) ReadSite.MEMBER to frame.member else ReadSite.AT_USE to null
            Block.TOP -> if (property) ReadSite.TOP_LEVEL to frame.member else ReadSite.AT_USE to null
            else -> ReadSite.AT_USE to null
        }
    }
}
