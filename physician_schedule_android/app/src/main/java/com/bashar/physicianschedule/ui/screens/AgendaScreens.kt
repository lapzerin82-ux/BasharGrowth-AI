@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package com.bashar.physicianschedule.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.bashar.physicianschedule.core.Occurrence
import com.bashar.physicianschedule.ui.LocalSettings
import com.bashar.physicianschedule.ui.Routes
import com.bashar.physicianschedule.ui.common.DatePatterns
import com.bashar.physicianschedule.ui.common.DatePickerModal
import com.bashar.physicianschedule.ui.common.EmptyState
import com.bashar.physicianschedule.ui.common.EventCard
import com.bashar.physicianschedule.ui.common.SectionHeader
import com.bashar.physicianschedule.ui.common.SelectField
import com.bashar.physicianschedule.ui.common.appViewModel
import com.bashar.physicianschedule.ui.common.categoryIcon
import com.bashar.physicianschedule.ui.common.categoryName
import com.bashar.physicianschedule.ui.common.currentLocale
import com.bashar.physicianschedule.ui.common.formatDate
import com.bashar.physicianschedule.ui.common.formatRange
import com.bashar.physicianschedule.ui.theme.LocalExtraColors
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.TemporalAdjusters

enum class RangeFilter { ALL, TODAY, WEEK, MONTH, CUSTOM }

/** Date range for a filter, starting today (or at [customFrom] for CUSTOM). */
fun RangeFilter.range(today: LocalDate, firstDay: DayOfWeek, customFrom: LocalDate, customTo: LocalDate): Pair<LocalDate, LocalDate> = when (this) {
    RangeFilter.ALL -> today to today.plusYears(1)
    RangeFilter.TODAY -> today to today
    RangeFilter.WEEK -> today to today.with(TemporalAdjusters.previousOrSame(firstDay)).plusDays(6)
    RangeFilter.MONTH -> today to today.with(TemporalAdjusters.lastDayOfMonth())
    RangeFilter.CUSTOM -> customFrom to maxOf(customFrom, customTo)
}

@Composable
private fun rangeLabel(f: RangeFilter): String = stringResource(
    when (f) {
        RangeFilter.ALL -> R.string.filter_all
        RangeFilter.TODAY -> R.string.filter_today
        RangeFilter.WEEK -> R.string.filter_week
        RangeFilter.MONTH -> R.string.filter_month
        RangeFilter.CUSTOM -> R.string.filter_custom
    },
)

/** "TODAY", "TOMORROW" or the date, for list section headers. */
@Composable
fun dayHeader(date: LocalDate, today: LocalDate): String = when (date) {
    today -> stringResource(R.string.header_today)
    today.plusDays(1) -> stringResource(R.string.header_tomorrow)
    else -> formatDate(date, DatePatterns.DAY, currentLocale())
}

// ---- Upcoming ---------------------------------------------------------------------------

@OptIn(ExperimentalCoroutinesApi::class)
class UpcomingViewModel(private val c: AppContainer) : ViewModel() {
    val filter = MutableStateFlow(RangeFilter.ALL)
    val categories: StateFlow<Map<String, Category>> = c.repository.categories.map { l -> l.associateBy { it.id } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    val items: StateFlow<List<Occurrence>?> = filter.flatMapLatest { f ->
        val today = LocalDate.now()
        val (from, to) = if (f == RangeFilter.ALL) today to today.plusDays(60)
        else f.range(today, c.settings.settings.value.firstDayOfWeek, today, today)
        c.repository.observeOccurrences(from, to).map { list ->
            val now = LocalDateTime.now()
            list.filter { it.end > now }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
}

@Composable
fun UpcomingScreen(nav: NavController) {
    val vm = appViewModel { UpcomingViewModel(it) }
    val filter by vm.filter.collectAsStateWithLifecycle()
    val items by vm.items.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    val settings = LocalSettings.current
    val today = LocalDate.now()

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.nav_upcoming)) }) }) { padding ->
        LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(RangeFilter.ALL, RangeFilter.TODAY, RangeFilter.WEEK, RangeFilter.MONTH).forEach { f ->
                        FilterChip(selected = f == filter, onClick = { vm.filter.value = f }, label = { Text(rangeLabel(f)) })
                    }
                }
            }
            val list = items
            if (list != null && list.isEmpty()) {
                item { EmptyState(Icons.Filled.EventAvailable, stringResource(R.string.no_events)) }
            }
            list.orEmpty().groupBy { it.date }.forEach { (date, dayItems) ->
                item(key = "h$date") { SectionHeader(dayHeader(date, today)) }
                items(dayItems, key = { it.key }) { o ->
                    EventCard(o, categories[o.categoryId], settings.use24Hour, onClick = { nav.navigate(Routes.details(o.key)) })
                }
            }
        }
    }
}

