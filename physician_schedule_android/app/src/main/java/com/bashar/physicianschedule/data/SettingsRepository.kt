package com.bashar.physicianschedule.data

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.time.DayOfWeek

enum class ThemeMode { SYSTEM, LIGHT, DARK }
enum class AppLanguage(val tag: String) { SYSTEM(""), ENGLISH("en"), ARABIC("ar") }

data class AppSettings(
    val language: AppLanguage = AppLanguage.SYSTEM,
    val firstDayOfWeek: DayOfWeek = DayOfWeek.MONDAY,
    val use24Hour: Boolean = true,
    val defaultDurationMinutes: Int = 60,
    /** null = no reminder. */
    val defaultReminderMinutes: Int? = 30,
    val theme: ThemeMode = ThemeMode.SYSTEM,
    val notificationsEnabled: Boolean = true,
)

/** Small key-value settings; SharedPreferences is enough and survives restarts. */
class SettingsRepository(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    private val _settings = MutableStateFlow(read())
    val settings: StateFlow<AppSettings> = _settings

    private fun read() = AppSettings(
        language = runCatching { AppLanguage.valueOf(prefs.getString("language", null)!!) }.getOrDefault(AppLanguage.SYSTEM),
        firstDayOfWeek = DayOfWeek.of(prefs.getInt("firstDay", DayOfWeek.MONDAY.value)),
        use24Hour = prefs.getBoolean("use24", true),
        defaultDurationMinutes = prefs.getInt("duration", 60),
        defaultReminderMinutes = prefs.getInt("reminder", 30).takeIf { it >= 0 },
        theme = runCatching { ThemeMode.valueOf(prefs.getString("theme", null)!!) }.getOrDefault(ThemeMode.SYSTEM),
        notificationsEnabled = prefs.getBoolean("notifications", true),
    )

    fun update(transform: (AppSettings) -> AppSettings) {
        val old = _settings.value
        val s = transform(old)
        prefs.edit()
            .putString("language", s.language.name)
            .putInt("firstDay", s.firstDayOfWeek.value)
            .putBoolean("use24", s.use24Hour)
            .putInt("duration", s.defaultDurationMinutes)
            .putInt("reminder", s.defaultReminderMinutes ?: -1)
            .putString("theme", s.theme.name)
            .putBoolean("notifications", s.notificationsEnabled)
            .apply()
        _settings.value = s
        if (s.language != old.language) applyLanguage(s.language)
    }

    /** AppCompat stores the choice and recreates activities in the new language (RTL for Arabic). */
    fun applyLanguage(language: AppLanguage) {
        val locales = if (language == AppLanguage.SYSTEM) LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(language.tag)
        AppCompatDelegate.setApplicationLocales(locales)
    }

    /** Scheduled reminder request codes, so they can be cancelled before rescheduling. */
    var scheduledReminderCodes: Set<Int>
        get() = prefs.getStringSet("reminderCodes", emptySet())!!.mapNotNull { it.toIntOrNull() }.toSet()
        set(value) { prefs.edit().putStringSet("reminderCodes", value.map { it.toString() }.toSet()).apply() }

    var demoOffered: Boolean
        get() = prefs.getBoolean("demoOffered", false)
        set(value) { prefs.edit().putBoolean("demoOffered", value).apply() }
}
