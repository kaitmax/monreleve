package ch.monreleve.app.debug

import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.settings.Settings
import java.time.LocalDate
import java.time.OffsetDateTime

// DEBUG-ONLY (R284). Parses and VALIDATES a session - and optionally the six calculation
// settings - handed to the app by SessionInjectionActivity, so the on-device walkthrough drives a
// signed-in app with a REAL server-issued session and never types an email. `adb shell input text`
// failed twice in AN5b (it concatenated two inputs, then truncated an email); an access token passed
// as an intent extra removes typing entirely.
//
// THIS FILE EXISTS ONLY IN src/debug. Three guards enforce that, each proven with a planted violation
// (REPORT-AN5c.txt): (a) NoDebugInjectionInMainTest scans src/main and src/release and fails if the
// class appears there; (b) checkReleaseNoDebugInjection reads the MERGED RELEASE manifest and fails
// if it is declared, exactly as checkReleaseCleartext does; (c) SessionInjectionTest below proves the
// parser accepts ONLY a well-formed session and refuses anything else BY NAME (R198).
//
// R198 / THE REFUSAL NAMES THE FIELD, NEVER THE VALUE. A refusal echoing a value could print a token,
// which is the leak the log fence exists to stop; every Refused carries a field NAME only. The four
// token fields are all required and non-blank; the two expiries must be ISO instants. Settings are
// all-or-nothing, keyed on the canton sentinel: present them to seed onboarding (AC1's deterministic
// path to Aujourd'hui), or omit them to drive onboarding on the device (AC2).

/** The keys of the intent extras SessionInjectionActivity reads. Public so the test names the same keys. */
object SessionInjectionExtras {
    const val ACCESS_TOKEN = "accessToken"
    const val REFRESH_TOKEN = "refreshToken"
    const val ACCESS_EXPIRES_AT = "accessExpiresAt"
    const val REFRESH_EXPIRES_AT = "refreshExpiresAt"
    const val CANTON = "canton"
    const val EMPLOYMENT_RATE = "employmentRate"
    const val DENOMINATOR_KIND = "denominatorKind"
    const val EXACT_TOTAL_WORK_DAYS = "exactTotalWorkDays"
    const val GRANULARITY = "granularity"
    const val ACTIVITY_START_DATE = "activityStartDate"
}

/** The outcome of parsing an injection. Refused carries the offending FIELD name only (R198). */
sealed interface InjectionResult {
    data class Valid(val session: TokenPair, val settings: Settings?) : InjectionResult

    data class Refused(val field: String) : InjectionResult
}

private const val DENOMINATOR_SIMPLIFIED = "SIMPLIFIED240"
private const val DENOMINATOR_EXACT = "EXACT"
private const val GRANULARITY_DAY = "DAY"
private const val GRANULARITY_HALF_DAY = "HALF_DAY"

object SessionInjection {
    /**
     * The well-formed session (and optional settings), or a Refused naming the first bad field. Guard
     * clauses, one per field, are why ReturnCount is suppressed here - the same reason
     * OnboardingController.validate carries it. This is debug/, not ui/, so the annotation's string is
     * not a fence-4 violation.
     */
    @Suppress("ReturnCount")
    fun parse(extra: (String) -> String?): InjectionResult {
        for (key in REQUIRED_TOKEN_FIELDS) {
            if (extra(key).isNullOrBlank()) return InjectionResult.Refused(key)
        }
        for (key in INSTANT_FIELDS) {
            if (!isIsoInstant(extra(key)!!)) return InjectionResult.Refused(key)
        }
        val session =
            TokenPair(
                accessToken = extra(SessionInjectionExtras.ACCESS_TOKEN)!!,
                refreshToken = extra(SessionInjectionExtras.REFRESH_TOKEN)!!,
                accessExpiresAt = extra(SessionInjectionExtras.ACCESS_EXPIRES_AT)!!,
                refreshExpiresAt = extra(SessionInjectionExtras.REFRESH_EXPIRES_AT)!!,
            )
        return when (val settings = parseSettings(extra)) {
            SettingsParse.None -> InjectionResult.Valid(session, null)
            is SettingsParse.Ok -> InjectionResult.Valid(session, settings.settings)
            is SettingsParse.Bad -> InjectionResult.Refused(settings.field)
        }
    }

    private val REQUIRED_TOKEN_FIELDS =
        listOf(
            SessionInjectionExtras.ACCESS_TOKEN,
            SessionInjectionExtras.REFRESH_TOKEN,
            SessionInjectionExtras.ACCESS_EXPIRES_AT,
            SessionInjectionExtras.REFRESH_EXPIRES_AT,
        )

    private val INSTANT_FIELDS =
        listOf(SessionInjectionExtras.ACCESS_EXPIRES_AT, SessionInjectionExtras.REFRESH_EXPIRES_AT)

    private fun isIsoInstant(value: String): Boolean = runCatching { OffsetDateTime.parse(value) }.isSuccess

    /**
     * Settings are all-or-nothing, keyed on the canton sentinel. Absent canton means no settings
     * (drive onboarding on the device). Present canton means every required field must parse, or the
     * bad one is named. The engine and the server remain the judge of ranges (R196): this checks only
     * that the fields are structurally sound enough to store and to PATCH.
     */
    @Suppress("ReturnCount")
    private fun parseSettings(extra: (String) -> String?): SettingsParse {
        val canton = extra(SessionInjectionExtras.CANTON)
        if (canton.isNullOrBlank()) return SettingsParse.None
        val rate =
            extra(SessionInjectionExtras.EMPLOYMENT_RATE)?.toIntOrNull()
                ?: return SettingsParse.Bad(SessionInjectionExtras.EMPLOYMENT_RATE)
        val denominator = extra(SessionInjectionExtras.DENOMINATOR_KIND)
        if (denominator != DENOMINATOR_SIMPLIFIED && denominator != DENOMINATOR_EXACT) {
            return SettingsParse.Bad(SessionInjectionExtras.DENOMINATOR_KIND)
        }
        val granularity = extra(SessionInjectionExtras.GRANULARITY)
        if (granularity != GRANULARITY_DAY && granularity != GRANULARITY_HALF_DAY) {
            return SettingsParse.Bad(SessionInjectionExtras.GRANULARITY)
        }
        val exactTotalRaw = extra(SessionInjectionExtras.EXACT_TOTAL_WORK_DAYS)?.takeIf { it.isNotBlank() }
        val exactTotal =
            if (exactTotalRaw == null) {
                null
            } else {
                exactTotalRaw.toIntOrNull() ?: return SettingsParse.Bad(SessionInjectionExtras.EXACT_TOTAL_WORK_DAYS)
            }
        if (denominator == DENOMINATOR_EXACT && exactTotal == null) {
            return SettingsParse.Bad(SessionInjectionExtras.EXACT_TOTAL_WORK_DAYS)
        }
        val startDate = extra(SessionInjectionExtras.ACTIVITY_START_DATE)?.takeIf { it.isNotBlank() }
        if (startDate != null && runCatching { LocalDate.parse(startDate) }.isFailure) {
            return SettingsParse.Bad(SessionInjectionExtras.ACTIVITY_START_DATE)
        }
        return SettingsParse.Ok(
            Settings(
                canton = canton,
                employmentRate = rate,
                denominatorKind = denominator,
                exactTotalWorkDays = exactTotal,
                granularity = granularity,
                activityStartDate = startDate,
            ),
        )
    }

    private sealed interface SettingsParse {
        data object None : SettingsParse

        data class Ok(val settings: Settings) : SettingsParse

        data class Bad(val field: String) : SettingsParse
    }
}
