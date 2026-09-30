package ch.monreleve.probe

import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.TextView
import java.io.File

// AN-AUDIT increment 4 - the second app (a DIFFERENT applicationId, therefore a DIFFERENT Linux UID) that
// tries to read ch.monreleve.app's private data across the Android sandbox. It reports a STATUS per attempt,
// never a value (R198): DENIED (the sandbox held), or LEAK (a read succeeded). A LEAK on the token store is the
// FW30 stop rule - a token readable by another app.
//
// A POSITIVE CONTROL runs first (read a file the probe CAN read, its own filesDir) so that an all-DENIED
// result cannot be mistaken for a broken probe (R133/R180): denials mean the sandbox held only once the probe
// has shown it can read anything at all.
//
// SIGNATURE NOTE: on the emulator both apps are debug-signed with the SAME key, so this probe is a STRONGER
// attacker than a real third-party app would be (it shares signature-level permissions). A denial here is
// therefore conclusive; any success would have to be checked for whether the shared signature enabled it.

private const val TAG = "AN_PROBE"
private const val VICTIM = "ch.monreleve.app"

class ProbeActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val out = StringBuilder()
        fun line(s: String) {
            out.append(s).append('\n')
            Log.i(TAG, s)
        }

        line(control())
        line(readFile("AUTH tokens", "/data/data/$VICTIM/shared_prefs/monreleve.auth.xml"))
        line(readFile("DOSSIER cache", "/data/data/$VICTIM/shared_prefs/monreleve.dossier.xml"))
        line(readFile("SETTINGS", "/data/data/$VICTIM/shared_prefs/monreleve.settings.xml"))
        line(readFile("ROOM db", "/data/data/$VICTIM/databases/monreleve.db"))
        line(fileProvider())

        val view = TextView(this)
        view.text = out.toString()
        setContentView(view)
    }

    // The probe can read its OWN files. If this fails, every DENIED below is meaningless.
    private fun control(): String =
        try {
            val self = File(filesDir, "probe-selftest.txt")
            self.writeText("probe-can-read-its-own-files")
            if (self.readText().isNotEmpty()) {
                "CONTROL own filesDir: READ OK (probe works)"
            } else {
                "CONTROL own filesDir: EMPTY (probe broken)"
            }
        } catch (e: Exception) {
            "CONTROL own filesDir: FAILED (${e.javaClass.simpleName}) - probe broken, denials below are meaningless"
        }

    // A LEAK line here on the AUTH store is the FW30 stop rule. Expected: DENIED (the per-app UID sandbox).
    private fun readFile(
        label: String,
        path: String,
    ): String =
        try {
            val bytes = File(path).readBytes()
            "LEAK $label: READ ${bytes.size} bytes across the sandbox"
        } catch (e: Exception) {
            "DENIED $label: ${e.javaClass.simpleName}"
        }

    // The FileProvider is exported=false and grants are per-share; a read without a grant must be refused.
    private fun fileProvider(): String =
        try {
            val uri = Uri.parse("content://$VICTIM.fileprovider/exports/releve.pdf")
            contentResolver.openInputStream(uri)?.use { it.readBytes() }
            "LEAK FileProvider: opened $uri without a grant"
        } catch (e: Exception) {
            "DENIED FileProvider: ${e.javaClass.simpleName}"
        }
}
