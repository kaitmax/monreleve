package ch.monreleve.app.shared.fixtures

// KMP-0 increment 3 (R370). A minimal JSON reader for commonTest. org.json (JVM-only) and kotlinx.serialization
// are BOTH out of scope for KMP-0, and commonTest cannot read a file on iOS, so the generated fixture STRINGS
// (FixtureJson) are parsed by this hand-written, dependency-free reader common to every target. It is TEST-ONLY
// (commonTest), never on the product's classpath. It fails LOUDLY on malformed input rather than returning a
// partial tree, so a broken fixture is a RED test, never a silent wrong number - the Geneva conformance that
// consumes it asserts exact AFC-published values (SPEC 7.5).

internal sealed interface Json {
    data class Obj(val entries: Map<String, Json>) : Json

    data class Arr(val items: List<Json>) : Json

    data class Str(val value: String) : Json

    data class Num(val value: Double) : Json

    data class Bool(val value: Boolean) : Json

    data object Null : Json
}

/** Parse one JSON document. Throws on any malformed or trailing input. */
internal fun parseJson(text: String): Json {
    val parser = JsonParser(text)
    val value = parser.parseValue()
    parser.skipWhitespace()
    require(parser.atEnd()) { "trailing content after JSON value at index ${parser.position()}" }
    return value
}

private const val HEX_RADIX = 16
private const val UNICODE_ESCAPE_LEN = 4

// Control characters built from their codepoints rather than backslash escapes, so no invisible character
// ever lives in this source (the hex-codepoint discipline the app's Numbers.kt uses for the same reason).
private val BACKSPACE: Char = 0x08.toChar()
private val FORM_FEED: Char = 0x0C.toChar()
private val NEWLINE: Char = 0x0A.toChar()
private val CARRIAGE_RETURN: Char = 0x0D.toChar()
private val TAB: Char = 0x09.toChar()

private class JsonParser(private val s: String) {
    private var index = 0

    fun position(): Int = index

    fun atEnd(): Boolean = index >= s.length

    fun skipWhitespace() {
        while (index < s.length && isWhitespace(s[index])) index++
    }

    fun parseValue(): Json {
        skipWhitespace()
        require(!atEnd()) { "unexpected end of JSON" }
        return when (s[index]) {
            '{' -> parseObject()
            '[' -> parseArray()
            '"' -> Json.Str(parseString())
            't', 'f' -> parseBool()
            'n' -> parseNull()
            else -> parseNumber()
        }
    }

    private fun expect(c: Char) {
        require(!atEnd() && s[index] == c) { "expected '$c' at index $index" }
        index++
    }

    private fun parseObject(): Json.Obj {
        expect('{')
        val entries = LinkedHashMap<String, Json>()
        skipWhitespace()
        if (consumeCloser('}')) return Json.Obj(entries)
        while (true) {
            skipWhitespace()
            val key = parseString()
            skipWhitespace()
            expect(':')
            entries[key] = parseValue()
            if (consumeSeparatorOrCloser('}')) return Json.Obj(entries)
        }
    }

    private fun parseArray(): Json.Arr {
        expect('[')
        val items = mutableListOf<Json>()
        skipWhitespace()
        if (consumeCloser(']')) return Json.Arr(items)
        while (true) {
            items += parseValue()
            if (consumeSeparatorOrCloser(']')) return Json.Arr(items)
        }
    }

    /** At an empty container's closer: consume it and report true; otherwise leave the cursor put. */
    private fun consumeCloser(closer: Char): Boolean {
        if (!atEnd() && s[index] == closer) {
            index++
            return true
        }
        return false
    }

    /** After an element: a comma continues, the closer ends (consumed, true), anything else is an error. */
    private fun consumeSeparatorOrCloser(closer: Char): Boolean {
        skipWhitespace()
        require(!atEnd()) { "unterminated container at index $index" }
        return when (s[index]) {
            ',' -> {
                index++
                false
            }
            closer -> {
                index++
                true
            }
            else -> error("expected ',' or '$closer' at index $index")
        }
    }

    private fun parseString(): String {
        expect('"')
        val out = StringBuilder()
        while (true) {
            require(!atEnd()) { "unterminated string at index $index" }
            when (val c = s[index++]) {
                '"' -> return out.toString()
                '\\' -> out.append(readEscape())
                else -> out.append(c)
            }
        }
    }

    private fun readEscape(): Char {
        require(!atEnd()) { "unterminated escape at index $index" }
        return when (s[index++]) {
            '"' -> '"'
            '\\' -> '\\'
            '/' -> '/'
            'b' -> BACKSPACE
            'f' -> FORM_FEED
            'n' -> NEWLINE
            'r' -> CARRIAGE_RETURN
            't' -> TAB
            'u' -> readUnicodeEscape()
            else -> error("invalid escape at index ${index - 1}")
        }
    }

    private fun readUnicodeEscape(): Char {
        require(index + UNICODE_ESCAPE_LEN <= s.length) { "truncated unicode escape at index $index" }
        val hex = s.substring(index, index + UNICODE_ESCAPE_LEN)
        index += UNICODE_ESCAPE_LEN
        return hex.toInt(HEX_RADIX).toChar()
    }

    private fun parseBool(): Json.Bool =
        when {
            s.startsWith("true", index) -> {
                index += "true".length
                Json.Bool(true)
            }
            s.startsWith("false", index) -> {
                index += "false".length
                Json.Bool(false)
            }
            else -> error("invalid literal at index $index")
        }

    private fun parseNull(): Json {
        require(s.startsWith("null", index)) { "invalid literal at index $index" }
        index += "null".length
        return Json.Null
    }

    private fun parseNumber(): Json.Num {
        val start = index
        if (!atEnd() && s[index] == '-') index++
        consumeDigits()
        if (!atEnd() && s[index] == '.') {
            index++
            consumeDigits()
        }
        if (!atEnd() && (s[index] == 'e' || s[index] == 'E')) {
            index++
            if (!atEnd() && (s[index] == '+' || s[index] == '-')) index++
            consumeDigits()
        }
        val token = s.substring(start, index)
        require(token.isNotEmpty() && token != "-") { "invalid number at index $start" }
        return Json.Num(token.toDouble())
    }

    private fun consumeDigits() {
        while (!atEnd() && s[index] in '0'..'9') index++
    }

    private fun isWhitespace(c: Char): Boolean = c == ' ' || c == TAB || c == NEWLINE || c == CARRIAGE_RETURN
}

// Ergonomic accessors so the conformance test reads like the org.json version it replaces.
internal fun Json.asObj(): Json.Obj = this as? Json.Obj ?: error("expected a JSON object")

internal fun Json.asArr(): Json.Arr = this as? Json.Arr ?: error("expected a JSON array")

internal fun Json.Obj.value(key: String): Json = entries[key] ?: error("missing key '$key'")

internal fun Json.Obj.obj(key: String): Json.Obj = value(key).asObj()

internal fun Json.Obj.arr(key: String): Json.Arr = value(key).asArr()

internal fun Json.Obj.str(key: String): String = (value(key) as? Json.Str)?.value ?: error("$key not a string")

internal fun Json.Obj.double(key: String): Double = (value(key) as? Json.Num)?.value ?: error("$key not a number")

internal fun Json.Obj.int(key: String): Int = double(key).toInt()

internal fun Json.Obj.bool(key: String): Boolean = (value(key) as? Json.Bool)?.value ?: error("$key not a boolean")
