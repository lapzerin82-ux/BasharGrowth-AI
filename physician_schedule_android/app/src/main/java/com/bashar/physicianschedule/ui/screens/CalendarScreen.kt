@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)

package com.bashar.physicianschedule.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.bashar.physicianschedule.AppContainer
import com.bashar.physicianschedule.R
import com.bashar.physicianschedule.core.Category
import com.bashar.physicianschedule.core.ConflictDetector
import com.bashar.physicianschedule.core.Occurrence
import com.bashar.physicianschedule.data.DemoTitles
import com.bashar.physicianschedule.ui.LocalSettings
import com.bashar.physicianschedule.ui.Routes
import com.bashar.physicianschedule.ui.common.DatePatterns
import com.bashar.physicianschedule.ui.common.EmptyState
import com.bashar.physicianschedule.ui.common.EventCard
import com.bashar.physicianschedule.ui.common.SectionHeader
import com.bashar.physicianschedule.ui.common.appViewModel
import com.bashar.physicianschedule.ui.common.categoryColor
import com.bashar.physicianschedule.ui.common.categoryIcon
import com.bashar.physicianschedule.ui.common.currentLocale
import com.bashar.physicianschedule.ui.common.formatDate
import com.bashar.physicianschedule.ui.common.formatTime
import com.bashar.physicianschedule.ui.common.weekdayName
import com.bashar.physicianschedule.ui.theme.LocalExtraColors
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.time.temporal.TemporalAdjusters

/** Everything one month page needs. */
data class MonthData(
    val byDate: Map<LocalDate, List<Occurrence>>,
    val conflictKeys: Set<String>,
    val conflictDates: Set<LocalDate>,
)

