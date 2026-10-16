package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * R379: :app:gate refuses to start when the working tree differs from the index.
 *
 * WHAT THIS DEFECT LOOKED LIKE. KMP-0 commits d808d05 and dfffee9 committed `java.time` imports
 * into commonMain - the one thing R369's platform-free fence exists to forbid - with every check
 * green:
 *
 *     git mv <file> shared/...              the move is STAGED
 *     <edit it to use kotlinx-datetime>     the edit is UNSTAGED
 *     ./gradlew :app:gate                   compiles the WORKING TREE: green
 *     git commit                            commits the INDEX: the edit is not in it
 *
 * Gradle compiled what was on disk; git committed what was in the index. Each tool was correct
 * about its own input, and none of them was positioned to notice they had diverged.
 *
 * WHY THIS TEST READS THE BUILD SCRIPT INSTEAD OF EXERCISING THE GUARD. A JUnit test runs INSIDE
 * the build it would have to drive; it cannot start a second Gradle, and a guard that fires in
 * `taskGraph.whenReady` has by definition already decided before any test executes. So the
 * behaviour is proven empirically and recorded in REPORT-FW-GATE-CLEAN.txt - refused in 3 s
 * naming the file, then green once the edit was reverted - and what is asserted here is the part
 * that rots silently: that the guard is still WIRED, and still wired to the thing that makes it
 * fire before anything is built.
 *
 * A guard with no enforcement point is a comment (CLAUDE.md), and the way this one would stop
 * enforcing is somebody deleting the block while chasing an unrelated build failure.
 */
class CleanWorktreeGuardTest {
    private val buildScript: String by lazy {
        // The test runs with a working directory inside app/, so the script is beside it.
        val candidates =
            listOf(
                File("build.gradle.kts"),
                File("app/build.gradle.kts"),
                File("../app/build.gradle.kts"),
            )

        val found = candidates.firstOrNull { it.isFile }

        requireNotNull(found) {
            "app/build.gradle.kts not found from ${File(".").absolutePath} - this test reads it"
        }.readText()
    }

    @Test
    fun theGuardIsStillPresent() {
        assertTrue(
            "R379: the clean-worktree guard is gone from app/build.gradle.kts",
            buildScript.contains("GATE REFUSED TO START (R379)"),
        )
    }

    @Test
    fun theGuardRunsBeforeAnyTaskExecutes() {
        // IT MUST BE IN THE TASK GRAPH, NOT A dependsOn TASK. dependsOn gives no ordering
        // guarantee against the gate's other dependencies, so a compile could run - and a stale
        // build directory be produced - before a doLast ever fired. The task graph is resolved
        // before ANY task executes, which is the last moment at which nothing has happened yet.
        assertTrue(
            "R379: the guard no longer runs in gradle.taskGraph.whenReady, so it no longer " +
                "refuses to START - it would fail somewhere in the middle instead",
            buildScript.contains("gradle.taskGraph.whenReady"),
        )
    }

    @Test
    fun theGuardChecksUnstagedChangesToTrackedFilesOnly() {
        // `git diff` with no revision argument is exactly "tracked files whose working-tree
        // content differs from the index" - the gap that produced the defect. Adding --cached or
        // HEAD here would change what it means: --cached would compare the index to HEAD and
        // ignore the working tree entirely, which is the opposite guard.
        //
        // Untracked files must stay out of it: local.properties, .kotlin/ and a session lock are
        // all untracked, all normal, and none can reach a commit by accident.
        assertTrue(
            "R379: the guard no longer reads `git diff --name-only`",
            buildScript.contains("\"git\", \"diff\", \"--name-only\""),
        )
    }

    @Test
    fun theGuardOnlyAppliesToTheGate() {
        // It must not fire on an ordinary `./gradlew assembleDebug` during development: a guard
        // that blocks every build while somebody is editing would be switched off the same day.
        assertTrue(
            "R379: the guard no longer scopes itself to the gate task",
            buildScript.contains(":app:gate"),
        )
    }
}
