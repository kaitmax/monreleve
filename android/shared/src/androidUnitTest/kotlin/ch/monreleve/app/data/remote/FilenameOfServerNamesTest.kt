package ch.monreleve.app.data.remote

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN-SHARED-FIXES (R1092). EVERY NAME THE SERVER SENDS STILL PASSES filenameOf UNCHANGED.
 *
 * FilenameOfTest (commonTest) proves the refusals. This proves the other direction - that the check refuses none of
 * the names the product actually sends - and it reads those names from the SERVER, not from a list kept here (R181):
 *
 *   1. Every `content-disposition` header template under web/app and web/lib is found by scanning the source, so an
 *      export route added tomorrow is in this test the day it is written.
 *   2. Each template is RESOLVED to concrete names: `${year}` -> the year the server's own CSV tests use; a call to
 *      csvFilename(...) -> every name web/tests/unit/export/csv.test.ts asserts csvFilename returns (the server's own
 *      expectations of its own function); a bare `${variable}` -> the literals and csvFilename-derived forms of that
 *      variable's `const` in the same file. A template this cannot resolve FAILS, naming it - never skipped.
 *   3. Each name is sent through the server's own header template - `attachment; filename="<name>"` as the route
 *      writes it - and must come back from filenameOf exactly as sent.
 *
 * androidUnitTest, not commonTest: reading web/ needs file access, which commonTest has not got on iOS. The files
 * read are declared as Test inputs in shared/build.gradle.kts (R283), so a server rename re-runs this.
 */
class FilenameOfServerNamesTest {
    private val web = File("../../web")

    private fun read(relative: String): String {
        val file = File(web, relative)
        check(file.isFile) { "${file.absolutePath} not found - no server name can be derived from a missing file" }
        return file.readText()
    }

    /** The names web/'s own tests assert csvFilename returns (R181: the server's expectations, not a copy here). */
    private val csvNames: List<String> by lazy {
        CSV_EXPECTATION.findAll(read(CSV_TEST)).map { it.groupValues[1] }.toList()
    }

    private class Site(
        val file: File,
        val source: String,
        val headerTemplate: String,
        val nameTemplate: String,
    )

    private val sites: List<Site> by lazy {
        listOf("app", "lib").flatMap { root ->
            val dir = File(web, root)
            check(dir.isDirectory) { "${dir.absolutePath} not found" }
            dir.walkTopDown()
                .filter { it.isFile && (it.extension == "ts" || it.extension == "tsx") }
                .flatMap { file ->
                    val source = file.readText()
                    DISPOSITION.findAll(source).map { match ->
                        Site(file, source, match.groupValues[1], match.groupValues[2])
                    }
                }.toList()
        }
    }

    private fun resolve(site: Site): List<String> {
        val template = site.nameTemplate.replace("\${year}", YEAR)
        return when {
            !template.contains("\${") -> listOf(template)
            CSV_CALL.matches(template) -> csvNames
            else -> {
                val variable =
                    BARE_VARIABLE.matchEntire(template)?.groupValues?.get(1)
                        ?: error("unrecognised filename template `${site.nameTemplate}` in ${site.file}")
                resolveVariable(site, variable)
            }
        }
    }

    private fun resolveVariable(
        site: Site,
        variable: String,
    ): List<String> {
        val declaration =
            Regex("""const\s+$variable\s*=(.*?);""", RegexOption.DOT_MATCHES_ALL).find(site.source)?.groupValues?.get(1)
                ?: error("`$variable` (the filename in ${site.file}) has no const declaration to resolve")
        val literals = FILE_LITERAL.findAll(declaration).map { it.groupValues[1] }.toList()
        val fromCsv =
            if (declaration.contains("csvFilename(")) {
                val renames = REPLACE_CALL.findAll(declaration).map { it.groupValues[1] to it.groupValues[2] }.toList()
                csvNames.map { name -> renames.fold(name) { acc, (from, to) -> acc.replace(from, to) } }
            } else {
                emptyList()
            }
        val names = literals + fromCsv
        check(names.isNotEmpty()) { "`$variable` in ${site.file} resolved to no name" }
        return names
    }

    @Test
    fun everyNameTheServerSendsPassesThroughUnchanged() {
        // Presence first (R169): the scan and the server's CSV expectations both found something.
        assertTrue("no content-disposition header found under web/app or web/lib", sites.isNotEmpty())
        assertTrue("no csvFilename expectation found in $CSV_TEST", csvNames.isNotEmpty())

        val checked =
            sites.flatMap { site ->
                resolve(site).map { name ->
                    val header = site.headerTemplate.replace("filename=\"${site.nameTemplate}\"", "filename=\"$name\"")
                    assertEquals(
                        "the server's name from ${site.file.name} must pass filenameOf unchanged",
                        name,
                        filenameOf(mapOf("content-disposition" to header)),
                    )
                    name
                }
            }

        // Every kind of file the server exports is among the names checked - none was lost to a resolver gap.
        listOf(".pdf", ".csv", ".json").forEach { extension ->
            assertTrue("no server $extension name was checked: $checked", checked.any { it.endsWith(extension) })
        }
    }

    private companion object {
        const val CSV_TEST = "tests/unit/export/csv.test.ts"

        /** The year web/'s csv.test.ts passes to csvFilename, read from the names it expects. */
        val YEAR: String by lazy {
            Regex("""releve-(\d{4})""").find(File("../../web/$CSV_TEST").readText())?.groupValues?.get(1)
                ?: error("no year found in $CSV_TEST")
        }

        /** `'content-disposition': `attachment; filename="..."`` - group 1 the header, group 2 the name template. */
        val DISPOSITION =
            Regex("""['"]content-disposition['"]\s*:\s*`([^`]*filename="([^"]*)"[^`]*)`""", RegexOption.IGNORE_CASE)
        val CSV_CALL = Regex("""\$\{csvFilename\([^)]*\)}""")
        val BARE_VARIABLE = Regex("""\$\{(\w+)}""")
        val FILE_LITERAL = Regex("""'([\w.-]+\.\w+)'""")
        val REPLACE_CALL = Regex("""\.replace\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)""")
        val CSV_EXPECTATION = Regex("""\.toBe\(\s*'(releve-[^']*\.csv)'""")
    }
}
