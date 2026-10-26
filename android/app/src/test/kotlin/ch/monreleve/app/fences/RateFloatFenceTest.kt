package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// AN-GRANULARITY (R495). NO Float CARRIES A DECLARABLE RATE TO THE SCREEN.
//
// WHAT THIS EXISTS TO STOP, stated as the thing that happened. AN-CALENDAR found Aujourd'hui animating the rate through
// animateFloatAsState: 0.83 as a Float is 0.829999983, which the declarable rate's truncation (SPEC 7.3) states as
// 0,82 - and Geneva's 39,16 % would have read 39,15 %. AN-CALENDAR handed the engine's Double over at rest; the frames
// in between still showed the Float, and nothing stopped the next screen doing the same.
//
// WHAT IT REFUSES, anywhere in :app's main tree or :shared's commonMain (FenceRoot, each root pinned), with comments
// and strings blanked first (SettingsReadScanner's blanker):
//   1. a rate converted to a Float              declarableRate.toFloat()
//   2. an expression holding a rate, converted  (rate / PERCENT).toFloat()
//   3. a rate handed to an animation            animateFloatAsState(... rate ...), animateValueAsState(... rate ...)
//   4. a rate held as a Float                   rate: Float, val shownRate: Float
//   5. a function named for a rate, returning a Float
// "A rate" is recognised BY NAME: `rate`, `percentage`, anything carrying `declarableRate`/`DeclarableRate`, any
// camelCase name ending in `Rate` or `Percentage`, any starting `rate` + a capital - except the three quantities that
// are not the declarable rate, named with their reasons in NOT_THE_RATE (asserted exactly three).
//
// ITS LIMIT, STATED: it reads names, not data flow. A rate passed into a parameter called `value` and converted there
// escapes it. That is why the screens' formatted strings are ALSO asserted on the JVM against the shared Geneva
// fixtures (GenevaRateStringTest) - the fence keeps the shape out, the string test proves the result.
//
// DRAWING GEOMETRY IS NOT THE FIGURE. Compose draws in Float (Dp, px, a fillMaxWidth fraction), so a rail's FILL may
// cross into Float at the drawing boundary; what the person READS - the figure, the rail's label and spoken name -
// must come from the Double. Each such boundary is an exemption that argues for itself (DRAWING_BOUNDARIES, asserted
// to still match exactly what it names), never a silent pass.

private val ROOTS =
    listOf(
        // IOS-1b-A R603: RateDisplay.kt moved to :shared with design/; :app's root is pinned by a file it holds.
        FenceRoot(File("src/main/kotlin/ch/monreleve/app"), pin = "MainActivity.kt"),
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app"), pin = "DeclarableRate.kt"),
    )

/**
 * The path from the engine's rate to every screen that states it - each file must exist and must NAME the rate in its
 * code (the positive control that the vocabulary reaches the path). AujourdhuiController and :shared's Forecast.kt and
 * Simulation.kt are not listed: they carry the engine's TeleworkResult whole and never name the field, so they cannot
 * convert it - the files that read the field out of it are listed.
 */
private val PATH =
    listOf(
        // the engine
        "../shared/src/commonMain/kotlin/ch/monreleve/app/calc/DeclarableRate.kt",
        "../shared/src/commonMain/kotlin/ch/monreleve/app/calc/Calculate.kt",
        "../shared/src/commonMain/kotlin/ch/monreleve/app/calc/Types.kt",
        // the Releve's rate, from the server's dossier
        "../shared/src/commonMain/kotlin/ch/monreleve/app/dossier/DossierPayload.kt",
        // the one formatting, the figure and the rail
        "../shared/src/commonMain/kotlin/ch/monreleve/app/fr/text/FrNumbers.kt",
        "../shared/src/commonMain/kotlin/ch/monreleve/app/design/RateDisplay.kt",
        "../shared/src/commonMain/kotlin/ch/monreleve/app/design/Zones.kt",
        "../shared/src/commonMain/kotlin/ch/monreleve/app/design/rail/RailGeometry.kt",
        "../shared/src/commonMain/kotlin/ch/monreleve/app/design/rail/ThresholdRail.kt",
        // the screens
        "src/main/kotlin/ch/monreleve/app/ui/screens/aujourdhui/AujourdhuiScreen.kt",
        "src/main/kotlin/ch/monreleve/app/ui/screens/aujourdhui/MovingRate.kt",
        "src/main/kotlin/ch/monreleve/app/forecast/ForecastController.kt",
        "src/main/kotlin/ch/monreleve/app/forecast/ForecastState.kt",
        "src/main/kotlin/ch/monreleve/app/ui/screens/prevision/PrevisionScreen.kt",
        "src/main/kotlin/ch/monreleve/app/ui/screens/prevision/PrevisionRail.kt",
        "src/main/kotlin/ch/monreleve/app/forecast/SimulationController.kt",
        "src/main/kotlin/ch/monreleve/app/forecast/SimulationState.kt",
        "src/main/kotlin/ch/monreleve/app/ui/screens/simulation/SimulationCard.kt",
        "src/main/kotlin/ch/monreleve/app/ui/screens/releve/ReleveSections.kt",
        "src/main/kotlin/ch/monreleve/app/parametres/DeviceRate.kt",
        "src/main/kotlin/ch/monreleve/app/parametres/ParametresController.kt",
        "src/main/kotlin/ch/monreleve/app/ui/screens/parametres/ParametresRateChange.kt",
        "src/main/kotlin/ch/monreleve/app/ui/screens/comparison/ComparisonScreen.kt",
    )

