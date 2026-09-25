package com.bashar.growthchart.data

import android.content.Context
import com.bashar.growthchart.core.growth.GrowthReferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Non-sensitive app preferences. */
class AppSettings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    data class Values(
        val family: GrowthReferences.Family,
        val connectLines: Boolean,
        val secureScreen: Boolean,
    )

    private val _values = MutableStateFlow(read())
    val values: StateFlow<Values> = _values.asStateFlow()

    private fun read() = Values(
        family = runCatching { GrowthReferences.Family.valueOf(prefs.getString("family", "AUTO")!!) }.getOrDefault(GrowthReferences.Family.AUTO),
        connectLines = prefs.getBoolean("connectLines", true),
        secureScreen = prefs.getBoolean("secureScreen", false),
    )

    fun setFamily(f: GrowthReferences.Family) { prefs.edit().putString("family", f.name).apply(); _values.value = read() }
    fun setConnectLines(b: Boolean) { prefs.edit().putBoolean("connectLines", b).apply(); _values.value = read() }
    fun setSecureScreen(b: Boolean) { prefs.edit().putBoolean("secureScreen", b).apply(); _values.value = read() }

    var cloudConfigJson: String?
        get() = prefs.getString("cloudConfig", null)
        set(v) { prefs.edit().putString("cloudConfig", v).apply() }

    fun lastPull(account: String): Pair<Long, Int> =
        prefs.getLong("lastPullS_$account", 0L) to prefs.getInt("lastPullN_$account", 0)

    fun setLastPull(account: String, seconds: Long, nanos: Int) {
        prefs.edit().putLong("lastPullS_$account", seconds).putInt("lastPullN_$account", nanos).apply()
    }

    fun clearLastPull(account: String) {
        prefs.edit().remove("lastPullS_$account").remove("lastPullN_$account").apply()
    }
}
