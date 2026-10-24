package ch.monreleve.app.settings

import android.content.SharedPreferences

// AN-FORCED-SIGNOUT (R527). ONE SharedPreferences FILE, IN MEMORY - so a JVM test can hand every store that shares
// monreleve.detection the SAME file and read what a clear leaves of it. The in-memory store fakes cannot answer that:
// each holds its own value, so "the file minus the employer keys" has nothing to be measured on. There is no
// Robolectric here and Context.getSharedPreferences is a stub; android.content.SharedPreferences is an INTERFACE, so
// the JVM can implement it, and the stores take it through their internal constructor.
//
// THE EDITOR KEEPS ANDROID'S DOCUMENTED ORDER: clear() empties the file FIRST, wherever it sits in the chain, then
// every put and remove of the same editor applies; a null String or Set removes its key. Nothing is visible before
// commit() or apply().

internal class MemoryPrefsFile : SharedPreferences {
    private val values = mutableMapOf<String, Any>()

    override fun getAll(): MutableMap<String, *> = values.toMutableMap()

    override fun getString(
        key: String,
        defValue: String?,
    ): String? = values[key] as? String ?: defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(
        key: String,
        defValues: MutableSet<String>?,
    ): MutableSet<String>? = (values[key] as? Set<String>)?.toMutableSet() ?: defValues

    override fun getInt(
        key: String,
        defValue: Int,
    ): Int = values[key] as? Int ?: defValue

    override fun getLong(
        key: String,
        defValue: Long,
    ): Long = values[key] as? Long ?: defValue

    override fun getFloat(
        key: String,
        defValue: Float,
    ): Float = values[key] as? Float ?: defValue

    override fun getBoolean(
        key: String,
        defValue: Boolean,
    ): Boolean = values[key] as? Boolean ?: defValue

    override fun contains(key: String): Boolean = key in values

    override fun edit(): SharedPreferences.Editor = Editor()

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener,
    ) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener,
    ) = Unit

    private inner class Editor : SharedPreferences.Editor {
        /** A null value is a removal. */
        private val changes = linkedMapOf<String, Any?>()
        private var clearFirst = false

        private fun change(
            key: String,
            value: Any?,
        ): SharedPreferences.Editor {
            changes[key] = value
            return this
        }

        override fun putString(
            key: String,
            value: String?,
        ): SharedPreferences.Editor = change(key, value)

        override fun putStringSet(
            key: String,
            values: MutableSet<String>?,
        ): SharedPreferences.Editor = change(key, values?.toSet())

        override fun putInt(
            key: String,
            value: Int,
        ): SharedPreferences.Editor = change(key, value)

        override fun putLong(
            key: String,
            value: Long,
        ): SharedPreferences.Editor = change(key, value)

        override fun putFloat(
            key: String,
            value: Float,
        ): SharedPreferences.Editor = change(key, value)

        override fun putBoolean(
            key: String,
            value: Boolean,
        ): SharedPreferences.Editor = change(key, value)

        override fun remove(key: String): SharedPreferences.Editor = change(key, null)

        override fun clear(): SharedPreferences.Editor {
            clearFirst = true
            return this
        }

        override fun commit(): Boolean {
            if (clearFirst) values.clear()
            for ((key, value) in changes) {
                if (value == null) values.remove(key) else values[key] = value
            }
            return true
        }

        override fun apply() {
            commit()
        }
    }
}
