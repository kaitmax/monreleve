package ch.monreleve.app.fences

// AN3 increment 0 (R269, from AN2's close-out review). R238's own shape:
// every exported copy string under fr/ is reachable from ui/ or design/,
// or declared unreachable with a stated reason.
//
// WHY THIS EXISTS, matching the web-side finding this ports rather than
// merely citing it: web/lib/fr/dossier.ts held four strings no surface
// reached, one of them the product's headline answer - each individually
// well-formed French, passing every typography guard, found only by
// somebody reading the module against the page it was meant for. This
// generalises that reading into a failing test rather than a discovery
// tasks later, on the Android side before it has the chance to accumulate
// the same way.
//
// design/ ADDED IN AN3 INCREMENT 3, FOUND NECESSARY RATHER THAN ASSUMED:
// this fence's own first run after ThresholdRail.kt (design/rail/) started
// reading Fr.APP_NAME reported it as an orphan, because increment 0 scoped
// the rendered-text scan to ui/ alone - the only surface that existed
// then. Components live in design/, not ui/ (ui/ holds screens that
// compose them), so the census was blind to the one place AN3 actually
// writes.
//
// dev/ ADDED, AND THE CENSUS ITSELF WIDENED, IN AN3 INCREMENT 6. The
// census only ever matched `const val` inside an `object` - true of every
// copy constant increment 2-4 happened to add, so nothing had failed. But
// fr/MetricCopy.kt's `remaining`/`over` are `fun`, not `const val`, and
// this file's own first attempt to build dev/GalleryScreen.kt's tile
// section found them referenced NOWHERE in ui/ or design/ - a real,
// live orphan (R178), not a planted one: MetricTile shipped in increment
// 4 with its label/overLabel props always supplied by the CALLER, and no
// caller had existed until this gallery. The census was blind to it only
// because `fun` was never a shape it looked for; STATUS_COPY (a top-level
// `val` map, not `const val`) is the same blind spot and is, separately,
// already genuinely reached (design/ZoneTokens.kt) - proof the miss was in
// the SCANNER, not (only) in the reached-ness of the copy itself.
//
// Widened to also match a top-level (column-0) `val`/`fun` - referenced
// bare, matching how such a declaration is actually called - and an
// object-member (column-4) `val`/`fun` alongside the pre-existing `const
// val` - referenced `Object.name`, exactly as before. `private` entries
// are excluded either way: nothing outside the file can be reaching them,
// so there is nothing for a surface census to prove. Anchored to the
// START of a line (multiline mode) rather than matched anywhere in the
// text, deliberately: a `val` inside a function body (DayCellCopy.kt's own
// `contentDescription` has three) sits at a deeper indent than either
// column and is excluded by construction, and a data class's constructor
// property (`data class StatusCopy(val label: String, ...)`) never starts
// a line at all - both would otherwise read as fresh, ungrounded entries.

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

private val FR_DIR = File("src/main/kotlin/ch/monreleve/app/fr")
private val SURFACE_DIRS =
    listOf(
        File("src/main/kotlin/ch/monreleve/app/ui"),
        File("src/main/kotlin/ch/monreleve/app/design"),
        File("src/main/kotlin/ch/monreleve/app/dev"),
    )

private fun ktFiles(dir: File): List<File> =
    if (!dir.exists()) emptyList() else dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

/**
 * Comments are stripped before matching - found necessary on this exact
 * file, not assumed: an earlier draft's own KDoc explaining "wrapped in an
 * object rather than left as top-level consts" contained the literal
 * substring "object rather", which OBJECT_NAME matched before ever
 * reaching the real `object RailCopy {` declaration below it, and every
 * reference this file generated was reported under the wrong name. The
 * other fences in this package (FencesTest.kt) already strip comments for
 * the identical reason; this one had not, because it predates the KDoc
 * that broke it.
 */
private fun stripComments(text: String): String {
    return text.replace(Regex("""/\*[\s\S]*?\*/"""), " ").replace(Regex("""//[^\n]*"""), " ")
}

/** The enclosing `object Name` a const belongs to - this codebase's convention is one per file. */
private val OBJECT_NAME = Regex("""object\s+(\w+)""")
private val OBJECT_MEMBER_DECL = Regex("""(?m)^ {4}(private\s+)?(?:const\s+)?(?:val|fun)\s+(\w+)""")
private val TOP_LEVEL_DECL = Regex("""(?m)^(private\s+)?(?:val|fun)\s+(\w+)""")

