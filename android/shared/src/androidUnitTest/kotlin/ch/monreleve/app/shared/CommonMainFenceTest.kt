package ch.monreleve.app.shared

// KMP-0 increment 2 (R369). THE PLATFORM-FREE FENCE. commonMain must compile for iOS the day those targets
// build (R367), so it may not reach for a JVM or Android API. Two layers guard this, not one:
//
//   1. compileCommonMainKotlinMetadata (in :app:gate) compiles commonMain AS COMMON code against the common
//      stdlib only, so an `import java.time.X` fails to resolve there. That is the primary, compiler-level proof.
//   2. THIS text scan. It exists because the Android target compiles commonMain WITH the JVM/Android classpath
//      (java.time IS available there via desugaring), so `import java.time` in a commonMain file compiles
//      cleanly for :shared:testDebugUnitTest even while it breaks the metadata and iOS compilations. A guard
//      that only watched the android compile would miss it; this reads the source as text and fails on the
//      import regardless of which target happens to accept it.
//
// It lives in the Android unit-test source set (not commonTest) because it reads files with java.io.File, which
// commonTest cannot do portably. src/commonMain/kotlin is a declared input of this test task (build.gradle.kts),
// so a new offending file re-runs it (R283). Proven able to fire by planting `import java.time.LocalDate` in a
// commonMain file (REPORT-KMP-0.txt increment 2, R180) and reverting.

import java.io.File
import kotlin.test.Test
import kotlin.test.fail

class CommonMainFenceTest {
    private val commonMain = File("src/commonMain/kotlin")

    // java., javax. (JVM), android., androidx. (Android) - every platform surface commonMain must not touch.
    private val forbiddenImport = Regex("""^\s*import\s+(java|javax|android|androidx)\.""")

    @Test
    fun commonMainImportsNoPlatformApis() {
        // R169 presence: assert the subject exists and is non-empty before asserting anything about it, so the
        // scan cannot pass vacuously against a wrong working directory or an empty tree.
        check(commonMain.isDirectory) {
            "fence: ${commonMain.absolutePath} is not a directory - the working directory is not :shared"
        }
        val kotlinFiles =
            commonMain.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        check(kotlinFiles.isNotEmpty()) {
            "fence: no .kt files under ${commonMain.absolutePath} - the scan would pass vacuously (R169)"
        }

        val offenders =
            kotlinFiles.flatMap { file ->
                file.readLines().mapIndexedNotNull { index, line ->
                    if (forbiddenImport.containsMatchIn(line)) "${file.path}:${index + 1}: ${line.trim()}" else null
                }
            }

        if (offenders.isNotEmpty()) {
            fail(
                "commonMain must be platform-free (R369): no java./javax./android./androidx. imports, so it " +
                    "compiles for iOS. Offending imports:\n" + offenders.joinToString("\n"),
            )
        }
    }
}
