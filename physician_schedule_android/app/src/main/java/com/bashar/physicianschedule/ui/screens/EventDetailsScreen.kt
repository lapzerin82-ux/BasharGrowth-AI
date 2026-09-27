@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package com.bashar.physicianschedule.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Notes
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Today
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.bashar.physicianschedule.AppContainer
import com.bashar.physicianschedule.R
import com.bashar.physicianschedule.core.Category
import com.bashar.physicianschedule.core.Conflict
import com.bashar.physicianschedule.core.ConflictDetector
import com.bashar.physicianschedule.core.EditScope
import com.bashar.physicianschedule.core.Mutation
import com.bashar.physicianschedule.core.Occurrence
import com.bashar.physicianschedule.core.Recurrence
import com.bashar.physicianschedule.core.ScheduleOps
import com.bashar.physicianschedule.ui.LocalSettings
import com.bashar.physicianschedule.ui.LocalSnackbar
import com.bashar.physicianschedule.ui.Routes
import com.bashar.physicianschedule.ui.common.CategoryBadge
import com.bashar.physicianschedule.ui.common.ChoiceDialog
import com.bashar.physicianschedule.ui.common.ConflictWarningDialog
import com.bashar.physicianschedule.ui.common.DatePatterns
import com.bashar.physicianschedule.ui.common.DatePickerModal
import com.bashar.physicianschedule.ui.common.DemoTag
import com.bashar.physicianschedule.ui.common.appViewModel
import com.bashar.physicianschedule.ui.common.categoryColor
import com.bashar.physicianschedule.ui.common.categoryName
import com.bashar.physicianschedule.ui.common.currentLocale
import com.bashar.physicianschedule.ui.common.formatDate
import com.bashar.physicianschedule.ui.common.formatRange
import com.bashar.physicianschedule.ui.common.reminderLabel
import com.bashar.physicianschedule.ui.common.repeatDescription
import com.bashar.physicianschedule.ui.theme.LocalExtraColors
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

data class DetailsState(
    val loading: Boolean = true,
    val occurrence: Occurrence? = null,
    val recurrence: Recurrence? = null,
    val conflicts: List<Occurrence> = emptyList(),
)

