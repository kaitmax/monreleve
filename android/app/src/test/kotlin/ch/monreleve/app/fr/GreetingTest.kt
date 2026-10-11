package ch.monreleve.app.fr

import org.junit.Assert.assertEquals
import org.junit.Test

// PARKAN-50. The Aujourd'hui header greeting was the hard-coded `Fr.GREETING = "Bonjour Camille"`, rendered
// verbatim for every account (the device-walkthrough account "Walkthrough" was still greeted "Camille"). The
// greeting is now a pure function of the signed-in account's holder name (Settings.name, the onboarding
// titulaire) - JVM-testable here, so the first-name extraction and the null-safe fallback are proven without a
// device. The name is interpolated DATA (R153/R181: the copy names the rule's input, it never hard-codes a
// person); the fallback and the template literal are the only strings, and they live in fr/.
class GreetingTest {
    @Test
    fun greetsTheFirstNameOfAFullName() {
        // The historical render, now from data: « Camille Martin » still reads « Bonjour Camille ».
        assertEquals("Bonjour Camille", Fr.greeting("Camille Martin"))
    }

    @Test
    fun greetsTheAccountThatExposedTheBug() {
        // The exact device-walkthrough case: the account named "Walkthrough" must be greeted by its own name.
        assertEquals("Bonjour Walkthrough", Fr.greeting("Walkthrough"))
    }

    @Test
    fun fallsBackToBonjourAloneWhenTheNameIsNull() {
        // AN-ONBOARD-2: a partial-onboarding account (canton but no name) can reach Aujourd'hui; it must not
        // print a stray name or crash - « Bonjour » alone.
        assertEquals("Bonjour", Fr.greeting(null))
    }

    @Test
    fun fallsBackToBonjourAloneWhenTheNameIsEmpty() {
        assertEquals("Bonjour", Fr.greeting(""))
    }

    @Test
    fun fallsBackToBonjourAloneWhenTheNameIsAllWhitespace() {
        assertEquals("Bonjour", Fr.greeting("   "))
    }

    @Test
    fun trimsSurroundingWhitespaceAndTakesTheFirstToken() {
        assertEquals("Bonjour Jean", Fr.greeting("  Jean  Pierre  "))
    }

    @Test
    fun keepsAHyphenatedFirstNameWhole() {
        assertEquals("Bonjour Jean-Pierre", Fr.greeting("Jean-Pierre Dupont"))
    }
}
