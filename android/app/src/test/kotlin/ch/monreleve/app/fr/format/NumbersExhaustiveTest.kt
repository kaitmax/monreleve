package ch.monreleve.app.fr.format

// AN3 increment 1. Kotlin port of web/tests/unit/ui-core/format-exhaustive.test.ts.
//
// RULING R26, carried: formatPercent must prove by exhaustive test that for
// every integer n in 0..10 000, formatPercent(n / 100) renders exactly the
// digits of n - and the same for formatDays over every half day.
//
// Every expectation below is built by INTEGER ARITHMETIC - division,
// remainder, padStart - never by the formatter under test, and never by
// float division on its own. An expectation computed the same way as the
// thing it checks proves only that the code agrees with itself.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

private val NBSP: Char = 0x00A0.toChar()
private val NNBSP: Char = 0x202F.toChar()
private const val COMMA = ','
private const val THOUSAND = 1000

/** Groups an integer's digits in threes with NNBSP, by integer arithmetic. */
private fun groupInteger(whole: Int): String {
    var rest = whole
    val groups = mutableListOf<String>()

    while (rest >= THOUSAND) {
        groups.add(0, (rest % THOUSAND).toString().padStart(3, '0'))
        rest /= THOUSAND
    }
    groups.add(0, rest.toString())

    return groups.joinToString(NNBSP.toString())
}

class NumbersExhaustiveTest : FunSpec({
    context("R26: formatPercent renders exactly the digits of n, two decimals") {
        test("holds for every integer n in 0..10000") {
            val failures = mutableListOf<String>()

            for (n in 0..10_000) {
                val whole = n / 100
                val hundredths = n % 100
                val wanted = "${groupInteger(whole)}$COMMA${hundredths.toString().padStart(2, '0')}$NBSP%"
                val got = formatPercent(n / 100.0, 2)

                if (got != wanted) failures.add("n=$n wanted $wanted got $got")
            }

            failures shouldBe emptyList()
        }

        test("really did test 10001 values, and the expectation is not the code") {
            groupInteger(0) shouldBe "0"
            groupInteger(34) shouldBe "34"
            groupInteger(1234) shouldBe "1${NNBSP}234"
            groupInteger(1_000_000) shouldBe "1${NNBSP}000${NNBSP}000"
            formatPercent(3460 / 100.0, 2) shouldBe "34${COMMA}60$NBSP%"
            formatPercent(1839 / 100.0, 2) shouldBe "18${COMMA}39$NBSP%"
        }

        test("recovers the AFC hundredth that the FW4-shaped rate defect loses") {
            // 23/125 is exactly 18.4%. Given a correctly computed 18.39 or
            // 18.40, the formatter must not lose a further hundredth.
            formatPercent(1840 / 100.0, 2) shouldBe "18${COMMA}40$NBSP%"
            formatPercent(1839 / 100.0, 2) shouldBe "18${COMMA}39$NBSP%"
        }
    }

    context("R26 second clause: one decimal over n in 0..1000") {
        test("holds for every integer n in 0..1000") {
            val failures = mutableListOf<String>()

            for (n in 0..1_000) {
                val wanted = "${groupInteger(n / 10)}$COMMA${n % 10}$NBSP%"
                val got = formatPercent(n / 10.0, 1)

                if (got != wanted) failures.add("n=$n wanted $wanted got $got")
            }

            failures shouldBe emptyList()
        }
    }

    context("formatDays over every half day, exhaustively") {
        test("renders and groups every half day from 0 to 5000") {
            val failures = mutableListOf<String>()

            for (half in 0..10_000) {
                val whole = half / 2
                val isHalf = half % 2 == 1
                val wanted = if (isHalf) "${groupInteger(whole)}$COMMA" + "5" else groupInteger(whole)
                val got = formatDays(half / 2.0)

                if (got != wanted) failures.add("half=$half wanted $wanted got $got")
            }

            failures shouldBe emptyList()
        }

        test("crosses the thousand boundary without losing the separator") {
            formatDays(999.5) shouldBe "999${COMMA}5"
            formatDays(1000.0) shouldBe "1${NNBSP}000"
            formatDays(1000.5) shouldBe "1${NNBSP}000$COMMA" + "5"
        }
    }

    context("the negative half of the domain, which R26 does not reach") {
        test("reports sign and magnitude for every signed half day to 2000") {
            val failures = mutableListOf<String>()

            for (half in -4_000..4_000) {
                val value = half / 2.0
                val magnitude = kotlin.math.abs(half)
                val whole = magnitude / 2
                val wanted = if (magnitude % 2 == 1) "${groupInteger(whole)}$COMMA" + "5" else groupInteger(whole)
                val got = formatSignedDays(value)

                if (got.text != wanted) failures.add("half=$half wanted $wanted got ${got.text}")
                if (got.negative != (half < 0)) failures.add("half=$half sign flag ${got.negative}")
                if (got.text.contains('-') || got.text.contains(0x2212.toChar())) {
                    failures.add("half=$half text carries a sign: ${got.text}")
                }
            }

            failures shouldBe emptyList()
        }

        test("does not report negative zero as negative") {
            formatSignedDays(-0.0).negative shouldBe false
            formatSignedDays(0.0).negative shouldBe false
        }
    }

    context("the rounding policy is asserted, not incidental") {
        test("truncates a two-decimal value asked for at one decimal") {
            formatPercent(0.05, 1) shouldBe "0${COMMA}0$NBSP%"
            formatPercent(0.09, 1) shouldBe "0${COMMA}0$NBSP%"
            formatPercent(12.35, 1) shouldBe "12${COMMA}3$NBSP%"
        }

        test("never rounds a rate up onto or across the fiscal ceiling") {
            formatPercent(39.95, 1) shouldBe "39${COMMA}9$NBSP%"
            formatPercent(39.99, 1) shouldBe "39${COMMA}9$NBSP%"
            formatPercent(39.999, 1) shouldBe "39${COMMA}9$NBSP%"
        }

        test("never rounds a rate up onto or across the social ceiling") {
            formatPercent(49.89, 1) shouldBe "49${COMMA}8$NBSP%"
            formatPercent(49.8999, 2) shouldBe "49${COMMA}89$NBSP%"
        }

        test("leaves a value already at the requested precision alone") {
            formatPercent(39.16, 2) shouldBe "39${COMMA}16$NBSP%"
            formatPercent(45.0, 1) shouldBe "45${COMMA}0$NBSP%"
            formatPercent(40.0, 1) shouldBe "40${COMMA}0$NBSP%"
        }
    }
})
