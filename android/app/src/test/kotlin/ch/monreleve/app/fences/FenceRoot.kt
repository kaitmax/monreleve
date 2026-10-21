package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import java.io.File

/**
 * AN-FENCE-ROOTS (R460). A FENCE PROVES IT FOUND ITS SUBJECT, OR IT FAILS LOUDLY.
 *
 * WHAT THIS EXISTS TO STOP, stated as the thing that happened rather than as a principle.
 * KMP-3 repointed AccountCaptureFenceTest at both source trees and showed it RED on a planted
 * capture. It then removed the second root and re-ran against THE SAME LIVE PLANT: the fence
 * PASSED. A fence scanning one tree certifies a live frozen capture as clean, and nothing in its
 * output says it has stopped looking at half of what it guards (R452).
 *
 * THE FAILURE IS NOT "THE SCAN FOUND NOTHING", IT IS "THE SCAN FOUND NOTHING AND SAID NOTHING".
 * Every fence in this project reports an ABSENCE - no offending line, no unreachable string, no
 * bare threshold - and an absence assertion is satisfied by absence (R154, R169). Point one at a
 * directory that is not there and it reports perfect compliance over zero files.
 *
 * THE THREE PATTERNS THAT PRODUCE IT, all live in this repository before this task:
 *     roots.filter { it.exists() }              a root that moved contributes nothing, silently
 *     if (!dir.exists()) emptyList()            the same, one layer down
 *     if (!dir.exists()) continue               a per-root presence check that skips the absent root
 * Each is individually reasonable and each converts "the subject moved" into "there was nothing
 * to find", which is the one outcome a fence must never report as a pass.
 *
 * A COMBINED COUNT DOES NOT CLOSE IT, which is why each root is asserted SEPARATELY. KMP-3 found
 * this the hard way: a total file count stays comfortably over any threshold with one root missing
 * entirely. So does `files.isNotEmpty()`.
 *
 * AND A COUNT DOES NOT PROVE THE RIGHT DIRECTORY, which is why each root carries a PIN - the name
 * of a file only that root can hold. A root that resolves to somebody else's sources then fails
 * rather than passing over them.
 *
 * OPTIONAL ROOTS STATE THEIR REASON (R206's corollary - asserted beats merely absent). The one
 * case today is app/src/release/kotlin, which has never existed: :app has no release-only Kotlin.
 * Declaring that as a sentence, asserted non-trivial, means a second optional root has to survive
 * its own argument rather than joining an established habit.
 */
internal class FenceRoot(
    /** The directory this fence walks, relative to the Gradle test working directory (the module dir). */
    val dir: File,
    /** The name of a file only THIS root can hold - so a root resolving elsewhere fails. */
    val pin: String,
    /** Non-null when the root may legitimately be absent; the string is the reason, and it is asserted. */
    val optionalBecause: String? = null,
)

/**
 * Asserts every required root exists, holds Kotlin, and holds its pin - each root on its own, and
 * each failure naming the fence, what it looked for and the absolute path it looked in.
 */
internal fun List<FenceRoot>.assertFound(fence: String) {
    assertTrue("$fence declares no roots at all - there is nothing for it to guard", isNotEmpty())
    for (root in this) {
        if (!root.dir.isDirectory) {
            // A REQUIRED root that is NOT THERE is the case this whole mechanism exists for, so it gets
            // its own message. The first version of this function folded it into the optional-reason
            // assertion below, so a missing src/main/kotlin would have failed with "is declared OPTIONAL
            // but states no reason" - which is false, misdirects the reader, and names no path. It was
            // invisible because every empty-root demo pointed a fence at an EXISTING EMPTY directory and
            // drove the branch below instead: the mechanism's PRIMARY message was the one thing in it
            // that nothing had exercised (R133/R180, pointed at this guard rather than at a fence).
            val reason = root.optionalBecause
            assertTrue(
                "$fence: the root ${root.dir.path} DOES NOT EXIST (looked in ${root.dir.absolutePath}) - " +
                    "its subject moved, or the working directory is not the module. A fence pointed at " +
                    "nothing reports perfect compliance (R460).",
                reason != null,
            )
            assertTrue(
                "$fence: the root ${root.dir.path} is declared OPTIONAL but states no reason " +
                    "(R206 - an exemption argues for itself)",
                (reason?.length ?: 0) > 20,
            )
            continue
        }
        val found = root.dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        assertTrue(
            "$fence: the root ${root.dir.path} holds no Kotlin at all " +
                "(looked in ${root.dir.absolutePath}) - a fence that scans nothing reports perfect compliance",
            found.isNotEmpty(),
        )
        assertTrue(
            "$fence: the root ${root.dir.path} does not hold ${root.pin}, the file that identifies it " +
                "(looked in ${root.dir.absolutePath}). Either the subject moved - widen this fence the way " +
                "R459 widened the others - or this root now resolves to somebody else's sources.",
            found.any { it.name == root.pin },
        )
    }
}

/** Every Kotlin file under the roots that exist. Call [assertFound] first - the walk cannot report its own gaps. */
internal fun List<FenceRoot>.ktFiles(): List<File> =
    filter { it.dir.isDirectory }
        .flatMap { it.dir.walkTopDown().filter { f -> f.isFile && f.extension == "kt" }.toList() }

/**
 * A fence whose subject is a NAMED FILE rather than a tree: the same guarantee, one file at a time.
 * Returns the file so a caller can read it, and fails naming the fence, the file and where it looked.
 */
internal fun subjectFile(
    fence: String,
    path: String,
): File {
    val file = File(path)
    assertTrue(
        "$fence: its subject $path is not there (looked at ${file.absolutePath}). A fence whose subject " +
            "moved must fail here rather than scan an empty set and pass (R460).",
        file.isFile,
    )
    return file
}