// ---- Conflict center --------------------------------------------------------------------

class ConflictsViewModel(c: AppContainer) : ViewModel() {
    val categories: StateFlow<Map<String, Category>> = c.repository.categories.map { l -> l.associateBy { it.id } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    /** Recomputed on every change, so a fixed conflict disappears immediately. */
    val conflicts: StateFlow<List<Conflict>?> = LocalDate.now().withDayOfMonth(1).let { start ->
        c.repository.observeConflicts(start, start.plusMonths(12))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
}

@Composable
fun ConflictsScreen(nav: NavController) {
    val vm = appViewModel { ConflictsViewModel(it) }
    val conflicts by vm.conflicts.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    val settings = LocalSettings.current
    val locale = currentLocale()
    val warn = LocalExtraColors.current.warning

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.conflicts_title)) }) }) { padding ->
        LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val list = conflicts
            if (list != null && list.isEmpty()) {
                item { EmptyState(Icons.Filled.CheckCircle, stringResource(R.string.no_conflicts_long)) }
            }
            if (!list.isNullOrEmpty()) {
                item { Text(stringResource(R.string.conflicts_intro), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            items(list.orEmpty(), key = { it.key }) { cf ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, warn),
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Filled.Warning, null, tint = warn)
                            Text(
                                stringResource(R.string.conflict_on, formatDate(cf.date, DatePatterns.DAY, locale)),
                                style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = warn,
                            )
                        }
                        ConflictLine(cf.first, categories[cf.first.categoryId], settings.use24Hour, locale)
                        ConflictLine(cf.second, categories[cf.second.categoryId], settings.use24Hour, locale)
                        HorizontalDivider()
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { nav.navigate(Routes.day(cf.date)) }) { Text(stringResource(R.string.view)) }
                            OutlinedButton(onClick = { nav.navigate(Routes.edit(cf.first.key)) }) { Text(stringResource(R.string.edit_first)) }
                            OutlinedButton(onClick = { nav.navigate(Routes.edit(cf.second.key)) }) { Text(stringResource(R.string.edit_second)) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConflictLine(o: Occurrence, cat: Category?, use24: Boolean, locale: java.util.Locale) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(categoryIcon(cat?.icon ?: "event"), null, Modifier.size(20.dp), tint = com.bashar.physicianschedule.ui.common.categoryColor(cat))
        Column {
            Text(formatRange(o, use24, locale) + if (o.endsNextDay) " (+1)" else "", style = MaterialTheme.typography.labelLarge)
            Text(o.title + " · " + categoryName(cat), style = MaterialTheme.typography.bodyMedium)
            if (o.location.isNotBlank()) Text(o.location, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ---- Search & filter --------------------------------------------------------------------

data class SearchQuery(
    val text: String = "",
    val categories: Set<String> = emptySet(),
    val range: RangeFilter = RangeFilter.ALL,
    val customFrom: LocalDate = LocalDate.now(),
    val customTo: LocalDate = LocalDate.now().plusMonths(1),
    val location: String? = null,
)

data class SearchResult(val items: List<Occurrence>, val locations: List<String>)

@OptIn(ExperimentalCoroutinesApi::class)
class SearchViewModel(private val c: AppContainer) : ViewModel() {
    val query = MutableStateFlow(SearchQuery())
    val categories: StateFlow<List<Category>> = c.repository.categories.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val results: Flow<SearchResult> = query.flatMapLatest { q ->
        val (from, to) = q.range.range(LocalDate.now(), c.settings.settings.value.firstDayOfWeek, q.customFrom, q.customTo)
        c.repository.observeOccurrences(from, to).map { all ->
            val text = q.text.trim()
            val filtered = all.filter { o ->
                (text.isEmpty() || o.title.contains(text, true) || o.location.contains(text, true) || o.notes.contains(text, true)) &&
                    (q.categories.isEmpty() || o.categoryId in q.categories)
            }
            SearchResult(
                items = filtered.filter { q.location == null || it.location == q.location },
                locations = filtered.map { it.location }.filter { it.isNotBlank() }.distinct().sorted(),
            )
        }
    }
}

@Composable
fun SearchScreen(nav: NavController) {
    val vm = appViewModel { SearchViewModel(it) }
    val q by vm.query.collectAsStateWithLifecycle()
    val result by vm.results.collectAsState(initial = null)
    val categories by vm.categories.collectAsStateWithLifecycle()
    val settings = LocalSettings.current
    val locale = currentLocale()
    var picking by remember { mutableStateOf<String?>(null) }
    val allLocations = stringResource(R.string.all_locations)

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                title = { Text(stringResource(R.string.search)) },
            )
        },
    ) { padding ->
        LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                OutlinedTextField(
                    value = q.text, onValueChange = { v -> vm.query.value = q.copy(text = v) },
                    leadingIcon = { Icon(Icons.Filled.Search, null) },
                    trailingIcon = { if (q.text.isNotEmpty()) IconButton(onClick = { vm.query.value = q.copy(text = "") }) { Icon(Icons.Filled.Close, stringResource(R.string.clear)) } },
                    placeholder = { Text(stringResource(R.string.search_hint)) },
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.field_category), style = MaterialTheme.typography.labelMedium)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        categories.forEach { c ->
                            val on = c.id in q.categories
                            FilterChip(
                                selected = on,
                                onClick = { vm.query.value = q.copy(categories = if (on) q.categories - c.id else q.categories + c.id) },
                                label = { Text(categoryName(c)) },
                                leadingIcon = { Icon(categoryIcon(c.icon), null, Modifier.size(16.dp)) },
                            )
                        }
                    }
                    Text(stringResource(R.string.date_range), style = MaterialTheme.typography.labelMedium)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        RangeFilter.entries.forEach { f ->
                            FilterChip(selected = q.range == f, onClick = { vm.query.value = q.copy(range = f) }, label = { Text(if (f == RangeFilter.ALL) stringResource(R.string.filter_next_year) else rangeLabel(f)) })
                        }
                    }
                    if (q.range == RangeFilter.CUSTOM) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { picking = "from" }) { Text(stringResource(R.string.from_date, formatDate(q.customFrom, DatePatterns.SHORT, locale))) }
                            OutlinedButton(onClick = { picking = "to" }) { Text(stringResource(R.string.to_date, formatDate(q.customTo, DatePatterns.SHORT, locale))) }
                        }
                    }
                    val locs = result?.locations.orEmpty()
                    if (locs.isNotEmpty() || q.location != null) {
                        SelectField(
                            label = stringResource(R.string.field_location),
                            selectedText = q.location ?: allLocations,
                            options = listOf<String?>(null).plus(locs).map { it to (it ?: allLocations) },
                            onSelect = { v -> vm.query.value = q.copy(location = v) },
                            leading = Icons.Filled.LocationOn,
                        )
                    }
                }
            }
            val items = result?.items
            if (items != null) {
                item { Text(stringResource(R.string.results_count, items.size), style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp)) }
                if (items.isEmpty()) item { EmptyState(Icons.Filled.Search, stringResource(R.string.no_results)) }
                items(items, key = { it.key }) { o ->
                    EventCard(o, categories.firstOrNull { it.id == o.categoryId }, settings.use24Hour, onClick = { nav.navigate(Routes.details(o.key)) }, showDate = true)
                }
            }
        }
    }
    when (picking) {
        "from" -> DatePickerModal(q.customFrom, { d -> vm.query.value = q.copy(customFrom = d) }) { picking = null }
        "to" -> DatePickerModal(q.customTo, { d -> vm.query.value = q.copy(customTo = d) }) { picking = null }
    }
}
