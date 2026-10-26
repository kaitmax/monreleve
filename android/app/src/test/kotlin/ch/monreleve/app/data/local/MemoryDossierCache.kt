package ch.monreleve.app.data.local

/**
 * AN-RELEVE-FRESH (R559). DossierCache's contract, in memory, for the JVM tests that drive the sync engine and
 * the Releve together: one body per year, a stale flag per year that a save clears in the same write, and a
 * clear that drops both. [marked] records every markStale call in order, so a test can assert WHICH years a
 * drain marked and that a drain sending nothing marked none.
 */
class MemoryDossierCache : DossierCache {
    val years = mutableMapOf<Int, String>()
    private val stale = mutableSetOf<Int>()
    val marked = mutableListOf<Int>()

    override fun load(year: Int): String? = years[year]

    override fun save(
        year: Int,
        body: String,
    ) {
        years[year] = body
        stale.remove(year)
    }

    override fun clear() {
        years.clear()
        stale.clear()
    }

    override fun markStale(year: Int) {
        marked += year
        stale += year
    }

    override fun isStale(year: Int): Boolean = year in stale
}
