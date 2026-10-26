package ch.monreleve.app.shared

// IOS-1a R567. The Room identity hashes of the schema versions the iOS database test builds or expects, ONE home
// for them. IdentityHashConstantTest (androidUnitTest, JVM) reads schemas/<n>.json and fails if any constant here
// differs from the file Room exported, so the simulator test cannot certify a hash that is not the real one.
internal object SchemaIdentityHashes {
    const val V1 = "73827d0c08494bfd6c71e2ac4f3b8337"
    const val V5 = "6adfdbef760e21ebd422a73e2005bc9e"
    const val V6 = "a08f54541b97835cb850e7d8e4b1cf2d"
}