/**
 * The object's `{ ... }` body, by brace depth - NOT "everything after the
 * `object` keyword", because a file can hold a top-level function BEFORE
 * its object (RailCopy.kt does: `fun railAriaLabel` precedes `object
 * RailCopy`). Found necessary rather than assumed: a first version without
 * this span check read `railAriaLabel`'s own local `val spoken = ...` - at
 * the same 4-space indent a real object member sits at, purely by
 * coincidence of both being one indent level deep - as `RailCopy.spoken`,
 * which is not a real reference and would have failed the census on a
 * name nothing outside the file ever calls.
 */
private fun objectBodySpan(text: String): IntRange? {
    val objectMatch = OBJECT_NAME.find(text) ?: return null
    val braceStart = text.indexOf('{', objectMatch.range.last)

    return braceStart.takeIf { it != -1 }?.let { start ->
        var depth = 1
        var i = start + 1
        while (i < text.length && depth > 0) {
            when (text[i]) {
                '{' -> depth++
                '}' -> depth--
            }
            i++
        }
        start..i
    }
}

/** Every `Object.member` or bare top-level `member` reference a copy declaration would be read through. */
private fun copyReferences(): List<String> =
    ktFiles(FR_DIR).flatMap { file ->
        val text = stripComments(file.readText())
        val objectName = OBJECT_NAME.find(text)?.groupValues?.get(1)
        val span = objectBodySpan(text)

        val topLevel =
            TOP_LEVEL_DECL.findAll(text)
                .filter { it.groupValues[1].isEmpty() }
                .map { it.groupValues[2] }

        val members =
            if (objectName == null || span == null) {
                emptySequence()
            } else {
                OBJECT_MEMBER_DECL.findAll(text)
                    .filter { it.groupValues[1].isEmpty() && it.range.first in span }
                    .map { "$objectName.${it.groupValues[2]}" }
            }

        (topLevel + members).toList()
    }

private fun renderedText(): String = SURFACE_DIRS.flatMap { ktFiles(it) }.joinToString("\n") { it.readText() }

/**
 * Strings that no surface reaches TODAY, each naming the state it waits
 * for. An entry without a stated reason is refused by the test below - the
 * same corollary R206 states for NOT_PERSONAL: an exemption argues for
 * itself, or it is not one. "Unused for now" is exactly the note the web
 * side's four orphans would have carried.
 */
