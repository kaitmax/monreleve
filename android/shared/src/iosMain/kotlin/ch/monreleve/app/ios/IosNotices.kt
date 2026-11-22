package ch.monreleve.app.ios

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import ch.monreleve.app.NoticeSink
import ch.monreleve.app.design.Spacing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

// IOS-SHELL-2 (R1331, PARK-IF2). iOS's SIDE OF THE ONE NOTICE SEAM (NoticeSink, commonMain NoticeSink.kt): what
// Android shows as a Toast, iOS shows as a transient notice at the bottom of the app's window, drawn by IosShellRoot
// above whatever screen is open. It asks nothing back and goes by itself after NOTICE_MILLIS (a Toast's LENGTH_LONG,
// 3.5 s); a second message replaces the first. No message is new: each site passes the copy constant its Android Toast
// passes (R206).
//
// THE DISMISSAL RUNS ON THE SHELL'S SCOPE, in wall time, not on the composition's frame clock - so a test reads the
// notice on screen before it goes, rather than racing a clock the test harness advances by itself.

/** One notice: its text, and a sequence number so the same text twice is two notices. */
data class IosNotice(
    val sequence: Long,
    val text: String,
)

/** The process's notices: the one on screen now (or null), and every text shown, in order. */
class IosNotices(
    private val scope: CoroutineScope,
) : NoticeSink {
    private val now = MutableStateFlow<IosNotice?>(null)
    private var next = 0L

    /** The notice on screen, or null. */
    val current: StateFlow<IosNotice?> = now

    override fun show(message: String) {
        val notice = IosNotice(next++, message)
        now.value = notice
        scope.launch {
            delay(NOTICE_MILLIS)
            // Only the notice this call put up: a newer one stays its full time.
            now.compareAndSet(notice, null)
        }
    }

    internal companion object {
        /** Android's Toast.LENGTH_LONG. */
        const val NOTICE_MILLIS = 3_500L
    }
}

/** The notice on screen, at the bottom of the window, above [content]. */
@Composable
fun IosNoticeHost(
    notices: IosNotices,
    content: @Composable () -> Unit,
) {
    val notice by notices.current.collectAsState()
    Box(modifier = Modifier.fillMaxSize()) {
        content()
        notice?.let {
            Snackbar(modifier = Modifier.align(Alignment.BottomCenter).padding(Spacing.space16)) {
                Text(text = it.text)
            }
        }
    }
}
