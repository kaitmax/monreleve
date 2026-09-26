package ch.monreleve.app.calc

import java.io.File

/**
 * The repository root. Gradle's test task working directory is the module
 * directory (android/app/), so the repository root is two levels up.
 */
internal fun repoRoot(): File {
    val moduleDir = File(".").canonicalFile

    return checkNotNull(moduleDir.parentFile?.parentFile) {
        "expected two parent directories above $moduleDir (android/app/ -> android/ -> repo root)"
    }
}

/**
 * Resolves fixtures/ at the repository root, shared by every conformance
 * suite reading a fixture JSON file directly - the SAME files the
 * TypeScript engine reads (R206, one home).
 */
internal fun fixtureFile(name: String): File {
    val moduleDir = File(".").canonicalFile
    val file = File(repoRoot(), "fixtures/$name")

    check(file.exists()) {
        "fixture not found: ${file.absolutePath} (resolved from module dir $moduleDir - " +
            "if Gradle's test working directory ever changes, this resolution needs updating)"
    }

    return file
}