class EventDetailsViewModel(private val c: AppContainer, private val key: String) : ViewModel() {
    val categories: StateFlow<Map<String, Category>> = c.repository.categories.map { l -> l.associateBy { it.id } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    val state: StateFlow<DetailsState> = c.repository.version.map {
        val o = c.repository.findOccurrence(key) ?: return@map DetailsState(loading = false)
        val rec = o.recurrenceId?.let { c.repository.series(it)?.recurrence }
        val around = c.repository.occurrences(o.date.minusDays(1), o.end.toLocalDate())
        val conflicts = around.filter { it.key != o.key && ConflictDetector.overlaps(it, o) }
        DetailsState(false, o, rec, conflicts)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DetailsState())

    val pendingMove = MutableStateFlow<Pair<Mutation, List<Conflict>>?>(null)
    val done = MutableStateFlow<Int?>(null)

    fun delete(scope: EditScope?) = viewModelScope.launch {
        val o = state.value.occurrence ?: return@launch
        val m = if (o.recurrenceId != null) {
            val s = c.repository.series(o.recurrenceId) ?: return@launch
            ScheduleOps.deleteOccurrence(s, o.occurrenceDate, scope ?: EditScope.THIS_ONLY)
        } else {
            ScheduleOps.deleteSingle(c.repository.single(o.sourceId) ?: return@launch)
        }
        c.repository.apply(m)
        done.value = R.string.event_deleted
    }

    /** Moves this occurrence (only) to [date] and re-runs conflict detection first. */
    fun move(date: LocalDate) = viewModelScope.launch {
        val o = state.value.occurrence ?: return@launch
        val series = o.recurrenceId?.let { c.repository.series(it) }
        val single = if (series == null) c.repository.single(o.sourceId) else null
        val m = ScheduleOps.move(o, date, single, series)
        val conflicts = c.repository.previewConflicts(m, date, date.plusDays(1))
        if (conflicts.isEmpty()) commitMove(m) else pendingMove.value = m to conflicts
    }

    fun commitMove(m: Mutation) = viewModelScope.launch {
        pendingMove.value = null
        c.repository.apply(m)
        done.value = R.string.event_moved
    }
}

@Composable
fun EventDetailsScreen(nav: NavController, key: String) {
    val vm = appViewModel(key = "details:$key") { EventDetailsViewModel(it, key) }
    val s by vm.state.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    val pendingMove by vm.pendingMove.collectAsStateWithLifecycle()
    val done by vm.done.collectAsStateWithLifecycle()
    val settings = LocalSettings.current
    val locale = currentLocale()
    val context = LocalContext.current
    val snackbar = LocalSnackbar.current

    var confirmDelete by remember { mutableStateOf(false) }
    var moving by remember { mutableStateOf(false) }

    LaunchedEffect(done) {
        done?.let { msg ->
            nav.popBackStack()
            snackbar.showSnackbar(context.getString(msg))
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                title = { Text(stringResource(R.string.event_details)) },
                actions = {
                    s.occurrence?.let { o -> IconButton(onClick = { nav.navigate(Routes.edit(o.key)) }) { Icon(Icons.Filled.Edit, stringResource(R.string.edit)) } }
                },
            )
        },
    ) { padding ->
        val o = s.occurrence
        if (o == null) {
            Box(Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.Center) {
                if (!s.loading) Text(stringResource(R.string.event_not_found))
            }
            return@Scaffold
        }
        val cat = categories[o.categoryId]
        Column(
            Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(o.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CategoryBadge(cat, 28.dp)
                Text(categoryName(cat), color = categoryColor(cat), style = MaterialTheme.typography.titleSmall)
                if (o.isDemo) DemoTag()
            }
            HorizontalDivider()
            DetailRow(Icons.Filled.Today, stringResource(R.string.field_date), formatDate(o.date, DatePatterns.FULL, locale))
            DetailRow(
                Icons.Filled.Schedule, stringResource(R.string.field_time),
                formatRange(o, settings.use24Hour, locale) + if (o.endsNextDay) " " + stringResource(R.string.next_day_suffix) else "",
            )
            if (o.location.isNotBlank()) DetailRow(Icons.Filled.LocationOn, stringResource(R.string.field_location), o.location)
            if (o.notes.isNotBlank()) DetailRow(Icons.AutoMirrored.Filled.Notes, stringResource(R.string.field_notes), o.notes)
            DetailRow(Icons.Filled.Notifications, stringResource(R.string.field_reminder), reminderLabel(context, o.reminderMinutes))
            s.recurrence?.let { r ->
                DetailRow(Icons.Filled.Repeat, stringResource(R.string.field_repeat), repeatDescription(context, r, locale))
                if (o.isException) Text(stringResource(R.string.modified_occurrence), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (s.conflicts.isNotEmpty()) {
                val warn = LocalExtraColors.current.warning
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Filled.Warning, null, tint = warn)
                    Column {
                        Text(stringResource(R.string.conflict_title), color = warn, fontWeight = FontWeight.SemiBold)
                        s.conflicts.forEach { other ->
                            TextButton(onClick = { nav.navigate(Routes.details(other.key)) }) {
                                Text(other.title + " · " + formatRange(other, settings.use24Hour, locale), color = warn)
                            }
                        }
                    }
                }
            }
            HorizontalDivider()
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { nav.navigate(Routes.edit(o.key)) }, Modifier.height(48.dp)) {
                    Icon(Icons.Filled.Edit, null, Modifier.size(18.dp)); Text(stringResource(R.string.edit), Modifier.padding(start = 6.dp))
                }
                OutlinedButton(onClick = { moving = true }, Modifier.height(48.dp)) {
                    Icon(Icons.Filled.DateRange, null, Modifier.size(18.dp)); Text(stringResource(R.string.move_to_date), Modifier.padding(start = 6.dp))
                }
                OutlinedButton(onClick = { nav.navigate(Routes.add(o.date, duplicateOf = o.key)) }, Modifier.height(48.dp)) {
                    Icon(Icons.Filled.ContentCopy, null, Modifier.size(18.dp)); Text(stringResource(R.string.duplicate), Modifier.padding(start = 6.dp))
                }
                OutlinedButton(
                    onClick = { confirmDelete = true }, Modifier.height(48.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) {
                    Icon(Icons.Filled.Delete, null, Modifier.size(18.dp)); Text(stringResource(R.string.delete), Modifier.padding(start = 6.dp))
                }
                if (o.isRecurring) {
                    OutlinedButton(onClick = { nav.navigate(Routes.SERIES) }, Modifier.height(48.dp)) {
                        Icon(Icons.Filled.Repeat, null, Modifier.size(18.dp)); Text(stringResource(R.string.manage_series), Modifier.padding(start = 6.dp))
                    }
                }
            }
        }

        if (confirmDelete) {
            if (o.isRecurring) {
                ChoiceDialog(
                    title = stringResource(R.string.scope_delete_title),
                    options = EditScope.entries.map { it to scopeLabel(it, delete = true) },
                    onPick = { scope -> confirmDelete = false; vm.delete(scope) },
                    onDismiss = { confirmDelete = false },
                    destructive = true,
                )
            } else {
                AlertDialog(
                    onDismissRequest = { confirmDelete = false },
                    title = { Text(stringResource(R.string.delete_confirm_title)) },
                    text = { Text(o.title) },
                    confirmButton = { TextButton(onClick = { confirmDelete = false; vm.delete(null) }) { Text(stringResource(R.string.delete), color = MaterialTheme.colorScheme.error) } },
                    dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text(stringResource(R.string.cancel)) } },
                )
            }
        }
        if (moving) {
            DatePickerModal(o.date, { d -> vm.move(d) }) { moving = false }
        }
        pendingMove?.let { (m, conflicts) ->
            val touched = m.touchedSourceIds
            ConflictWarningDialog(
                conflicts, { c -> if (c.first.sourceId in touched) c.second else c.first }, settings.use24Hour,
                onSaveAnyway = { vm.commitMove(m) },
                onEdit = { vm.pendingMove.value = null },
            )
        }
    }
}

@Composable
private fun DetailRow(icon: ImageVector, label: String, value: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Column {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
