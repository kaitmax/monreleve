package ch.monreleve.app.ios

import platform.Foundation.NSLog

// IOS-1a R571. THE LOGGER LOGS NO PERSON. Every line the iOS side writes goes through here, and nothing a person
// typed or a person's record can come out of it:
//
//   - the only free text is a message the CALLER wrote as a fixed sentence about a condition (R425's canary, a
//     sync outcome name). Nothing in this module passes a note, a name, a token or an email in; this is the
//     second fence, for the day somebody does by accident.
//   - [scrub] removes what the product must never log from any message anyway: an email address, a bearer or
//     refresh token (a long unbroken run of token characters), a calendar day (YYYY-MM-DD, the day a person
//     worked from home is health-adjacent personal data), and a six-digit sign-in code.
//
// NSLog is the sink: it is visible in Console and a crash report's breadcrumbs, but writes nothing the person
// can read back from the app, and os_log is a C macro Kotlin cannot call. NSLog's first argument is a FORMAT, so a
// message containing a percent sign must not be interpreted: [consoleLine] passes the scrubbed line AS the format
// with every % doubled, and nothing as a C vararg.
//
// IOS-MOVE-TABS R1362 (iOS Ruling 13 Q4, THE RUN-B SIGSEGV). This sink used to be NSLog("%@", line) - the line as a
// C variadic argument where %@ expects an Objective-C object. Reproduced before this change, by
// IosLoggerDefaultSinkIosTest calling the real default sink in the test process: ios-shared run 45025248454 printed
// "R1362 BEFORE ordinary", then "Child process terminated with signal 11: Segmentation fault", and wrote no JUnit
// suite - an ORDINARY sentence, no percent sign in it, killed the process. The shell already wrote through its own
// format-only line (IOS-SHELL-1's consoleLine in IosShell.kt); the two are now this ONE function (R206), the scrub
// still before the write (R574).

private val EMAIL = Regex("""[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}""")
private val TOKENISH = Regex("""[A-Za-z0-9_\-.]{24,}""")
private val ISO_DAY = Regex("""\d{4}-\d{2}-\d{2}""")
private val SIX_DIGIT_CODE = Regex("""\b\d{6}\b""")

private const val REDACTED = "<redacted>"

/** [message] with every email, token-like run, calendar day and six-digit code replaced by "<redacted>". */
internal fun scrub(message: String): String =
    message
        .replace(EMAIL, REDACTED)
        .replace(ISO_DAY, REDACTED)
        .replace(TOKENISH, REDACTED)
        .replace(SIX_DIGIT_CODE, REDACTED)

/**
 * One line to the console: scrubbed (R574), then handed to NSLog as its FORMAT with every % doubled - never as a C
 * vararg. iOS's ONE console sink: IosLogger's default and the shell's log default (startIosShell) both write here.
 */
internal fun consoleLine(line: String) {
    NSLog(scrub(line).replace("%", "%%"))
}

class IosLogger(
    private val sink: (String) -> Unit = ::consoleLine,
) {
    fun error(
        tag: String,
        message: String,
    ) = sink("E/" + tag + ": " + scrub(message))

    fun info(
        tag: String,
        message: String,
    ) = sink("I/" + tag + ": " + scrub(message))
}
