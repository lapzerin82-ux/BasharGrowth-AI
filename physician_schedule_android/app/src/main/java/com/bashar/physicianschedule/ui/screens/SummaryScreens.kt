@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package com.bashar.physicianschedule.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.bashar.physicianschedule.core.EditScope
import com.bashar.physicianschedule.core.Occurrence
import com.bashar.physicianschedule.core.ScheduleOps
import com.bashar.physicianschedule.data.SeriesInfo
import com.bashar.physicianschedule.ui.LocalSettings
import com.bashar.physicianschedule.ui.LocalSnackbar
import com.bashar.physicianschedule.ui.Routes
import com.bashar.physicianschedule.ui.common.CategoryBadge
import com.bashar.physicianschedule.ui.common.DatePatterns
import com.bashar.physicianschedule.ui.common.EmptyState
import com.bashar.physicianschedule.ui.common.appViewModel
import com.bashar.physicianschedule.ui.common.categoryName
import com.bashar.physicianschedule.ui.common.currentLocale
import com.bashar.physicianschedule.ui.common.formatDate
import com.bashar.physicianschedule.ui.common.formatTime
import com.bashar.physicianschedule.ui.common.repeatDescription
import com.bashar.physicianschedule.ui.theme.LocalExtraColors
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth

// ---- Monthly summary --------------------------------------------------------------------

data class MonthSummary(val counts: List<Pair<Category, Int>>, val total: Int, val conflicts: Int)

class SummaryViewModel(private val c: AppContainer) : ViewModel() {
    fun summary(month: YearMonth): Flow<MonthSummary> = combine(
        c.repository.categories,
        c.repository.observeOccurrences(month.atDay(1), month.atEndOfMonth()),
        c.repository.observeConflicts(month.atDay(1), month.atEndOfMonth()),
    ) { cats, occ, conflicts ->
        val byCat = occ.groupingBy { it.categoryId }.eachCount()
        // Built-in categories always appear; custom ones only when used this month.
        val rows = cats.filter { !it.isCustom || (byCat[it.id] ?: 0) > 0 }.map { it to (byCat[it.id] ?: 0) }
        MonthSummary(rows, occ.size, conflicts.size)
    }
}

