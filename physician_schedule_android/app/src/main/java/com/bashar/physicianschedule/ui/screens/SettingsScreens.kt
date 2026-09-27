@file:OptIn(ExperimentalMaterial3Api::class)

package com.bashar.physicianschedule.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.CalendarViewWeek
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.Science
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.bashar.physicianschedule.AppContainer
import com.bashar.physicianschedule.BuildConfig
import com.bashar.physicianschedule.R
import com.bashar.physicianschedule.core.ImportPlan
import com.bashar.physicianschedule.data.AppLanguage
import com.bashar.physicianschedule.data.AppSettings
import com.bashar.physicianschedule.data.DemoTitles
import com.bashar.physicianschedule.data.ThemeMode
import com.bashar.physicianschedule.ui.LocalSettings
import com.bashar.physicianschedule.ui.LocalSnackbar
import com.bashar.physicianschedule.ui.Routes
import com.bashar.physicianschedule.ui.common.SectionHeader
import com.bashar.physicianschedule.ui.common.appViewModel
import com.bashar.physicianschedule.ui.common.categoryNameFor
import com.bashar.physicianschedule.ui.common.currentLocale
import com.bashar.physicianschedule.ui.common.reminderLabel
import com.bashar.physicianschedule.ui.common.weekdayName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset

class SettingsViewModel(val c: AppContainer) : ViewModel() {
    val hasDemo = MutableStateFlow(false)

    fun refreshDemo() = viewModelScope.launch { hasDemo.value = c.repository.hasDemoEvents() }
    fun update(transform: (AppSettings) -> AppSettings) = c.settings.update(transform)
    fun addDemo(titles: DemoTitles) = viewModelScope.launch { c.repository.addDemoEvents(LocalDate.now(), titles); refreshDemo() }
    fun removeDemo() = viewModelScope.launch { c.repository.removeDemoEvents(); refreshDemo() }
}

@Composable
fun SettingsScreen(nav: NavController) {
    val vm = appViewModel { SettingsViewModel(it) }
    val s = LocalSettings.current
    val context = LocalContext.current
    val locale = currentLocale()
    val hasDemo by vm.hasDemo.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.refreshDemo() }

    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        vm.update { it.copy(notificationsEnabled = granted) }
    }

    var choice by remember { mutableStateOf<String?>(null) }

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.nav_settings)) }) }) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            SectionHeader(stringResource(R.string.settings_general))
            SettingRow(Icons.Filled.Language, stringResource(R.string.setting_language), languageLabel(s.language)) { choice = "language" }
            SettingRow(Icons.Filled.CalendarViewWeek, stringResource(R.string.setting_first_day), weekdayName(s.firstDayOfWeek, locale)) { choice = "firstDay" }
            SettingRow(Icons.Filled.Schedule, stringResource(R.string.setting_time_format), stringResource(if (s.use24Hour) R.string.time_24 else R.string.time_12)) { choice = "time" }
            SettingRow(Icons.Filled.DarkMode, stringResource(R.string.setting_theme), themeLabel(s.theme)) { choice = "theme" }

            SectionHeader(stringResource(R.string.settings_events))
            SettingRow(Icons.Filled.Timer, stringResource(R.string.setting_default_duration), stringResource(R.string.minutes_value, s.defaultDurationMinutes)) { choice = "duration" }
            SettingRow(Icons.Filled.Notifications, stringResource(R.string.setting_default_reminder), reminderLabel(context, s.defaultReminderMinutes)) { choice = "reminder" }
            Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Icon(Icons.Filled.Notifications, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(stringResource(R.string.setting_notifications), Modifier.weight(1f))
                Switch(checked = s.notificationsEnabled, onCheckedChange = { on ->
                    val needsPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    if (on && needsPermission) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    else vm.update { it.copy(notificationsEnabled = on) }
                })
            }

            SectionHeader(stringResource(R.string.settings_data))
            SettingRow(Icons.Filled.Repeat, stringResource(R.string.recurring_events), null) { nav.navigate(Routes.SERIES) }
            SettingRow(Icons.Filled.Backup, stringResource(R.string.backup_export), stringResource(R.string.backup_export_desc)) { nav.navigate(Routes.BACKUP) }
            if (hasDemo) {
                SettingRow(Icons.Filled.DeleteSweep, stringResource(R.string.remove_demo), null) { vm.removeDemo() }
            } else {
                SettingRow(Icons.Filled.Science, stringResource(R.string.load_demo), stringResource(R.string.load_demo_desc)) {
                    vm.addDemo(
                        DemoTitles(
                            context.getString(R.string.demo_lecture), context.getString(R.string.demo_consultation),
                            context.getString(R.string.demo_night), context.getString(R.string.demo_oncall),
                            context.getString(R.string.demo_university), context.getString(R.string.demo_hospital),
                        ),
                    )
                }
            }
            HorizontalDivider(Modifier.padding(vertical = 12.dp))
            Text(stringResource(R.string.version, BuildConfig.VERSION_NAME), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    when (choice) {
        "language" -> Options(stringResource(R.string.setting_language), AppLanguage.entries.map { it to languageLabel(it) }, s.language, { l -> vm.update { it.copy(language = l) } }) { choice = null }
        "firstDay" -> Options(
            stringResource(R.string.setting_first_day),
            listOf(DayOfWeek.MONDAY, DayOfWeek.SUNDAY, DayOfWeek.SATURDAY).map { it to weekdayName(it, locale) },
            s.firstDayOfWeek, { d -> vm.update { it.copy(firstDayOfWeek = d) } },
        ) { choice = null }
        "time" -> Options(
            stringResource(R.string.setting_time_format),
            listOf(true to stringResource(R.string.time_24), false to stringResource(R.string.time_12)),
            s.use24Hour, { v -> vm.update { it.copy(use24Hour = v) } },
        ) { choice = null }
        "theme" -> Options(stringResource(R.string.setting_theme), ThemeMode.entries.map { it to themeLabel(it) }, s.theme, { t -> vm.update { it.copy(theme = t) } }) { choice = null }
        "duration" -> Options(
            stringResource(R.string.setting_default_duration),
            listOf(30, 45, 60, 90, 120, 180).map { it to stringResource(R.string.minutes_value, it) },
            s.defaultDurationMinutes, { m -> vm.update { it.copy(defaultDurationMinutes = m) } },
        ) { choice = null }
        "reminder" -> Options(
            stringResource(R.string.setting_default_reminder),
            listOf<Int?>(null, 10, 30, 60, 1440).map { it to reminderLabel(context, it) },
            s.defaultReminderMinutes, { m -> vm.update { it.copy(defaultReminderMinutes = m) } },
        ) { choice = null }
    }
}