class CalendarViewModel(private val c: AppContainer) : ViewModel() {
    val categories: StateFlow<Map<String, Category>> = c.repository.categories.map { l -> l.associateBy { it.id } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    val today: LocalDate get() = LocalDate.now()

    fun month(gridStart: LocalDate, gridEnd: LocalDate): Flow<MonthData> =
        // One extra day before the grid so overnight duties are compared with the first morning.
        c.repository.observeOccurrences(gridStart.minusDays(1), gridEnd).map { occ ->
            val conflicts = ConflictDetector.findConflicts(occ)
            MonthData(
                byDate = occ.filter { !it.date.isBefore(gridStart) }.groupBy { it.date },
                conflictKeys = ConflictDetector.conflictingKeys(conflicts),
                conflictDates = conflicts.flatMap { listOf(it.first.date, it.second.date) }.toSet(),
            )
        }

    val todayEvents: StateFlow<List<Occurrence>> = LocalDate.now().let { d ->
        c.repository.observeOccurrences(d, d)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val weekCount: StateFlow<Int> = LocalDate.now().let { d ->
        c.repository.observeOccurrences(d, d.plusDays(6)).map { it.size }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val isEmpty: StateFlow<Boolean> = c.repository.version.map { !c.repository.hasEvents() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    fun addDemo(titles: DemoTitles) = viewModelScope.launch {
        c.settings.demoOffered = true
        c.repository.addDemoEvents(LocalDate.now(), titles)
    }
}

private const val PAGE_COUNT = 1200
private const val CENTER_PAGE = PAGE_COUNT / 2

@Composable
fun CalendarScreen(nav: NavController, conflictCount: Int) {
    val vm = appViewModel { CalendarViewModel(it) }
    val settings = LocalSettings.current
    val locale = currentLocale()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val categories by vm.categories.collectAsStateWithLifecycle()
    val todayEvents by vm.todayEvents.collectAsStateWithLifecycle()
    val weekCount by vm.weekCount.collectAsStateWithLifecycle()
    val isEmpty by vm.isEmpty.collectAsStateWithLifecycle()
    val today = remember { LocalDate.now() }
    val baseMonth = remember { YearMonth.from(today) }
    val pager = rememberPagerState(initialPage = CENTER_PAGE) { PAGE_COUNT }
    val shownMonth = baseMonth.plusMonths((pager.currentPage - CENTER_PAGE).toLong())

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(formatDate(shownMonth.atDay(1), DatePatterns.MONTH_YEAR, locale), fontWeight = FontWeight.SemiBold)
                        Text(
                            stringResource(R.string.today_is, formatDate(today, DatePatterns.DAY, locale)),
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { nav.navigate(Routes.SEARCH) }) { Icon(Icons.Filled.Search, stringResource(R.string.search)) }
                    IconButton(onClick = { nav.navigate(Routes.summary(shownMonth)) }) { Icon(Icons.Filled.BarChart, stringResource(R.string.monthly_summary)) }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { nav.navigate(Routes.add(if (shownMonth == baseMonth) today else shownMonth.atDay(1))) },
                icon = { Icon(Icons.Filled.Add, null) },
                text = { Text(stringResource(R.string.add_event)) },
            )
        },
    ) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Month navigation
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { scope.launch { pager.animateScrollToPage(pager.currentPage - 1) } }) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, stringResource(R.string.previous_month))
                }
                Text(
                    formatDate(shownMonth.atDay(1), DatePatterns.MONTH_YEAR, locale),
                    Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold,
                )
                TextButton(onClick = { scope.launch { pager.animateScrollToPage(CENTER_PAGE) } }) { Text(stringResource(R.string.today)) }
                IconButton(onClick = { scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } }) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, stringResource(R.string.next_month))
                }
            }

            // Status: conflicts and upcoming count, visible without opening any menu.
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val warn = LocalExtraColors.current.warning
                val ok = LocalExtraColors.current.success
                AssistChip(
                    onClick = { nav.navigate(Routes.CONFLICTS) },
                    label = { Text(if (conflictCount > 0) stringResource(R.string.conflicts_count, conflictCount) else stringResource(R.string.no_conflicts)) },
                    leadingIcon = {
                        Icon(if (conflictCount > 0) Icons.Filled.Warning else Icons.Filled.CheckCircle, null, tint = if (conflictCount > 0) warn else ok, modifier = Modifier.size(18.dp))
                    },
                    colors = AssistChipDefaults.assistChipColors(labelColor = if (conflictCount > 0) warn else MaterialTheme.colorScheme.onSurface),
                )
                AssistChip(
                    onClick = { nav.navigate(Routes.UPCOMING) },
                    label = { Text(stringResource(R.string.upcoming_week_count, weekCount)) },
                    leadingIcon = { Icon(Icons.Filled.EventAvailable, null, Modifier.size(18.dp)) },
                )
            }

            Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp) {
                Column {
                    WeekdayHeader(settings.firstDayOfWeek)
                    HorizontalPager(state = pager, modifier = Modifier.height(CELL_HEIGHT * 6), beyondViewportPageCount = 1) { page ->
                        val month = baseMonth.plusMonths((page - CENTER_PAGE).toLong())
                        MonthPage(
                            vm, month, settings.firstDayOfWeek, today, categories, settings.use24Hour,
                            onDay = { nav.navigate(Routes.day(it)) },
                            onDayLong = { nav.navigate(Routes.add(it)) },
                            onEvent = { nav.navigate(Routes.details(it.key)) },
                        )
                    }
                }
            }
            Text(stringResource(R.string.calendar_hint), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

            SectionHeader(stringResource(R.string.today_events))
            if (todayEvents.isEmpty()) {
                EmptyState(Icons.Filled.EventAvailable, stringResource(R.string.no_events)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { nav.navigate(Routes.add(today)) }) { Text(stringResource(R.string.add_event_plus)) }
                        if (isEmpty) {
                            OutlinedButton(onClick = {
                                vm.addDemo(
                                    DemoTitles(
                                        context.getString(R.string.demo_lecture), context.getString(R.string.demo_consultation),
                                        context.getString(R.string.demo_night), context.getString(R.string.demo_oncall),
                                        context.getString(R.string.demo_university), context.getString(R.string.demo_hospital),
                                    ),
                                )
                            }) { Text(stringResource(R.string.load_demo)) }
                        }
                    }
                }
            } else {
                todayEvents.forEach { o ->
                    EventCard(o, categories[o.categoryId], settings.use24Hour, onClick = { nav.navigate(Routes.details(o.key)) })
                }
            }
            Spacer(Modifier.height(88.dp)) // room for the floating button
        }
    }
}

private val CELL_HEIGHT = 86.dp

