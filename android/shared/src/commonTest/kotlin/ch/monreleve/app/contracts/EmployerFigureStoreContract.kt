package ch.monreleve.app.contracts

import ch.monreleve.app.settings.EmployerFigureStore
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// IOS-SHELL-2 (R1334, iOS Ruling 11 Q2). THE EmployerFigureStore KDOC, AS TESTS, WRITTEN ONCE (SettingsStoreContract's
// shape). AN-RECON R342: the figure is ACCOUNT-TAGGED (one account never reads another's), FAIL-CLOSED (no account
// stores nothing and reads nothing), kept PER YEAR, and - on iOS, where InMemoryEmployerFigureStore would lose it on
// every launch - it survives the instance that wrote it. The JVM runs this against the in-memory reference
// (ReferenceContractTests.kt); the simulator against UserDefaultsEmployerFigureStore (ImplementationContractTests.kt).
// The sweeps (sign-out and deletion take the figures; a server-ended session keeps them, R527) are the detection
// file's, not the interface's, and are tested where that file is (IosDetectionFileIosTest).

abstract class EmployerFigureStoreContract {
    protected abstract fun reset()

    /** A store over the SAME storage as every other instance, reading the active account from [accountTag]. */
    protected abstract fun newInstance(accountTag: () -> String?): EmployerFigureStore

    @BeforeTest
    fun emptyStorage() = reset()

    private fun storeFor(tag: String?): EmployerFigureStore = newInstance { tag }

    @Test
    fun nothingIsReadBeforeAFigureIsSaved() {
        assertNull(storeFor("tag-a").figureFor(2025))
    }

    @Test
    fun aFigureRoundTripsThroughAnotherInstance() {
        storeFor("tag-a").save(2025, 41.25)
        assertEquals(41.25, storeFor("tag-a").figureFor(2025), "the figure outlives the instance that wrote it")
    }

    @Test
    fun oneAccountNeverReadsAnothersFigure() {
        storeFor("tag-a").save(2025, 41.25)
        assertNull(storeFor("tag-b").figureFor(2025), "R303: another account on the same phone sees nothing")
        assertEquals(41.25, storeFor("tag-a").figureFor(2025), "and the owner's figure still stands")
    }

    @Test
    fun noActiveAccountStoresNothingAndReadsNothing() {
        storeFor(null).save(2025, 41.25)
        assertNull(storeFor(null).figureFor(2025), "fail closed (R303): no account, nothing written")
        assertNull(storeFor("tag-a").figureFor(2025), "and nothing an account could read later")
    }

    @Test
    fun figuresAreKeptPerYearAndASaveReplacesThatYearOnly() {
        val store = storeFor("tag-a")
        store.save(2024, 38.0)
        store.save(2025, 41.25)
        store.save(2025, 40.5)
        assertEquals(38.0, storeFor("tag-a").figureFor(2024))
        assertEquals(40.5, storeFor("tag-a").figureFor(2025))
    }

    @Test
    fun theAccountIsReadAtEachCallNeverCapturedAtConstruction() {
        var tag: String? = "tag-a"
        val store = newInstance { tag }
        store.save(2025, 41.25)
        tag = "tag-b"
        assertNull(store.figureFor(2025), "the same instance follows a change of account (AN-ACCOUNT-TAG R423)")
        tag = "tag-a"
        assertEquals(41.25, store.figureFor(2025))
    }
}
