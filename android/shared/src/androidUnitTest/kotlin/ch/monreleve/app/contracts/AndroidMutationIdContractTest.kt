package ch.monreleve.app.contracts

import java.util.UUID

// IOS-1a R568. Android's mint, held to the same contract iOS's is: the expression AndroidRecordSeams passes as
// LocalEntryRepository's newMutationId (java.util.UUID.randomUUID().toString()). It lives here, in :shared's
// JVM tests, because :app's tests are not this task's to edit; it proves the contract describes what Android
// does today, so "one id format on the wire" is a checked statement about both platforms.
class AndroidMutationIdContractTest : MutationIdContract() {
    override fun mint(): String = UUID.randomUUID().toString()
}
