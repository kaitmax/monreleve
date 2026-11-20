package ch.monreleve.app.push

import ch.monreleve.app.calc.fixtureFile
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

// AN-FCM-CLIENT (R1151, R1152, R204). THE APP'S HALF OF THE JOIN. fixtures/push-client-cases.json is the one home;
// web/tests/db/push-client-join.test.ts posts `registration.body` and `optIn.body` to the REAL routes and runs the
// REAL daily job, which must hand `registration.fakeToken` exactly `reminder.data`. Here the app's REAL builders
// must produce those bodies and its REAL reader must read that data - so a renamed key on either side fails a build,
// and neither side types the other's strings (R181).

/** A flat JSON object as a map - android.jar's org.json has no similar(), and these bodies hold no nesting. */
private fun JSONObject.flat(): Map<String, Any?> = keys().asSequence().associateWith { get(it) }

class PushClientFixtureTest {
    private val fixture = JSONObject(fixtureFile("push-client-cases.json").readText())
    private val registration = fixture.getJSONObject("registration")
    private val optIn = fixture.getJSONObject("optIn")
    private val reminder = fixture.getJSONObject("reminder")

    @Test
    fun theFakesTokenIsTheFixturesToken() {
        assertEquals(registration.getString("fakeToken"), runBlocking { FakePushTokens().current() })
    }

    @Test
    fun theRegistrationTheAppSendsIsTheFixturesBody() {
        val built =
            JSONObject(registrationBody(registration.getString("fakeToken"), registration.getString("appVersion")))
        assertEquals(registration.getJSONObject("body").flat(), built.flat())
    }

    @Test
    fun theOptInTheAppSendsIsTheFixturesBody() {
        assertEquals(optIn.getJSONObject("body").flat(), JSONObject(reminderOptInBody(true)).flat())
    }

    @Test
    fun theDataTheServerSendsIsReadAsTheReminderForItsDay() {
        val data = reminder.getJSONObject("data")
        val map = data.keys().asSequence().associateWith { data.getString(it) }
        assertEquals(reminder.getString("day"), reminderDayOf(map))
    }
}
