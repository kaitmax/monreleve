package ch.monreleve.app.calc

// AN2 increment 5. Matches web/tests/unit/calc-engine/allowed-days.test.ts's
// own cases - SPEC section 7.4. allowedTeleworkDays answers "how much room
// is there?" without being told anything about days already taken, so the
// calculator can show the allowance before the user has entered a single
// day.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.shouldBe

private val BASE =
    AllowedTeleworkDaysInput(
        taxYear = 2026,
        canton = Canton.GE,
        employmentRate = 100,
        periodFraction = 1.0,
        denominator = DenominatorMethod.Simplified240,
        granularity = Granularity.DAY,
    )

class AllowedDaysTest : FunSpec({
    test("gives the fiscal and social ceilings and the mission cap at full time") {
        val result = allowedTeleworkDays(BASE)

        (result is CalcResult.Ok) shouldBe true
        if (result is CalcResult.Ok) {
            result.value.atFiscal shouldBe 96.0 // 240 * 0.40, already a whole day
            // R12: floored to the half-day. 240 * 0.499 = 119.76 -> 119.5.
            result.value.atSocial shouldBe 119.5
            result.value.missionCap shouldBe 10
        }
    }

    // 1 to 1 is ceil(0.1).
    listOf(
        1 to 1,
        50 to 5,
        80 to 8,
        100 to 10,
    ).forEach { (rate, cap) ->
        test("rounds the mission cap UP at employmentRate $rate, giving $cap") {
            // SPEC 7.2 step 4: "rounded up, the one rule that favours the
            // user".
            val result = allowedTeleworkDays(BASE.copy(employmentRate = rate))

            (result is CalcResult.Ok && result.value.missionCap == cap) shouldBe true
        }
    }

    test("rounds the mission cap up on a fractional part-time rate too") {
        // 10 * 45/100 = 4.5 -> 5, not 4.
        val result = allowedTeleworkDays(BASE.copy(employmentRate = 45))

        (result is CalcResult.Ok && result.value.missionCap == 5) shouldBe true
    }

    test("prorates by period as well as rate") {
        val result = allowedTeleworkDays(BASE.copy(employmentRate = 100, periodFraction = 0.5))

        (result is CalcResult.Ok) shouldBe true
        if (result is CalcResult.Ok) {
            result.value.atFiscal shouldBe 48.0 // 120 * 0.40
            result.value.missionCap shouldBe 5 // ceil(10 * 1 * 0.5)
        }
    }

    test("honours an exact denominator") {
        val result = allowedTeleworkDays(BASE.copy(denominator = DenominatorMethod.Exact(200)))

        (result is CalcResult.Ok) shouldBe true
        if (result is CalcResult.Ok) {
            result.value.atFiscal shouldBe 80.0 // 200 * 0.40
            // R12: 200 * 0.499 = 99.8 -> floored to 99.5.
            result.value.atSocial shouldBe 99.5
        }
    }

    test("always leaves more social room than fiscal room") {
        // Invariant 4 of SPEC 7.6, at the ceiling level: 49.9% > 40%.
        val result = allowedTeleworkDays(BASE)

        if (result is CalcResult.Ok) {
            result.value.atSocial shouldBeGreaterThan result.value.atFiscal
        }
    }

    test("returns validation errors rather than a result for a bad rate") {
        val result = allowedTeleworkDays(BASE.copy(employmentRate = 0))

        (result is CalcResult.Err && result.error.contains(ValidationError.RateOutOfRange)) shouldBe true
    }

    test("returns TotalWorkDaysNotPositive and never divides") {
        val result = allowedTeleworkDays(BASE.copy(denominator = DenominatorMethod.Exact(0)))

        (result is CalcResult.Err && result.error.contains(ValidationError.TotalWorkDaysNotPositive)) shouldBe true
    }

    test("never throws, whatever it is handed (adapted: periodFraction only, see DenominatorMethod's own note)") {
        // The TS suite hands Number.NaN to employmentRate too; that field is
        // Int here and cannot hold it (see DenominatorMethod.Exact's own
        // comment on the same class of gap). periodFraction is Double and
        // keeps the NaN path testable.
        allowedTeleworkDays(BASE.copy(periodFraction = Double.NaN))
        // Reaching this line without an exception IS the proof.
    }
})