@Composable
fun SummaryScreen(nav: NavController, initialMonth: YearMonth) {
    val vm = appViewModel { SummaryViewModel(it) }
    var month by remember { mutableStateOf(initialMonth) }
    val flow = remember(month) { vm.summary(month) }
    val s by flow.collectAsStateWithLifecycle(initialValue = null)
    val locale = currentLocale()

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                title = { Text(stringResource(R.string.monthly_summary)) },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { month = month.minusMonths(1) }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, stringResource(R.string.previous_month)) }
                Text(formatDate(month.atDay(1), DatePatterns.MONTH_YEAR, locale), Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                IconButton(onClick = { month = month.plusMonths(1) }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, stringResource(R.string.next_month)) }
            }
            val sum = s ?: return@Column
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    sum.counts.forEach { (cat, n) ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            CategoryBadge(cat, 28.dp)
                            Text(categoryName(cat), Modifier.weight(1f))
                            Text(n.toString(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    HorizontalDivider()
                    Row {
                        Text(stringResource(R.string.total_events), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                        Text(sum.total.toString(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                }
            }
            val extra = LocalExtraColors.current
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (sum.conflicts == 0) {
                    Icon(Icons.Filled.CheckCircle, null, tint = extra.success)
                    Text(stringResource(R.string.no_unresolved_conflicts))
                } else {
                    Icon(Icons.Filled.Warning, null, tint = extra.warning)
                    TextButton(onClick = { nav.navigate(Routes.CONFLICTS) }) { Text(stringResource(R.string.unresolved_conflicts, sum.conflicts), color = extra.warning) }
                }
            }
        }
    }
}

// ---- Recurring event management ---------------------------------------------------------

class SeriesViewModel(private val c: AppContainer) : ViewModel() {
    val categories: StateFlow<Map<String, Category>> = c.repository.categories.map { l -> l.associateBy { it.id } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    val series: StateFlow<List<SeriesInfo>?> = c.repository.version.map { c.repository.allSeries(LocalDate.now()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /** Ends the series so nothing repeats after today; past occurrences stay. */
    fun stopAfterToday(info: SeriesInfo) = viewModelScope.launch {
        val s = c.repository.series(info.recurrence.id) ?: return@launch
        val next = info.next ?: return@launch
        val cutoff = if (next == LocalDate.now()) com.bashar.physicianschedule.core.RecurrenceEngine
            .occurrenceDates(s.recurrence, next.plusDays(1), next.plusYears(2)).firstOrNull() ?: return@launch
        else next
        c.repository.apply(ScheduleOps.deleteOccurrence(s, cutoff, EditScope.THIS_AND_FUTURE))
    }

    fun deleteSeries(info: SeriesInfo) = viewModelScope.launch {
        val s = c.repository.series(info.recurrence.id) ?: return@launch
        c.repository.apply(ScheduleOps.deleteOccurrence(s, s.recurrence.startDate, EditScope.ENTIRE_SERIES))
    }
}

@Composable
fun SeriesScreen(nav: NavController) {
    val vm = appViewModel { SeriesViewModel(it) }
    val list by vm.series.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    val settings = LocalSettings.current
    val locale = currentLocale()
    val context = LocalContext.current
    val snackbar = LocalSnackbar.current
    var confirm by remember { mutableStateOf<Pair<SeriesInfo, Boolean>?>(null) }
    val deletedMsg = stringResource(R.string.series_deleted)
    val stoppedMsg = stringResource(R.string.series_stopped)
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                title = { Text(stringResource(R.string.recurring_events)) },
            )
        },
    ) { padding ->
        LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val items = list
            if (items != null && items.isEmpty()) item { EmptyState(Icons.Filled.Repeat, stringResource(R.string.no_recurring)) }
            items(items.orEmpty(), key = { it.recurrence.id }) { info ->
                val cat = categories[info.master.categoryId]
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            CategoryBadge(cat, 32.dp)
                            Column(Modifier.weight(1f)) {
                                Text(info.master.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text(categoryName(cat), style = MaterialTheme.typography.labelMedium)
                            }
                        }
                        Text(repeatDescription(context, info.recurrence, locale), style = MaterialTheme.typography.bodyMedium)
                        Text(
                            formatTime(info.master.startTime, settings.use24Hour, locale) + "–" + formatTime(info.master.endTime, settings.use24Hour, locale) +
                                if (info.master.location.isNotBlank()) " · " + info.master.location else "",
                            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            info.next?.let { stringResource(R.string.next_occurrence, formatDate(it, DatePatterns.DAY, locale)) } ?: stringResource(R.string.series_ended),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        if (info.exceptionCount > 0) Text(stringResource(R.string.exceptions_count, info.exceptionCount), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            info.next?.let { next ->
                                OutlinedButton(onClick = { nav.navigate(Routes.edit(Occurrence.seriesKey(info.master.id, next))) }) { Text(stringResource(R.string.edit_series)) }
                                OutlinedButton(onClick = { confirm = info to false }) { Text(stringResource(R.string.stop_repeating)) }
                            }
                            OutlinedButton(
                                onClick = { confirm = info to true },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            ) { Text(stringResource(R.string.delete_series)) }
                        }
                    }
                }
            }
        }
    }

    confirm?.let { (info, isDelete) ->
        AlertDialog(
            onDismissRequest = { confirm = null },
            title = { Text(stringResource(if (isDelete) R.string.delete_series_confirm else R.string.stop_repeating_confirm)) },
            text = { Text(info.master.title) },
            confirmButton = {
                TextButton(onClick = {
                    confirm = null
                    if (isDelete) vm.deleteSeries(info) else vm.stopAfterToday(info)
                    scope.launch { snackbar.showSnackbar(if (isDelete) deletedMsg else stoppedMsg) }
                }) { Text(stringResource(R.string.confirm), color = if (isDelete) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary) }
            },
            dismissButton = { TextButton(onClick = { confirm = null }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}