/** Names that end like a rate and are NOT the declarable rate - each a different quantity. */
private val NOT_THE_RATE: Map<String, String> =
    mapOf(
        "employmentRate" to
            "the employment-rate SETTING (a post's share of full time), an Int input to the engine - not its output",
        "employerRate" to
            "the employer's attestation figure the person types in (AN-RECON), another quantity, formatted on its own",
        "customRate" to
            "Parametres' custom employment-rate field - the employment-rate setting again, not the declarable rate",
    )

/** Drawing boundaries: (file name, the exact flagged text) -> why a Float there is geometry, not the figure. */
private val DRAWING_BOUNDARIES: Map<Pair<String, String>, String> =
    mapOf(
        ("PrevisionRail.kt" to "private fun frac(rate: Double): Float = (rate / PERCENT).toFloat()") to
            "the forecast rail's FILL as a 0..1 fraction for fillMaxWidth(Float) - a drawing width; the forecast's " +
            "figures are formatDeclarableRate(Double) in PrevisionScreen, never this",
    )

private val IDENTIFIER = Regex("""\b[A-Za-z_][A-Za-z0-9_]*\b""")
private val CAMEL_RATE = Regex("""^[a-z][A-Za-z0-9]*(Rate|Percentage)$""")
private val RATE_PREFIX = Regex("""^rate[A-Z][A-Za-z0-9]*$""")

internal fun isRateName(name: String): Boolean =
    name !in NOT_THE_RATE &&
        (
            name == "rate" || name == "percentage" || "declarableRate" in name || "DeclarableRate" in name ||
                CAMEL_RATE.matches(name) || RATE_PREFIX.matches(name)
        )

private fun mentionsRate(text: String): Boolean = IDENTIFIER.findAll(text).any { isRateName(it.value) }

/** One Float shape on a rate: where, which rule, and the line as written. */
internal data class RateFloat(val line: Int, val rule: String, val text: String)

private val TO_FLOAT_ON_NAME = Regex("""\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*toFloat\s*\(\s*\)""")
private val TO_FLOAT_ON_PAREN = Regex("""\)\s*\.\s*toFloat\s*\(\s*\)""")
private val ANIMATE = Regex("""\banimate(?:Float|Value)AsState\s*\(""")
private val TYPED_FLOAT = Regex("""\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*Float\b""")
private val FUN_FLOAT = Regex("""\bfun\s+(?:\w+\.)?(\w+)\s*\([^)]*\)\s*:\s*Float\b""")

/** The text between the '(' matching the ')' at [close] and that ')'. */
private fun parenthesisedBefore(
    code: String,
    close: Int,
): String {
    var depth = 0
    var i = close
    while (i >= 0) {
        when (code[i]) {
            ')' -> depth++
            '(' -> if (--depth == 0) return code.substring(i + 1, close)
        }
        i--
    }
    return ""
}

/** The first argument of the call whose '(' is at [open]: up to the first top-level ',' or the closing ')'. */
private fun firstArgument(
    code: String,
    open: Int,
): String {
    var depth = 0
    var end = code.length
    for (i in open until code.length) {
        when (code[i]) {
            '(' -> depth++
            ')' -> depth--
        }
        val closes = code[i] == ')' && depth == 0
        val separates = code[i] == ',' && depth == 1
        if (closes || separates) {
            end = i
            break
        }
    }
    return code.substring(open + 1, end)
}

/** Every Float shape on a rate in [source] - comments and strings blanked first, so neither is read as code. */
internal fun rateFloats(source: String): List<RateFloat> {
    val code = blankCommentsAndStrings(source)
    val lines = source.lines()

    fun at(offset: Int): Int = code.substring(0, offset).count { it == '\n' } + 1

    val found = mutableListOf<Pair<Int, String>>()
    TO_FLOAT_ON_NAME.findAll(code).filter { isRateName(it.groupValues[1]) }.forEach {
        found += at(it.range.first) to "a rate converted to Float"
    }
    TO_FLOAT_ON_PAREN.findAll(code).filter { mentionsRate(parenthesisedBefore(code, it.range.first)) }.forEach {
        found += at(it.range.first) to "an expression holding a rate, converted to Float"
    }
    ANIMATE.findAll(code).filter { mentionsRate(firstArgument(code, it.range.last)) }.forEach {
        found += at(it.range.first) to "a rate handed to a Float animation"
    }
    TYPED_FLOAT.findAll(code).filter { isRateName(it.groupValues[1]) }.forEach {
        found += at(it.range.first) to "a rate held as a Float"
    }
    FUN_FLOAT.findAll(code).filter { isRateName(it.groupValues[1]) }.forEach {
        found += at(it.range.first) to "a function named for a rate, returning a Float"
    }
    return found.distinct().sortedBy { it.first }.map { (line, rule) -> RateFloat(line, rule, lines[line - 1].trim()) }
}