@Composable
private fun WeekdayHeader(firstDay: DayOfWeek) {
    val locale = currentLocale()
    Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant).padding(vertical = 6.dp)) {
        (0 until 7).forEach { i ->
            val d = firstDay.plus(i.toLong())
            Text(
                weekdayName(d, locale, TextStyle.SHORT),
                Modifier.weight(1f).semantics { contentDescription = weekdayName(d, locale) },
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun MonthPage(
    vm: CalendarViewModel,
    month: YearMonth,
    firstDay: DayOfWeek,
    today: LocalDate,
    categories: Map<String, Category>,
    use24: Boolean,
    onDay: (LocalDate) -> Unit,
    onDayLong: (LocalDate) -> Unit,
    onEvent: (Occurrence) -> Unit,
) {
    val gridStart = remember(month, firstDay) { month.atDay(1).with(TemporalAdjusters.previousOrSame(firstDay)) }
    val gridEnd = gridStart.plusDays(41)
    val flow = remember(gridStart) { vm.month(gridStart, gridEnd) }
    val data by flow.collectAsStateWithLifecycle(initialValue = null)
    Column {
        (0 until 6).forEach { week ->
            Row(Modifier.fillMaxWidth().height(CELL_HEIGHT)) {
                (0 until 7).forEach { col ->
                    val date = gridStart.plusDays((week * 7 + col).toLong())
                    DayCell(
                        date = date,
                        inMonth = YearMonth.from(date) == month,
                        isToday = date == today,
                        events = data?.byDate?.get(date).orEmpty(),
                        hasConflict = data?.conflictDates?.contains(date) == true,
                        conflictKeys = data?.conflictKeys.orEmpty(),
                        categories = categories,
                        use24 = use24,
                        onClick = { onDay(date) },
                        onLongClick = { onDayLong(date) },
                        onEvent = onEvent,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    date: LocalDate,
    inMonth: Boolean,
    isToday: Boolean,
    events: List<Occurrence>,
    hasConflict: Boolean,
    conflictKeys: Set<String>,
    categories: Map<String, Category>,
    use24: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onEvent: (Occurrence) -> Unit,
    modifier: Modifier,
) {
    val locale = currentLocale()
    val colors = MaterialTheme.colorScheme
    val warn = LocalExtraColors.current.warning
    val busy = events.size >= 3
    val context = LocalContext.current
    val description = buildString {
        append(formatDate(date, DatePatterns.FULL, locale))
        append(". ")
        append(context.getString(R.string.cell_events, events.size))
        if (hasConflict) append(". ").append(context.getString(R.string.conflict_title))
    }
    Box(
        modifier
            .fillMaxSize()
            .border(0.5.dp, colors.outlineVariant)
            .then(if (hasConflict) Modifier.border(1.5.dp, warn) else Modifier)
            .background(if (inMonth) colors.surface else colors.surfaceContainer)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick, onClickLabel = description)
            .semantics { contentDescription = description }
            .padding(2.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Box(
                    Modifier.size(22.dp).clip(CircleShape).background(if (isToday) colors.primary else androidx.compose.ui.graphics.Color.Transparent),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        date.dayOfMonth.toString(),
                        fontSize = 12.sp,
                        fontWeight = if (isToday) FontWeight.Bold else FontWeight.Medium,
                        color = when {
                            isToday -> colors.onPrimary
                            inMonth -> colors.onSurface
                            else -> colors.outline
                        },
                    )
                }
                if (hasConflict) Icon(Icons.Filled.Warning, null, Modifier.size(12.dp), tint = warn)
                if (busy) Box(Modifier.size(6.dp).background(colors.primary, CircleShape))
            }
            val shown = events.take(2)
            shown.forEach { o ->
                val cat = categories[o.categoryId]
                val c = categoryColor(cat)
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(3.dp))
                        .background(c.copy(alpha = 0.14f))
                        .then(if (o.key in conflictKeys) Modifier.border(1.dp, warn, RoundedCornerShape(3.dp)) else Modifier)
                        .clickable { onEvent(o) }
                        .padding(horizontal = 2.dp, vertical = 1.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Icon(categoryIcon(cat?.icon ?: "event"), null, Modifier.size(10.dp), tint = c)
                    Text(
                        formatTime(o.startTime, use24, locale) + " " + o.title,
                        fontSize = 9.sp, lineHeight = 11.sp, maxLines = 1, overflow = TextOverflow.Clip,
                        color = colors.onSurface,
                    )
                }
            }
            if (events.size > shown.size) {
                Text("+${events.size - shown.size}", fontSize = 9.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(start = 2.dp))
            }
        }
    }
}
