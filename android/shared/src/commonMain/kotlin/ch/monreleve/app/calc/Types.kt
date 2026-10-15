package ch.monreleve.app.calc

// AN2 increment 1: ports web/lib/calc-engine/types.ts.
//
// The engine's public type surface, transcribed from SPEC section 7.4, plus
// taxYear on TeleworkInput per section 7.7.
//
// Pure types. No runtime dependency, no I/O, no clock. Everything immutable:
// a dossier is computed, never mutated.

/** The 26 Swiss cantons. SPEC section 7.4. */
enum class Canton {
    AG,
    AI,
    AR,
    BE,
    BL,
    BS,
    FR,
    GE,
    GL,
    GR,
    JU,
    LU,
    NE,
    NW,
    OW,
    SG,
    SH,
    SO,
    SZ,
    TG,
    TI,
    UR,
    VD,
    VS,
    ZG,
    ZH,
}

/**
 * Derived from the canton, never asked. The 40% ceiling is the same either
 * way; the consequence of breaching it is not (SPEC section 7.2 step 1).
 */
enum class Regime {
    SOURCE,
    RESIDENCE_1983,
}

/** How hours become countable days (SPEC section 7.2 step 3). */
enum class Granularity {
    DAY,
    HALF_DAY,
    HOURS,
}

/**
 * The employer chooses the method and must apply it uniformly; the engine
 * mirrors it and never invents one (SPEC section 7.2 step 2).
 */
sealed interface DenominatorMethod {
    data object Simplified240 : DenominatorMethod

    /**
     * Int, not Double: a denominator basis is always a whole count of days
     * in this domain (Simplified240 always ceils to one; nothing in SPEC
     * 7.2 step 2 contemplates a fractional Exact total either). TypeScript's
     * untyped `number` here also admits NaN/Infinity, and validate.test.ts's
     * "never throws, whatever it is handed" test exercises that specific
     * case for the Exact method's supplied total - Kotlin's Int makes that
     * state unrepresentable rather than merely validated against, which is
     * a stronger guarantee than the TS side has, not a gap. The Kotlin
     * conformance test for this omits only that one NaN sub-case, noted at
     * the point it would otherwise appear (Validate.kt's own test file).
     */
    data class Exact(val totalWorkDays: Int) : DenominatorMethod
}

data class TeleworkInput(
    /** Resolves the RuleSet. SPEC section 7.7. */
    val taxYear: Int,
    val canton: Canton,
    /** 1-100. */
    val employmentRate: Int,
    /** 0 < f <= 1. */
    val periodFraction: Double,
    val denominator: DenominatorMethod,
    val granularity: Granularity,
    /**
     * Double, not Int: under HALF_DAY granularity a value of 10.5 is not an
     * edge case to guard against, it is the ordinary case (SPEC 7.2 step 3 -
     * classifyTeleworkHours itself returns 0.5). All three day-count fields
     * below share this.
     */
    val teleworkDays: Double,
    val missionDaysFrance: Double,
    val missionDaysThirdState: Double,
)

data class TeleworkResult(
    val regime: Regime,
    val regimeApplies: Boolean,
    val totalWorkDays: Int,
    val missionCap: Int,
    val fiscalCeilingDays: Double,
    /** Truncated, 2 dp - for the AFC. */
    val declarableRate: Double,
    /** Rounded up, 1 dp - for display. */
    val rawRate: Double,
    /** Double: derived from the input day-count fields, which may be half-days. */
    val swissTaxedDays: Double,
    val frenchTaxedDays: Double,
    val creditedMissionDays: Double,
    /** May be negative. */
    val remainingToFiscal: Double,
    /** May be negative. */
    val remainingToSocial: Double,
    val warnings: List<Warning>,
)

sealed interface Warning {
    data class FiscalCeilingExceeded(val regime: Regime) : Warning

    data class MissionCapExceeded(val cap: Int, val excess: Double) : Warning

    data class MissionsExceedHeadroom(val excess: Double) : Warning

    data object SocialCeilingExceeded : Warning

    data object A1Required : Warning

    /** residence-1983 only. */
    data object FrontalierStatusAtRisk : Warning

    /** user-supplied denominator. */
    data object ExactMethodUnverified : Warning

    // Ruling R11: ruleSetFor falls back to the latest known set for an
    // unknown year, and the substitution must reach the user rather than
    // being implied by a taxYear a caller has to think to compare.
    data class RuleSetFallback(val requestedYear: Int, val appliedYear: Int) : Warning
}

/**
 * The field a ValidationError names. NOT every TeleworkInput property - only
 * the ones validate.ts (Validate.kt, increment 3) actually assigns as a
 * NegativeDays or GranularityMismatch field: the three day-count fields
 * that share those two checks, plus DENOMINATOR for the Exact method's
 * supplied total (validate.ts's own `field: 'denominator'` - a value
 * TypeScript's `keyof TeleworkInput` allows structurally because
 * TeleworkInput has a denominator property, not a separately-declared
 * variant). RATE_OUT_OF_RANGE and PERIOD_OUT_OF_RANGE carry no field at
 * all, so employmentRate and periodFraction are correctly absent here.
 */