@Composable
private fun languageLabel(l: AppLanguage) = stringResource(
    when (l) {
        AppLanguage.SYSTEM -> R.string.lang_system
        AppLanguage.ENGLISH -> R.string.lang_english
        AppLanguage.ARABIC -> R.string.lang_arabic
    },
)

@Composable
private fun themeLabel(t: ThemeMode) = stringResource(
    when (t) {
        ThemeMode.SYSTEM -> R.string.theme_system
        ThemeMode.LIGHT -> R.string.theme_light
        ThemeMode.DARK -> R.string.theme_dark
    },
)

@Composable
private fun SettingRow(icon: ImageVector, title: String, value: String?, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable(onClick = onClick).padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            if (value != null) Text(value, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.outline)
    }
}

@Composable
private fun <T> Options(title: String, options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                options.forEach { (value, label) ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { onSelect(value); onDismiss() },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        androidx.compose.material3.RadioButton(selected = value == selected, onClick = { onSelect(value); onDismiss() })
                        Text(label)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

// ---- Backup & export --------------------------------------------------------------------

@Composable
fun BackupScreen(nav: NavController) {
    val vm = appViewModel { SettingsViewModel(it) }
    val context = LocalContext.current
    val snackbar = LocalSnackbar.current
    val scope = rememberCoroutineScope()
    var importPlan by remember { mutableStateOf<ImportPlan?>(null) }
    val today = LocalDate.now()
    val stamp = today.toString()

    suspend fun write(uri: Uri, text: String) = withContext(Dispatchers.IO) {
        context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(text.toByteArray(Charsets.UTF_8)) }
    }

    fun export(uri: Uri?, build: suspend () -> String) {
        uri ?: return
        scope.launch {
            val ok = runCatching { write(uri, build()) }.isSuccess
            snackbar.showSnackbar(context.getString(if (ok) R.string.export_done else R.string.export_failed))
        }
    }

    suspend fun categoryNamer(): (String) -> String {
        val cats = vm.c.repository.categories.first().associateBy { it.id }
        return { id -> categoryNameFor(context, cats[id]) }
    }

    val jsonLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        export(uri) { vm.c.repository.exportJson(LocalDateTime.now()) }
    }
    val csvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        export(uri) { vm.c.repository.exportCsv(today.minusYears(1), today.plusYears(1), categoryNamer()) }
    }
    val icsLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/calendar")) { uri ->
        export(uri) { vm.c.repository.exportIcs(LocalDateTime.now(ZoneOffset.UTC), categoryNamer()) }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val result = runCatching {
                val text = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { it.readBytes().toString(Charsets.UTF_8) } }
                vm.c.repository.planImport(text ?: error("empty"))
            }
            result.onSuccess { importPlan = it }.onFailure { snackbar.showSnackbar(context.getString(R.string.import_invalid)) }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                title = { Text(stringResource(R.string.backup_export)) },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            SectionHeader(stringResource(R.string.backup_section))
            SettingRow(Icons.Filled.Backup, stringResource(R.string.backup_json), stringResource(R.string.backup_json_desc)) { jsonLauncher.launch("schedule-backup-$stamp.json") }
            SettingRow(Icons.Filled.FileUpload, stringResource(R.string.restore_import), stringResource(R.string.restore_import_desc)) {
                importLauncher.launch(arrayOf("application/json", "text/plain", "application/octet-stream"))
            }
            SectionHeader(stringResource(R.string.export_section))
            SettingRow(Icons.Filled.FileDownload, stringResource(R.string.export_csv), stringResource(R.string.export_csv_desc)) { csvLauncher.launch("schedule-$stamp.csv") }
            SettingRow(Icons.Filled.FileDownload, stringResource(R.string.export_ics), stringResource(R.string.export_ics_desc)) { icsLauncher.launch("schedule-$stamp.ics") }
        }
    }

    importPlan?.let { plan ->
        AlertDialog(
            onDismissRequest = { importPlan = null },
            title = { Text(stringResource(R.string.import_title)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(stringResource(R.string.import_will_add, plan.visibleEventCount))
                    if (plan.skippedDuplicates > 0) Text(stringResource(R.string.import_skipped, plan.skippedDuplicates))
                    Text(stringResource(R.string.import_safe), style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    importPlan = null
                    scope.launch {
                        vm.c.repository.applyImport(plan)
                        snackbar.showSnackbar(context.getString(R.string.import_done, plan.visibleEventCount))
                    }
                }, enabled = plan.events.isNotEmpty()) { Text(stringResource(R.string.import_action)) }
            },
            dismissButton = { TextButton(onClick = { importPlan = null }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}
