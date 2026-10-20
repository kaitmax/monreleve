package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * SPEC 5's six Android fences (D18/D37/R8/R62), ported as source-scanning unit
 * tests - this project's established idiom for a check the toolchain itself
 * cannot express directly (the web side's R147-style scans; RadiusTest.kt and
 * ThemeCensusTest.kt are the same shape for the token layer: no new
 * dependency, runs under `test`, plain assertions against the real tree).
 *
 * Every scanner reads FULL FILE TEXT, not just import lines, because a
 * fully-qualified reference (`android.content.Context` used inline, no import
 * statement) is a real evasion an import-line-only scanner misses - this was
 * found by attempting it (R7), not assumed in advance, and is why fence 1
 * below checks for the bare token, not the `import` keyword.
 *
 * Comments are stripped before scanning (KDoc in this codebase routinely
 * quotes the very identifiers a fence looks for - "android.*", "Location" -
 * in prose explaining the rule itself, which would otherwise self-trigger).
 *
 * The source root is resolved relative to the app module directory, which is
 * Gradle's working directory for `Test` tasks by default.
 */
private val appSrcRoot = File("src/main/kotlin/ch/monreleve/app")

private fun stripComments(text: String): String =
    text
        .replace(Regex("""/\*[\s\S]*?\*/"""), "")
        .replace(Regex("""//.*"""), "")

private fun ktFiles(subpackage: String): List<File> {
    val dir = File(appSrcRoot, subpackage)
    if (!dir.exists()) return emptyList()
    return dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
}

private fun allKtFilesExcept(excludedSubpackage: String): List<File> {
    val excludedDir = File(appSrcRoot, excludedSubpackage).canonicalFile
    return appSrcRoot.walkTopDown()
        .filter { it.isFile && it.extension == "kt" }
        .filterNot { it.canonicalFile.startsWith(excludedDir) }
        .toList()
}

/** Text between a call's opening `(` and its balanced closing `)`, depth-aware. */
private fun callArgumentSpans(
    text: String,
    functionName: String,
): List<String> {
    val spans = mutableListOf<String>()
    for (match in Regex("""\b$functionName\(""").findAll(text)) {
        val openParen = match.range.last
        var depth = 1
        var i = openParen + 1
        while (i < text.length && depth > 0) {
            when (text[i]) {
                '(' -> depth++
                ')' -> depth--
            }
            i++
        }
        spans += text.substring(openParen + 1, (i - 1).coerceAtLeast(openParen + 1))
    }
    return spans
}

/**
 * A Card(...) argument span is themed when it names both `shape` and
 * `elevation` AND neither value is Material's own default accessor spelled
 * out explicitly (the evasion the fence 6 KDoc describes).
 */
private fun cardArgsAreThemed(args: String): Boolean {
    val hasShape = Regex("""\bshape\s*=""").containsMatchIn(args)
    val hasElevation = Regex("""\belevation\s*=""").containsMatchIn(args)
    val shapeIsMaterialDefault = Regex("""\bshape\s*=\s*CardDefaults\.shape\b""").containsMatchIn(args)
    val elevationIsMaterialDefault =
        Regex("""\belevation\s*=\s*CardDefaults\.cardElevation\(\s*\)""").containsMatchIn(args)
    return hasShape && hasElevation && !shapeIsMaterialDefault && !elevationIsMaterialDefault
}