private fun findings(): List<Pair<File, RateFloat>> {
    ROOTS.assertFound("rate Float fence (R495)")
    return ROOTS.ktFiles().flatMap { file -> rateFloats(file.readText()).map { file to it } }
}

private fun exempted(
    file: File,
    finding: RateFloat,
): Boolean = DRAWING_BOUNDARIES.keys.any { (name, text) -> file.name == name && finding.text.startsWith(text) }

class RateFloatFenceTest {
    @Test
    fun noFloatCarriesTheDeclarableRateToAScreen() {
        val offending = findings().filterNot { (file, finding) -> exempted(file, finding) }
        assertTrue(
            "a Float carries the declarable rate (R495) - animate a progress, not the rate, or keep the Double:\n" +
                offending.joinToString("\n") { (file, f) -> "  ${file.name}:${f.line}  ${f.rule}\n      ${f.text}" },
            offending.isEmpty(),
        )
    }

    @Test
    fun everyFileOnThePathIsThereAndNamesTheRate() {
        for (path in PATH) {
            val file = subjectFile("rate Float fence (R495)", path)
            assertTrue(
                "$path is on the rate's path but names no rate in its code - either the vocabulary no longer reaches " +
                    "it or it left the path; say which (R460)",
                mentionsRate(blankCommentsAndStrings(file.readText())),
            )
        }
    }

    @Test
    fun theVocabularyReachesTheRealDoubleDeclarations() {
        // Positive control: the same names, typed Double, where the path declares them - so "no Float found" is a
        // reading of the files the rate passes through, not a vocabulary that matches nothing.
        val declarations =
            mapOf(
                "../shared/src/commonMain/kotlin/ch/monreleve/app/fr/text/FrNumbers.kt" to "rate",
                "../shared/src/commonMain/kotlin/ch/monreleve/app/design/RateDisplay.kt" to "declarableRate",
                "../shared/src/commonMain/kotlin/ch/monreleve/app/design/rail/ThresholdRail.kt" to "percentage",
                "../shared/src/commonMain/kotlin/ch/monreleve/app/calc/Types.kt" to "declarableRate",
                "src/main/kotlin/ch/monreleve/app/forecast/ForecastState.kt" to "currentRate",
            )
        for ((path, name) in declarations) {
            val code = blankCommentsAndStrings(subjectFile("rate Float fence (R495)", path).readText())
            assertTrue("$path declares no `$name: Double`", Regex("""\b$name\s*:\s*Double\b""").containsMatchIn(code))
            assertTrue("`$name` must be read as a rate", isRateName(name))
        }
    }

    @Test
    fun eachShapeIsCaughtAndTheirDoublesAndGeometryAreNot() {
        val caught =
            listOf(
                "val a by animateFloatAsState(result.declarableRate.toFloat(), spec)",
                "val b = (rate / 100.0).toFloat()",
                "fun f(currentRate: Float) = Unit",
                "val c = animateValueAsState(simulatedRate, converter)",
                "fun shownRate(): Float = 0f",
                "val d: Float = projection.projectedRate.toFloat()",
            )
        for (snippet in caught) assertTrue("not caught: $snippet", rateFloats(snippet).isNotEmpty())
        val letThrough =
            listOf(
                "val a by animateFloatAsState(result.remainingToFiscal.toFloat(), spec)",
                "fun rateBetween(from: Double, to: Double, progress: Float): Double = to",
                "private fun DrawScope.toPx(value: Double): Float = value.dp.toPx()",
                "val e = settings.employmentRate.toFloat()",
                "// declarableRate.toFloat() in a comment",
                "val s = \"rate.toFloat()\"",
                "weight: Float,",
            )
        for (snippet in letThrough) {
            assertEquals("wrongly caught: $snippet", emptyList<RateFloat>(), rateFloats(snippet))
        }
    }

    @Test
    fun theExemptionsAreFewAndEachStillCoversWhatItNames() {
        assertEquals("NOT_THE_RATE is exactly three names - a fourth argues for itself (R206)", 3, NOT_THE_RATE.size)
        NOT_THE_RATE.values.forEach { assertTrue("a reason, not a label", it.length > 60) }
        assertEquals("DRAWING_BOUNDARIES is exactly one - a second argues for itself", 1, DRAWING_BOUNDARIES.size)
        val all = findings()
        for ((key, reason) in DRAWING_BOUNDARIES) {
            assertTrue("a reason, not a label", reason.length > 60)
            assertEquals(
                "the drawing boundary $key must still match exactly one finding - a stale exemption covers nothing",
                1,
                all.count { (file, f) -> file.name == key.first && f.text.startsWith(key.second) },
            )
        }
    }
}
