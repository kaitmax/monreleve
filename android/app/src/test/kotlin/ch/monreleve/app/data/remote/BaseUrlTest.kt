package ch.monreleve.app.data.remote

import ch.monreleve.app.BuildConfig
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldStartWith

// AN4 increment 1 (AC3). The DEBUG base URL points at the emulator's host alias
// 10.0.2.2 over cleartext http - the ONE host src/debug/res's network security
// config permits cleartext to, and where `pnpm dev` serves. This ties the base
// URL to the cleartext exception: name a different host and the debug loop
// silently cannot reach the dev server, while a release build would try cleartext
// against a config that denies it. The release URL is https and is proven to
// carry no cleartext permission by checkReleaseCleartext (a gradle task, because
// the release variant is not on this unit test's classpath).
class BaseUrlTest : FunSpec({
    test("the debug base URL is the emulator host over cleartext, matching the debug network config") {
        BuildConfig.API_BASE_URL shouldStartWith "http://10.0.2.2:"
    }
})