class FencesTest {
    // ------------------------------------------------------------------
    // Fence 1 - calc/ imports nothing from android.*, androidx.*, or any
    // project package outside calc/ itself (SPEC 5). Relative imports
    // within calc/ are allowed.
    // ------------------------------------------------------------------
    @Test
    fun calcImportsNothingFromAndroidOrOtherProjectPackages() {
        // KMP-0: calc moved to :shared's commonMain (same package). This repo-level fence follows it there,
        // belt-and-braces beside :shared's own commonMain metadata compile + CommonMainFenceTest, which reject
        // java./android./androidx. AND any non-common (hence any other-project) import at the compiler level.
        val calcDir = File("../shared/src/commonMain/kotlin/ch/monreleve/app/calc")
        val files =
            if (calcDir.exists()) {
                calcDir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
            } else {
                emptyList()
            }
        // F7 (AN-FIX): an absence assertion over an EMPTY set passes vacuously, so a fence pointed at a
        // renamed or moved directory would go green on zero files. Assert the scan found files first.
        assertTrue("calc/ fence scanned no files - calc/ renamed or moved? (F7 vacuity guard)", files.isNotEmpty())
        val offenders = mutableListOf<String>()
        for (file in files) {
            val text = stripComments(file.readText())
            if (Regex("""\bandroid\.\w""").containsMatchIn(text)) {
                offenders += "${file.path}: references android.* (import or fully-qualified)"
            }
            if (Regex("""\bandroidx\.\w""").containsMatchIn(text)) {
                offenders += "${file.path}: references androidx.* (import or fully-qualified)"
            }
            for (match in Regex("""\bch\.monreleve\.app\.(\w+)""").findAll(text)) {
                val referencedPackage = match.groupValues[1]
                if (referencedPackage != "calc") {
                    offenders +=
                        "${file.path}: references project package ch.monreleve.app.$referencedPackage" +
                        " (only calc/ itself is allowed)"
                }
            }
        }
        assertTrue("calc/ fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 2a - detection/ may not import data/remote and may not
    // reference Retrofit. Detection never talks to a network.
    //
    // KNOWN LIMIT (found by the required evasion attempt): a literal split
    // across a concatenation ("data." + "remote") never appears contiguous
    // in the file text and evades this scan. Same limitation class as fence
    // 2b's re-export gap - a text scan cannot see through string operations
    // or renaming; closing it needs semantic analysis. See REPORT-AN1.txt.
    // ------------------------------------------------------------------
    // R461: :app ONLY, and correct - detection/ is Android (location, WorkManager, Notification) and has
    // no counterpart in :shared commonMain. R460 is already delivered by the isNotEmpty() below: ktFiles()
    // returns an empty list for a missing directory, and the assertion turns that into a named failure.
    @Test
    fun detectionNeverReferencesDataRemoteOrRetrofit() {
        val files = ktFiles("detection")
        assertTrue("detection/ fence scanned no files - detection/ renamed? (F7 vacuity guard)", files.isNotEmpty())
        val offenders = mutableListOf<String>()
        for (file in files) {
            val text = stripComments(file.readText())
            if (Regex("""\bdata\.remote\b""").containsMatchIn(text) ||
                Regex("""\bRetrofit\b""").containsMatchIn(text)
            ) {
                offenders += "${file.path}: references data/remote or Retrofit"
            }
        }
        assertTrue("detection/no-network fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 2b (D18, the most important in the file) - no coordinate type
    // (Location, LatLng, a lat/lng pair) appears outside detection/.
    //
    // KNOWN LIMIT (found by the required evasion attempt, not assumed): this
    // is a NAME-based scan. A coordinate pair re-exported under an
    // unrelated name (e.g. `data class DeviceFix(val x: Double, val y:
    // Double)`) evades it - closing that needs a semantic/type-level check
    // (a custom detekt rule reading the resolved type), which is out of
    // AN1's zero-new-dependency scope. See REPORT-AN1.txt.
    // ------------------------------------------------------------------
    @Test
    fun noCoordinateTypeAppearsOutsideDetection() {
        val files = allKtFilesExcept("detection")
        assertTrue("D18 coordinate fence scanned no files - app root renamed? (F7 vacuity guard)", files.isNotEmpty())
        val offenders = mutableListOf<String>()
        val coordinatePattern = Regex("""\b(Location|LatLng|latitude|longitude)\b""")
        for (file in files) {
            val text = stripComments(file.readText())
            val match = coordinatePattern.find(text)
            if (match != null) {
                offenders += "${file.path}: coordinate-shaped identifier '${match.value}' outside detection/"
            }
        }
        assertTrue("D18 coordinate fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 2c (KMP-2b, R401) - D18's coordinate scan, extended to :shared
    // commonMain, because that is where the STORE now lives.
    //
    // Fence 2b above walks :app's main source. KMP-2b moved EntryEntity,
    // TallyEntity, RhythmEntity and the three DAOs - the files D18 is
    // actually about - into :shared, so 2b kept passing over code that no
    // longer contains the thing it guards. R401: the gate moves with the
    // code. R267: the second site is checked, not merely named.
    //
    // It is a SEPARATE test rather than a wider 2b because the two trees
    // have different exclusions - :app exempts detection/, and :shared has
    // no detection code at all, so a shared exclusion would be an exemption
    // nothing needs.
    //
    // RoomSchemaContractTest's noColumnIsCoordinateShapedInAnyTable remains
    // the stronger guard: it reads the generated DDL rather than the source,
    // and a coordinate re-exported under an unrelated name would still reach
    // a COLUMN. This closes the source half; that one closes the contract.
    // ------------------------------------------------------------------
    @Test
    fun noCoordinateTypeAppearsInSharedCommonMain() {
        val sharedCommonMain = File("../shared/src/commonMain/kotlin/ch/monreleve/app")
        // R169 presence: a wrong path would make this pass by scanning nothing.
        assertTrue(
            "D18 shared coordinate fence: ${sharedCommonMain.absolutePath} is not a directory - the " +
                "working directory is not :app, or :shared moved",
            sharedCommonMain.isDirectory,
        )
        val files = sharedCommonMain.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        assertTrue("D18 shared coordinate fence scanned no files (F7 vacuity guard)", files.isNotEmpty())

        val offenders = mutableListOf<String>()
        val coordinatePattern = Regex("""\b(Location|LatLng|latitude|longitude)\b""")
        for (file in files) {
            val text = stripComments(file.readText())
            val match = coordinatePattern.find(text)
            if (match != null) {
                offenders += "${file.path}: coordinate-shaped identifier '${match.value}' in :shared commonMain"
            }
        }
        assertTrue("D18 coordinate fence violated in :shared:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 3 - ui/ AND design/ contain no radius, colour or spacing
    // literal outside the token set (D37/R8/R62), EXCEPT the token
    // DEFINITION files themselves (Tokens.kt, Typography.kt) - an alias
    // there is not an evasion of this fence, it is the fence's own source
    // of truth.
    //
    // design/ ADDED IN AN3 INCREMENT 4, FOUND NECESSARY RATHER THAN
    // ASSUMED (the same shape as NoBareThresholdTest's and
    // CopyReachabilityTest's own design/ extensions this same increment):
    // AN1 wrote this fence when design/ held only token definitions, and
    // its own comment said so explicitly. AN3 put real COMPONENTS there
    // (Zones.kt, ZoneTokens.kt, rail/, ZoneBadge.kt and five more) -
    // exactly the code this fence exists to hold to the token-only
    // standard, sitting one directory outside where it was looking.
    //
    // KNOWN LIMIT (found by the required evasion attempt): each regex
    // anchors on the literal appearing AT the call site
    // (`RoundedCornerShape(10...`, `Color(0x...`). A one-hop indirection -
    // `val r = 10; RoundedCornerShape(r.dp)` - moves the literal off that
    // anchor and evades it. Same class as fences 2a/2b: a text scan cannot
    // see through indirection; closing it needs dataflow analysis, out of
    // AN1's scope. See REPORT-AN1.txt.
    // ------------------------------------------------------------------
    // R461: :app ONLY, and correct - ui/ and design/ are Jetpack Compose, which commonMain cannot hold.
    // R460 is already delivered by the isNotEmpty() below: a renamed root scans zero files and fails here.
    @Test
    fun uiAndDesignHaveNoRadiusColourOrSpacingLiteralOutsideTokens() {
        val tokenDefinitionFiles =
            setOf(
                File(appSrcRoot, "design/Tokens.kt").canonicalFile,
                File(appSrcRoot, "design/Typography.kt").canonicalFile,
            )
        val scanned =
            (ktFiles("ui") + ktFiles("design") + ktFiles("dev")).filterNot { it.canonicalFile in tokenDefinitionFiles }
        assertTrue("ui//design/ fence scanned no files - renamed? (F7 vacuity guard)", scanned.isNotEmpty())

        val offenders = mutableListOf<String>()
        for (file in scanned) {
            val text = stripComments(file.readText())
            if (Regex("""Color\(\s*0x""").containsMatchIn(text)) {
                offenders += "${file.path}: raw Color(0x...) literal outside design/Tokens.kt"
            }
            if (Regex("""RoundedCornerShape\(\s*\d""").containsMatchIn(text)) {
                offenders += "${file.path}: RoundedCornerShape(...) with a raw numeric literal"
            }
            if (Regex("""\b\d+(\.\d+)?\.dp\b""").containsMatchIn(text)) {
                offenders += "${file.path}: raw .dp literal outside Spacing/Radius"
            }
        }
        assertTrue("ui//design/ token fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 4 - no String literal in a composable; French comes from fr/.
    //
    // Scoped to the WHOLE ui/ file, not just text lexically inside a
    // @Composable function's braces. A first draft scoped to composable
    // bodies only, and the required evasion attempt (a literal hoisted to a
    // same-file constant referenced from inside the composable) escaped it -
    // the literal still lives in ui/, which is what the rule actually cares
    // about. Broadened after that finding; see REPORT-AN1.txt.
    //
    // dev/ ADDED IN AN3 INCREMENT 6: GalleryScreen.kt is exactly the shape
    // this fence exists for (a Composable file assembling captions), so its
    // first run there is a real exercise, not a formality. design/ is NOT
    // added here - out of scope for this task; see REPORT-AN3.txt's NOTICED
    // BUT NOT TOUCHING (this fence has never scanned design/, and at least
    // one live instance - DayKind's single-letter codes in DayCell.kt -
    // would need a stated exemption, not a silent pass, before it could).
    // ------------------------------------------------------------------
    // R461: :app ONLY, and correct - ui/ and dev/ are Jetpack Compose, which commonMain cannot hold.
    // R460 is already delivered by the isNotEmpty() below: a renamed root scans zero files and fails here.
    @Test
    fun uiAndDevFilesCarryNoStringLiteral() {
        val files = ktFiles("ui") + ktFiles("dev")
        assertTrue("no-inline-string fence scanned no files - ui//dev/ renamed? (F7 vacuity guard)", files.isNotEmpty())
        val offenders = mutableListOf<String>()
        for (file in files) {
            val text = stripComments(file.readText())
            val match = Regex(""""[^"]+"""").find(text)
            if (match != null) {
                offenders += "${file.path}: string literal ${match.value} in ui//dev/ - French copy must come from fr/"
            }
        }
        assertTrue("no-inline-string fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 5 - ui/ writes entries only through EntryRepository; no screen
    // calls the API or DAO directly. A stub today - the rule exists before
    // the thing it governs (data/remote and data/local do not exist yet).
    //
    // KNOWN LIMIT (found by the required evasion attempt): a split
    // concatenation ("direct " + "Da" + "o access") evades this, same as
    // fence 2a's split-string gap. See REPORT-AN1.txt.
    // ------------------------------------------------------------------
    // R461: :app ONLY, and correct - ui/ is Jetpack Compose, which commonMain cannot hold. R460 is already
    // delivered by the isNotEmpty() below: a renamed ui/ scans zero files and fails here by name.
    @Test
    fun uiNeverReferencesDataRemoteOrDataLocalDirectly() {
        val forbidden = listOf("""\bdata\.remote\b""", """\bdata\.local\b""", """\bRetrofit\b""", """\bDao\b""")
        val files = ktFiles("ui")
        assertTrue("repository-only fence scanned no files - ui/ renamed? (F7 vacuity guard)", files.isNotEmpty())
        val offenders = mutableListOf<String>()
        for (file in files) {
            val text = stripComments(file.readText())
            if (forbidden.any { Regex(it).containsMatchIn(text) }) {
                offenders += "${file.path}: references data/remote, data/local, Retrofit or a Dao directly"
            }
        }
        assertTrue("repository-only fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 6 - no Material default shape or elevation (D37). Scoped to
    // Card(...) in ui/, the one M3 component this project currently calls
    // that carries a non-zero default elevation and a non-token default
    // shape (Surface's own defaults are already a zero-elevation rectangle,
    // so it is not a live risk today - extend this list the day a second
    // M3 component with a real default is called).
    //
    // STRENGTHENED after the required evasion attempt: a first draft only
    // checked for the PRESENCE of `shape =` / `elevation =`, and
    // `shape = CardDefaults.shape, elevation = CardDefaults.cardElevation()`
    // satisfied both while being Material's own defaults, spelled out
    // explicitly - passing presence, failing intent. Now also rejects those
    // two exact default-accessor spellings. Still name-based, so a THIRD hop
    // (`val d = CardDefaults.shape; Card(shape = d, ...)`) would evade this
    // too - same limitation class as fences 2/3, not chased further here.
    // ------------------------------------------------------------------
    // R461: :app ONLY, and correct - ui/ is Jetpack Compose, which commonMain cannot hold. R460 is already
    // delivered by the isNotEmpty() below: a renamed ui/ scans zero files and fails here by name.
    @Test
    fun everyCardInUiIsThemedWithExplicitShapeAndElevation() {
        // F7 (AN-FIX) vacuity guard: assert the directory was scanned, so a renamed ui/ fails rather than
        // passing on zero files. NOTE: this fence finds ZERO Material3 Card(...) calls today - the project
        // themes with Surface by design (see this fence's header), and the custom CalendarCard/Identification
        // Card/SectionCard composables are not the Material Card the \bCard\( scan matches. So a "found the
        // element" guard would WRONGLY fail the deliberate Surface-over-Card choice; the files guard is the
        // right one here, and the fence correctly checks each Material Card the day one is added to ui/.
        val files = ktFiles("ui")
        assertTrue("Material-default fence scanned no files - ui/ renamed? (F7 vacuity guard)", files.isNotEmpty())
        val offenders = mutableListOf<String>()
        for (file in files) {
            val text = stripComments(file.readText())
            for (args in callArgumentSpans(text, "Card")) {
                val isThemed = cardArgsAreThemed(args)
                if (!isThemed) {
                    offenders +=
                        "${file.path}: Card(...) missing explicit shape/elevation," +
                        " or spelling out a Material default"
                }
            }
        }
        assertTrue("Material-default fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 7 (D16, AN6a increment 4) - detection/ proposes, it never
    // records. A proposal is a value; only the person's confirming tap
    // writes an entry. So no file under detection/ may reach the
    // entry-write path (EntryRepository / RecordCommand). The tally it
    // DOES write (TallyDao) is not an entry - that distinction is the
    // whole of D16. Proven by a plant (REPORT-AN6a.txt): a reference to
    // EntryRepository placed in detection/ turns this red.
    // ------------------------------------------------------------------
    // R461: :app ONLY, and correct - detection/ is Android (location, WorkManager, Notification) and has
    // no counterpart in :shared commonMain. R460 is already delivered by the isNotEmpty() below: ktFiles()
    // returns an empty list for a missing directory, and the assertion turns that into a named failure.
    @Test
    fun detectionNeverWritesAnEntry() {
        val forbidden = listOf("""\bEntryRepository\b""", """\bRecordCommand\b""")
        val files = ktFiles("detection")
        assertTrue("D16 fence scanned no files - detection/ renamed? (F7 vacuity guard)", files.isNotEmpty())
        val offenders = mutableListOf<String>()
        for (file in files) {
            val text = stripComments(file.readText())
            if (forbidden.any { Regex(it).containsMatchIn(text) }) {
                offenders += "${file.path}: detection/ reaches the entry-write path (D16 - a proposal is not a record)"
            }
        }
        assertTrue("D16 fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 8 (AN-HOME, R269) - no raw animation-duration literal in ui/
    // or design/; a duration comes from the Motion token set, never typed
    // inline ("never a duration typed inline", AN-HOME relay; DESIGN-SYSTEM
    // section 1 motion values). PORTED BEFORE AN-HOME's animation code so it
    // guards that code's own commits, not a frozen tree (R269) - the sibling
    // of Fence 3 one category over (durations, not .dp).
    //
    // Tokens.kt is the one place the raw motion values (200/250/300) live,
    // as the set's definition - excluded, exactly as Fence 3 excludes it.
    //
    // KNOWN LIMIT (same class as fences 2/3): a one-hop indirection
    // (`val d = 200; tween(d)`) moves the literal off the call-site anchor
    // and evades this text scan. Proven to fire by a planted `tween(200)`
    // (R178/R180), reverted - there were no live instances when it landed.
    // ------------------------------------------------------------------
    // R461: :app ONLY, and correct - ui/ and design/ are Jetpack Compose, which commonMain cannot hold.
    // R460 is already delivered by the isNotEmpty() below: a renamed root scans zero files and fails here.
    @Test
    fun uiAndDesignHaveNoRawAnimationDurationLiteral() {
        val tokenDefinitionFiles = setOf(File(appSrcRoot, "design/Tokens.kt").canonicalFile)
        val scanned =
            (ktFiles("ui") + ktFiles("design") + ktFiles("dev")).filterNot { it.canonicalFile in tokenDefinitionFiles }
        assertTrue("duration fence scanned no files - ui//design/ renamed? (F7 vacuity guard)", scanned.isNotEmpty())

        val offenders = mutableListOf<String>()
        for (file in scanned) {
            val text = stripComments(file.readText())
            if (Regex("""\btween\s*(<[^>]+>)?\s*\(\s*\d""").containsMatchIn(text)) {
                offenders += "${file.path}: tween(...) with a raw numeric duration - use a Motion token"
            }
            if (Regex("""\b(durationMillis|delayMillis)\s*=\s*\d""").containsMatchIn(text)) {
                offenders += "${file.path}: raw durationMillis/delayMillis literal - use a Motion token"
            }
        }
        assertTrue("duration fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }

    // ------------------------------------------------------------------
    // Fence 9 (AN-ONBOARD-2, R337) - the light brand tint has ONE home:
    // LightColors.brandSoft in design/Tokens.kt. No file anywhere else may
    // write `brand.copy(alpha = ...)`, the derived-at-the-use-site form
    // PARKAN-42 shipped before the token was named. Closing PARKAN-42 is
    // naming the token once and fencing the open-coded form everywhere else,
    // so a second use site cannot drift back to a bare alpha (R206: one text,
    // one home).
    //
    // SCOPED TO THE WHOLE APP SOURCE, not just ui//design/: the brand token is
    // a colour and `.copy(alpha=)` on it is a colour definition, so the only
    // legitimate place for it is the token file itself. Tokens.kt is excluded
    // exactly as Fence 3 excludes it - it IS the one home, where brandSoft is
    // DEFINED as brand.copy(alpha = 0.08f).
    //
    // The guard's first run found the LIVE instance (OnboardingKit.kt's
    // BrandCircle), which is the proof the class existed (R178); the planted
    // violation is redundant but was run too (R180, reverted) - see
    // REPORT-AN-ONBOARD-2.txt.
    //
    // KNOWN LIMIT (same class as fences 2/3): a one-hop indirection
    // (`val c = LightColors.brand; c.copy(alpha = 0.5f)`) moves the receiver
    // off the `brand.copy` anchor and evades this text scan.
    // ------------------------------------------------------------------
    // R461: :app ONLY, and correct - the brand tint is a design/ token and Compose colour, and commonMain
    // holds no design tokens. R460 is already delivered by the isNotEmpty() below.
    @Test
    fun theBrandTintHasOneHomeAndIsNotOpenCodedElsewhere() {
        val tokensFile = File(appSrcRoot, "design/Tokens.kt").canonicalFile
        val scanned =
            appSrcRoot.walkTopDown()
                .filter { it.isFile && it.extension == "kt" }
                .filterNot { it.canonicalFile == tokensFile }
                .toList()
        assertTrue("brandSoft fence scanned no files - app root renamed? (F7 vacuity guard)", scanned.isNotEmpty())

        val pattern = Regex("""\bbrand\.copy\s*\(\s*alpha\s*=""")
        val offenders = mutableListOf<String>()
        for (file in scanned) {
            val text = stripComments(file.readText())
            if (pattern.containsMatchIn(text)) {
                offenders +=
                    "${file.path}: brand.copy(alpha = ...) outside design/Tokens.kt - " +
                    "use LightColors.brandSoft (R337)"
            }
        }
        assertTrue("brandSoft fence violated:\n${offenders.joinToString("\n")}", offenders.isEmpty())
    }
}