private val UNREACHABLE: Map<String, String> =
    mapOf(
        // AN11: the export hand-off strings are rendered by the composition root (MainActivity's share sheet
        // and toasts), which needs an Activity Context, an Intent and a FileProvider - none permitted in ui/,
        // and it carries file-path literals the no-literal fence forbids there. So this copy is reachable, but
        // from the root package rather than a fr-surface directory this census scans.
        "ReleveCopy.EXPORT_CHOOSER_TITLE" to
            "the Intent.createChooser title for the export share sheet, used by MainActivity's platform " +
            "hand-off (a Context/Intent/FileProvider concern the ui/ fence and no-literal fence keep out of ui/)",
        "ReleveCopy.EXPORT_REQUIRES_CONNECTIVITY" to
            "the toast shown when an export cannot reach the server render (SPEC 13.2), raised by MainActivity's " +
            "composition root, which owns the Toast and the platform share - not a fr-surface directory",
        "ReleveCopy.EXPORT_FAILED" to
            "the toast shown when the server could not produce the export, raised by MainActivity's composition " +
            "root, which owns the Toast and the platform share - not a fr-surface directory this census scans",
        // AN12 increment 4: the version line is FORMATTED in MainActivity from BuildConfig.VERSION_NAME/CODE,
        // which the ui/ fence keeps out of ui/, and handed to the stateless screen as a ready string. So the
        // fun is reached from the composition root, not a fr-surface directory - the ReleveCopy.EXPORT_* case.
        "ParametresCopy.version" to
            "the « nom (code) » version line, formatted by MainActivity from BuildConfig (not permitted in ui/) " +
            "and passed to ParametresScreen as a ready string - reached from the composition root, not a surface",
        // R299: the no-browser fallback toast is raised by MainActivity's openLegal (a Context/Toast concern the
        // ui/ fence keeps out of ui/), so it is reached from the composition root, not a fr-surface directory.
        "ParametresCopy.legalNoHandler" to
            "the toast shown when no app can open a legal link (R299), raised by MainActivity's openLegal, which " +
            "owns the Context and the Toast - reached from the composition root, not a fr-surface directory",
        // AN-AUTO increment 5 REMOVED the two detection entries that waited here: DetectionCopy.NOT_SURE is now
        // rendered by the Aujourd'hui auto NotSureBlock (ETAT B withheld) and DetectionCopy.NEAR_BORDER by the
        // near-border notice - both live surfaces, so the census reaches them directly.
        // AN-AUTO increment 3b (R316): the permission-revoked message is a Toast raised by MainActivity's
        // ON_RESUME (a Context/Toast concern the ui/ fence keeps out of ui/), so it is reached from the
        // composition root, not a fr-surface directory this census scans - the ReleveCopy.EXPORT_* toast case.
        "DisclosureCopy.PERMISSION_REVOKED" to
            "the R316 toast shown when the location permission is revoked in system settings, raised by " +
            "MainActivity's ON_RESUME fallback (a Context/Toast concern) - reached from the composition root",
        // R323 / PARKAN-36: the evening proposal notification copy is rendered by the background notifier
        // (detection/EveningNotifier, a Context/NotificationManager concern the ui/ fence keeps out of ui/), so
        // the census reaches it from the worker rather than a fr-surface directory - the ReleveCopy.EXPORT_*
        // /Toast case. The Parametres TOGGLE copy (ParametresCopy.EVENING_*) is reached normally from
        // ParametresScreen and is not listed here.
        "NotificationCopy.CHANNEL_NAME" to
            "the evening-notification channel name shown in system settings, used by EveningNotifier.ensureChannel " +
            "(a NotificationManager concern the ui/ fence keeps out of ui/) - reached from the background notifier",
        "NotificationCopy.CHANNEL_DESCRIPTION" to
            "the evening-notification channel description in system settings, used by EveningNotifier.ensureChannel " +
            "(a NotificationManager concern the ui/ fence keeps out of ui/) - reached from the background notifier",
        "NotificationCopy.publicLines" to
            "the LOCK-SCREEN (public) notification lines, built by EveningNotifier.post (a NotificationManager " +
            "concern the ui/ fence keeps out of ui/) - reached from the background notifier, not a surface",
        "NotificationCopy.privateLines" to
            "the UNLOCKED (private) notification lines, built by EveningNotifier.post (a NotificationManager " +
            "concern the ui/ fence keeps out of ui/) - reached from the background notifier, not a surface",
    )

class CopyReachabilityTest {
    @Test
    fun findsCopyToCheckSoTheCensusIsNotVacuous() {
        val refs = copyReferences()
        val rendered = renderedText()
        assertTrue("expected at least one copy constant under fr/, found none", refs.isNotEmpty())
        assertTrue(
            "expected a surface to carry meaningful content, found ${rendered.length} chars",
            rendered.length > 100,
        )
    }

    @Test
    fun reachesEveryStringOrDeclaresItUnreachableWithItsReason() {
        val rendered = renderedText()
        val orphans = copyReferences().filter { ref -> ref !in rendered && UNREACHABLE[ref] == null }

        assertTrue("no surface (ui/, design/ or dev/) references: ${orphans.joinToString(", ")}", orphans.isEmpty())
    }

    @Test
    fun refusesAnAllowListEntryThatDoesNotNameTheStateItWaitsFor() {
        for ((ref, reason) in UNREACHABLE) {
            assertTrue("$ref has no stated reason", reason.length > 40)
            assertTrue("$ref is not a real copy constant", ref in copyReferences())
        }
    }

    @Test
    fun canTellAnOrphanFromASurfaceThatFailedToLoad() {
        // R133's positive half: an empty rendered text and a fully-reachable
        // copy set both produce zero orphans. This proves the two are
        // distinguishable rather than trusting silence as success.
        val rendered = renderedText()
        assertTrue("expected Fr.GREETING to be referenced somewhere in ui/", rendered.contains("Fr.GREETING"))
        assertTrue(
            "expected a made-up reference to be absent",
            !rendered.contains("Fr.THIS_IS_NOT_A_REAL_CONSTANT"),
        )
    }
}