enum class InputField {
    TELEWORK_DAYS,
    MISSION_DAYS_FRANCE,
    MISSION_DAYS_THIRD_STATE,
    DENOMINATOR,
}

sealed interface ValidationError {
    data object RateOutOfRange : ValidationError

    data object PeriodOutOfRange : ValidationError

    data class NegativeDays(val field: InputField) : ValidationError

    data class GranularityMismatch(val field: InputField) : ValidationError

    data object DaysExceedTotal : ValidationError

    data object TotalWorkDaysNotPositive : ValidationError
}

/**
 * Invalid input is the expected output of a form, so the engine returns this
 * and never throws (SPEC section 7). Named CalcResult, not Result, so it is
 * never confused with kotlin.Result - that type wraps a single success value
 * against a thrown exception; this is a closed ok/error union with no
 * exception involved on either side, the same shape as the TypeScript
 * engine's own Result<T, E>.
 */
sealed interface CalcResult<out T, out E> {
    data class Ok<out T>(val value: T) : CalcResult<T, Nothing>

    data class Err<out E>(val error: E) : CalcResult<Nothing, E>
}

/** The year-keyed constants. SPEC section 7.7. */
data class RuleSet(
    val taxYear: Int,
    val fiscalCeiling: Double,
    val socialCeiling: Double,
    /**
     * The telework share at which the EU framework agreement - and so the A1
     * it rests on - begins to apply. 0.25, added at Checkpoint A
     * (09.09.2026), which replaced A1_REQUIRED's provisional
     * standing-obligation trigger.
     *
     * SPEC 7.7: "RuleSet is the only place a threshold may appear." So it
     * lives here rather than as a constant in Warnings.kt, for the same
     * reason 0.4 does.
     */
    val a1ThresholdRate: Double,
    val missionCapDays: Int,
    val simplifiedBasisDays: Int,
    val residence1983Cantons: List<Canton>,
    val sources: List<String>,
)

/** What allowedTeleworkDays answers. SPEC section 7.4. */
data class AllowedTeleworkDays(
    val atFiscal: Double,
    val atSocial: Double,
    val missionCap: Int,
)

/**
 * What allowedTeleworkDays (AllowedDays.kt) takes: the fields
 * calculateTelework's own input carries but this question does not need -
 * no day has been entered yet.
 */
data class AllowedTeleworkDaysInput(
    val taxYear: Int,
    val canton: Canton,
    val employmentRate: Int,
    val periodFraction: Double,
    val denominator: DenominatorMethod,
    val granularity: Granularity,
)

/** What resolveDenominator (Denominator.kt) answers. SPEC section 7.2 step 2. */
data class DenominatorOutcome(
    val totalWorkDays: Int,
    val warnings: List<Warning>,
)

/** What runWaterfall (Waterfall.kt) takes. SPEC section 7.2 step 5. */
data class WaterfallInput(
    val totalWorkDays: Int,
    val missionCap: Int,
    val teleworkDays: Double,
    val missionDaysFrance: Double,
    val missionDaysThirdState: Double,
)

/** What warningsFor (Warnings.kt) takes. SPEC section 7.4's Warning union. */
data class WarningContext(
    val regime: Regime,
    val regimeApplies: Boolean,
    val daysCountedAgainstCeiling: Double,
    /**
     * input.teleworkDays. Distinct from daysCountedAgainstCeiling, which
     * also carries credited mission days: the framework agreement behind
     * A1Required is about work performed in the state of RESIDENCE, and a
     * mission day in a third state is not that.
     */
    val teleworkDays: Double,
    /** fiscalCeiling - teleworkDays. Zero when the regime is already lost. */
    val headroomDays: Double,
    val missionDaysTotal: Double,
    val missionCap: Int,
    val totalWorkDays: Int,
    /** input.taxYear, which may differ from the rule set actually applied. */
    val requestedTaxYear: Int,
    /** Warnings the denominator produced, e.g. ExactMethodUnverified. */
    val denominatorWarnings: List<Warning>,
)

/** What runWaterfall (Waterfall.kt) answers. SPEC section 7.2 step 5. */
data class WaterfallOutcome(
    val regimeApplies: Boolean,
    val fiscalCeilingDays: Double,
    /** fiscalCeiling - teleworkDays. Zero in the regime-lost branch. */
    val headroomDays: Double,
    val creditedFranceDays: Double,
    val creditedThirdStateDays: Double,
    val creditedMissionDays: Double,
    /** The numerator of declarableRate. Excludes missions when the regime is lost. */
    val daysCountedAgainstCeiling: Double,
    val swissTaxedDays: Double,
    val frenchTaxedDays: Double,
)
