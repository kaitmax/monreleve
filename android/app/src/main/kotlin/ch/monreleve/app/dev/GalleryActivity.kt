package ch.monreleve.app.dev

// AN3 increment 6. The only way to reach GalleryScreen: no LAUNCHER
// intent-filter, so it never appears in the app drawer and nothing in
// MainActivity links to it - reached only by naming this component
// directly, exactly as AndroidManifest.xml's own comment on the entry
// records:
//   adb shell am start -n ch.monreleve.app/ch.monreleve.app.dev.GalleryActivity
//
// EXPORTED, DELIBERATELY (a judgement call, recorded here and in
// REPORT-AN3.txt's DEVIATIONS rather than left silent): a non-exported
// activity refuses adb's shell UID on stock AOSP, which is the one
// caller this activity exists for. The screen itself carries no user
// data, no auth, no network call and no write path - every value on it
// is a literal example, the same ones AN3's own screenshot tests use -
// so exported=true costs nothing a real screen would have to guard.
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent

class GalleryActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { GalleryRoot() }
    }
}
