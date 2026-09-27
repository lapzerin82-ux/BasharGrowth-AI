@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package com.bashar.physicianschedule.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.AssistChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Switch
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.bashar.physicianschedule.AppContainer
import com.bashar.physicianschedule.R
import com.bashar.physicianschedule.core.Category
import com.bashar.physicianschedule.core.Conflict
import com.bashar.physicianschedule.core.DefaultCategories
import com.bashar.physicianschedule.core.EditScope
import com.bashar.physicianschedule.core.EventDraft
import com.bashar.physicianschedule.core.EventRecord
import com.bashar.physicianschedule.core.Frequency
import com.bashar.physicianschedule.core.Mutation
import com.bashar.physicianschedule.core.Occurrence
import com.bashar.physicianschedule.core.RecurrenceRule
import com.bashar.physicianschedule.core.ScheduleOps
import com.bashar.physicianschedule.core.SeriesState
import com.bashar.physicianschedule.core.ValidationError
import com.bashar.physicianschedule.core.toRule
import com.bashar.physicianschedule.ui.LocalSettings
import com.bashar.physicianschedule.ui.LocalSnackbar
import com.bashar.physicianschedule.ui.common.ChoiceDialog
import com.bashar.physicianschedule.ui.common.ConflictWarningDialog
import com.bashar.physicianschedule.ui.common.DatePatterns
import com.bashar.physicianschedule.ui.common.DatePickerModal
import com.bashar.physicianschedule.ui.common.PickerField
import com.bashar.physicianschedule.ui.common.SelectField
import com.bashar.physicianschedule.ui.common.TimePickerModal
import com.bashar.physicianschedule.ui.common.appViewModel
import com.bashar.physicianschedule.ui.common.categoryColor
import com.bashar.physicianschedule.ui.common.categoryColorChoices
import com.bashar.physicianschedule.ui.common.categoryIcon
import com.bashar.physicianschedule.ui.common.categoryName
import com.bashar.physicianschedule.ui.common.currentLocale
import com.bashar.physicianschedule.ui.common.formatDate
import com.bashar.physicianschedule.ui.common.formatTime
import com.bashar.physicianschedule.ui.common.reminderLabel
import com.bashar.physicianschedule.ui.common.weekdayName
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.TextStyle

enum class RepeatChoice { NONE, DAILY, WEEKLY, MONTHLY, CUSTOM }
enum class RepeatEnd { NEVER, ON_DATE, AFTER_COUNT }

data class FormState(
    val loaded: Boolean = false,
    val notFound: Boolean = false,
    val isEdit: Boolean = false,
    val title: String = "",
    val categoryId: String = DefaultCategories.TEACHING,
    val date: LocalDate = LocalDate.now(),
    val start: LocalTime = LocalTime.of(9, 0),
    val end: LocalTime = LocalTime.of(10, 0),
    val endsNextDay: Boolean = false,
    val location: String = "",
    val notes: String = "",
    val reminder: Int? = null,
    val repeat: RepeatChoice = RepeatChoice.NONE,
    val customFrequency: Frequency = Frequency.WEEKLY,
    val interval: Int = 1,
    val weekdays: Set<DayOfWeek> = emptySet(),
    val repeatEnd: RepeatEnd = RepeatEnd.NEVER,
    val repeatEndDate: LocalDate = LocalDate.now().plusMonths(3),
    val repeatCount: Int = 10,
    val errors: Set<ValidationError> = emptySet(),
    val wasRecurring: Boolean = false,
) {
    fun toDraft() = EventDraft(title, categoryId, date, start, end, endsNextDay, location, notes, reminder)

    fun toRule(): RecurrenceRule? {
        val (freq, interval) = when (repeat) {
            RepeatChoice.NONE -> return null
            RepeatChoice.DAILY -> Frequency.DAILY to 1
            RepeatChoice.WEEKLY -> Frequency.WEEKLY to 1
            RepeatChoice.MONTHLY -> Frequency.MONTHLY to 1
            RepeatChoice.CUSTOM -> customFrequency to interval
        }
        return RecurrenceRule(
            frequency = freq,
            interval = interval,
            daysOfWeek = if (freq == Frequency.WEEKLY) weekdays else emptySet(),
            endDate = if (repeatEnd == RepeatEnd.ON_DATE) repeatEndDate else null,
            count = if (repeatEnd == RepeatEnd.AFTER_COUNT) repeatCount else null,
        )
    }

    val frequency: Frequency? get() = when (repeat) {
        RepeatChoice.NONE -> null
        RepeatChoice.DAILY -> Frequency.DAILY
        RepeatChoice.WEEKLY -> Frequency.WEEKLY
        RepeatChoice.MONTHLY -> Frequency.MONTHLY
        RepeatChoice.CUSTOM -> customFrequency
    }
}

data class PendingConflicts(val mutation: Mutation, val conflicts: List<Conflict>)

class EventFormViewModel(
    private val c: AppContainer,
    private val editKey: String?,
    initialDate: LocalDate?,
    private val duplicateOf: String?,
) : ViewModel() {
    private val _state = MutableStateFlow(FormState())
    val state: StateFlow<FormState> = _state

    val categories: StateFlow<List<Category>> = c.repository.categories.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val locations = MutableStateFlow<List<String>>(emptyList())

    val scopeChoices = MutableStateFlow<List<EditScope>?>(null)
    val pendingConflicts = MutableStateFlow<PendingConflicts?>(null)
    val saved = MutableStateFlow(false)

    private var original: Occurrence? = null
    private var single: EventRecord? = null
    private var series: SeriesState? = null
    private var originalRule: RecurrenceRule? = null
    private var endTouched = false

    init {
        viewModelScope.launch {
            locations.value = c.repository.recentLocations()
            val settings = c.settings.settings.value
            when {
                editKey != null -> {
                    val o = c.repository.findOccurrence(editKey)
                    if (o == null) { _state.value = FormState(loaded = true, notFound = true); return@launch }
                    original = o
                    var s = fromOccurrence(o).copy(isEdit = true)
                    if (o.recurrenceId != null) {
                        series = c.repository.series(o.recurrenceId)
                        series?.recurrence?.let { rec ->
                            originalRule = rec.toRule()
                            s = s.copy(
                                wasRecurring = true,
                                repeat = when {
                                    rec.interval != 1 -> RepeatChoice.CUSTOM
                                    rec.frequency == Frequency.DAILY -> RepeatChoice.DAILY
                                    rec.frequency == Frequency.WEEKLY -> RepeatChoice.WEEKLY
                                    else -> RepeatChoice.MONTHLY
                                },
                                customFrequency = rec.frequency,
                                interval = rec.interval,
                                weekdays = rec.daysOfWeek,
                                repeatEnd = when {
                                    rec.count != null -> RepeatEnd.AFTER_COUNT
                                    rec.endDate != null -> RepeatEnd.ON_DATE
                                    else -> RepeatEnd.NEVER
                                },
                                repeatEndDate = rec.endDate ?: o.date.plusMonths(3),
                                repeatCount = rec.count ?: 10,
                            )
                        }
                    } else {
                        single = c.repository.single(o.sourceId)
                    }
                    endTouched = true
                    _state.value = s.copy(loaded = true)
                }
                duplicateOf != null -> {
                    val o = c.repository.findOccurrence(duplicateOf)
                    endTouched = true
                    _state.value = (o?.let { fromOccurrence(it) } ?: FormState()).copy(loaded = true)
                }
                else -> {
                    val date = initialDate ?: LocalDate.now()
                    val start = if (date == LocalDate.now()) {
                        LocalTime.now().plusHours(1).withMinute(0).withSecond(0).withNano(0)
                    } else LocalTime.of(9, 0)
                    val end = start.plusMinutes(settings.defaultDurationMinutes.toLong())
                    _state.value = FormState(
                        loaded = true, date = date, start = start, end = end, endsNextDay = !end.isAfter(start),
                        reminder = settings.defaultReminderMinutes, weekdays = setOf(date.dayOfWeek),
                        repeatEndDate = date.plusMonths(3),
                    )
                }
            }
        }
    }

    private fun fromOccurrence(o: Occurrence) = FormState(
        title = o.title, categoryId = o.categoryId, date = o.date, start = o.startTime, end = o.endTime,
        endsNextDay = o.endsNextDay, location = o.location, notes = o.notes, reminder = o.reminderMinutes,
        weekdays = setOf(o.date.dayOfWeek), repeatEndDate = o.date.plusMonths(3),
    )

    fun update(transform: (FormState) -> FormState) = _state.update { transform(it).copy(errors = emptySet()) }

    fun setDate(d: LocalDate) = update { s ->
        val days = if (s.weekdays == setOf(s.date.dayOfWeek)) setOf(d.dayOfWeek) else s.weekdays
        s.copy(date = d, weekdays = days, repeatEndDate = if (s.repeatEndDate.isBefore(d)) d.plusMonths(3) else s.repeatEndDate)
    }

    fun setStart(t: LocalTime) = update { s ->
        if (endTouched) s.copy(start = t, endsNextDay = !s.end.isAfter(t))
        else {
            val end = t.plusMinutes(c.settings.settings.value.defaultDurationMinutes.toLong())
            s.copy(start = t, end = end, endsNextDay = !end.isAfter(t))
        }
    }

    fun setEnd(t: LocalTime) {
        endTouched = true
        // Picking an end at or before the start is almost always an overnight duty.
        update { s -> s.copy(end = t, endsNextDay = !t.isAfter(s.start)) }
    }

    fun addCategory(name: String, color: Long, icon: String) = viewModelScope.launch {
        val cat = c.repository.addCategory(name, color, icon)
        update { it.copy(categoryId = cat.id) }
    }

    fun save() {
        val s = _state.value
        val draft = s.toDraft()
        val rule = s.toRule()
        val errors = ScheduleOps.validate(draft, rule)
        if (errors.isNotEmpty()) { _state.update { it.copy(errors = errors.toSet()) }; return }
        if (original?.isRecurring == true) {
            val ruleChanged = rule != originalRule
            scopeChoices.value = if (ruleChanged) listOf(EditScope.THIS_AND_FUTURE, EditScope.ENTIRE_SERIES)
            else listOf(EditScope.THIS_ONLY, EditScope.THIS_AND_FUTURE, EditScope.ENTIRE_SERIES)
        } else proceed(null)
    }

    fun proceed(scope: EditScope?) {
        scopeChoices.value = null
        val s = _state.value
        val draft = s.toDraft()
        val rule = s.toRule()
        val o = original
        val m = when {
            o == null -> ScheduleOps.create(draft, rule)
            o.isRecurring -> ScheduleOps.editOccurrence(series ?: return, o.occurrenceDate, draft, rule, scope ?: EditScope.THIS_ONLY)
            else -> ScheduleOps.editSingle(single ?: return, draft, rule)
        }
        viewModelScope.launch {
            val today = LocalDate.now()
            val from = minOf(draft.date, today)
            val to = if (rule != null && scope != EditScope.THIS_ONLY) maxOf(draft.date, today).plusYears(1) else draft.date.plusDays(1)
            val conflicts = c.repository.previewConflicts(m, from, to)
            if (conflicts.isEmpty()) commit(m) else pendingConflicts.value = PendingConflicts(m, conflicts)
        }
    }

    fun commit(m: Mutation) = viewModelScope.launch {
        pendingConflicts.value = null
        c.repository.apply(m)
        saved.value = true
    }
}

@Composable
fun EventFormScreen(nav: NavController, editKey: String?, initialDate: LocalDate?, duplicateOf: String?) {
    val vm = appViewModel(key = "form:$editKey:$initialDate:$duplicateOf") { EventFormViewModel(it, editKey, initialDate, duplicateOf) }
    val s by vm.state.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    val locations by vm.locations.collectAsStateWithLifecycle()
    val scopes by vm.scopeChoices.collectAsStateWithLifecycle()
    val pending by vm.pendingConflicts.collectAsStateWithLifecycle()
    val saved by vm.saved.collectAsStateWithLifecycle()
    val settings = LocalSettings.current
    val locale = currentLocale()
    val context = LocalContext.current
    val snackbar = LocalSnackbar.current
    val savedMsg = stringResource(R.string.event_saved)

    LaunchedEffect(saved) {
        if (saved) {
            nav.popBackStack()
            snackbar.showSnackbar(savedMsg)
        }
    }

    var picker by remember { mutableStateOf<String?>(null) }
    var newCategory by remember { mutableStateOf(false) }
    var customReminder by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.Filled.Close, stringResource(R.string.cancel)) } },
                title = { Text(stringResource(if (s.isEdit) R.string.edit_event else R.string.add_event)) },
                actions = { TextButton(onClick = vm::save, enabled = s.loaded && !s.notFound) { Text(stringResource(R.string.save)) } },
            )
        },
    ) { padding ->
        if (s.notFound) {
            Box(Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.Center) { Text(stringResource(R.string.event_not_found)) }
            return@Scaffold
        }
        if (!s.loaded) return@Scaffold
        Column(
            Modifier.padding(padding).fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            OutlinedTextField(
                value = s.title, onValueChange = { v -> vm.update { it.copy(title = v) } },
                label = { Text(stringResource(R.string.field_title)) },
                placeholder = { Text(stringResource(R.string.field_title_hint)) },
                isError = ValidationError.EMPTY_TITLE in s.errors,
                supportingText = if (ValidationError.EMPTY_TITLE in s.errors) ({ Text(stringResource(R.string.error_title)) }) else null,
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.field_category), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                CategoryChips(categories, s.categoryId, onAdd = { newCategory = true }) { id -> vm.update { it.copy(categoryId = id) } }
            }

            PickerField(stringResource(R.string.field_date), formatDate(s.date, DatePatterns.FULL, locale), Icons.Filled.DateRange, { picker = "date" })
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PickerField(stringResource(R.string.field_start), formatTime(s.start, settings.use24Hour, locale), Icons.Filled.Schedule, { picker = "start" }, Modifier.weight(1f))
                PickerField(
                    stringResource(R.string.field_end), formatTime(s.end, settings.use24Hour, locale), Icons.Filled.Schedule, { picker = "end" }, Modifier.weight(1f),
                    isError = ValidationError.END_NOT_AFTER_START in s.errors,
                )
            }
            if (ValidationError.END_NOT_AFTER_START in s.errors) {
                Text(stringResource(R.string.error_end_time), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.ends_next_day))
                    Text(stringResource(R.string.ends_next_day_hint), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(checked = s.endsNextDay, onCheckedChange = { v -> vm.update { it.copy(endsNextDay = v) } })
            }

            OutlinedTextField(
                value = s.location, onValueChange = { v -> vm.update { it.copy(location = v) } },
                label = { Text(stringResource(R.string.field_location)) },
                placeholder = { Text(stringResource(R.string.field_location_hint)) },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            val suggestions = locations.filter { it != s.location && it.contains(s.location, ignoreCase = true) }.take(6)
            if (suggestions.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    suggestions.forEach { loc -> SuggestionChip(onClick = { vm.update { it.copy(location = loc) } }, label = { Text(loc) }) }
                }
            }

            OutlinedTextField(
                value = s.notes, onValueChange = { v -> vm.update { it.copy(notes = v) } },
                label = { Text(stringResource(R.string.field_notes)) },
                minLines = 3, modifier = Modifier.fillMaxWidth(),
            )

            RepeatSection(s, vm, locale) { picker = "repeatEnd" }

            val reminderOptions = listOf<Int?>(null, 10, 30, 60, 1440)
            SelectField(
                label = stringResource(R.string.field_reminder),
                selectedText = reminderLabel(context, s.reminder),
                options = reminderOptions.map { it to reminderLabel(context, it) } + listOf(CUSTOM_REMINDER to stringResource(R.string.reminder_custom)),
                onSelect = { v -> if (v == CUSTOM_REMINDER) customReminder = true else vm.update { it.copy(reminder = v) } },
                leading = Icons.Filled.Notifications,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = { nav.popBackStack() }, modifier = Modifier.weight(1f).height(52.dp)) { Text(stringResource(R.string.cancel)) }
                Button(onClick = vm::save, modifier = Modifier.weight(1f).height(52.dp)) { Text(stringResource(R.string.save_event)) }
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    when (picker) {
        "date" -> DatePickerModal(s.date, vm::setDate) { picker = null }
        "repeatEnd" -> DatePickerModal(s.repeatEndDate, { d -> vm.update { it.copy(repeatEndDate = d) } }) { picker = null }
        "start" -> TimePickerModal(s.start, settings.use24Hour, vm::setStart) { picker = null }
        "end" -> TimePickerModal(s.end, settings.use24Hour, vm::setEnd) { picker = null }
    }

    if (newCategory) NewCategoryDialog(onDismiss = { newCategory = false }) { name, color, icon -> vm.addCategory(name, color, icon); newCategory = false }
    if (customReminder) CustomReminderDialog(onDismiss = { customReminder = false }) { minutes -> vm.update { it.copy(reminder = minutes) }; customReminder = false }

    scopes?.let { choices ->
        ChoiceDialog(
            title = stringResource(R.string.scope_edit_title),
            options = choices.map { it to scopeLabel(it, delete = false) },
            onPick = vm::proceed,
            onDismiss = { vm.scopeChoices.value = null },
        )
    }
    pending?.let { p ->
        val touched = p.mutation.touchedSourceIds
        ConflictWarningDialog(
            conflicts = p.conflicts,
            touchedKeys = { c -> if (c.first.sourceId in touched) c.second else c.first },
            use24 = settings.use24Hour,
            onSaveAnyway = { vm.commit(p.mutation) },
            onEdit = { vm.pendingConflicts.value = null },
        )
    }
}

private const val CUSTOM_REMINDER = -2

@Composable
fun scopeLabel(scope: EditScope, delete: Boolean): String = stringResource(
    when (scope) {
        EditScope.THIS_ONLY -> if (delete) R.string.scope_delete_this else R.string.scope_this
        EditScope.THIS_AND_FUTURE -> if (delete) R.string.scope_delete_future else R.string.scope_future
        EditScope.ENTIRE_SERIES -> if (delete) R.string.scope_delete_all else R.string.scope_all
    },
)

@Composable
private fun CategoryChips(categories: List<Category>, selected: String, onAdd: () -> Unit, onSelect: (String) -> Unit) {
    // Chips instead of a closed dropdown: one tap, and every option is visible at once.
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        categories.forEach { c ->
            val color = categoryColor(c)
            FilterChip(
                selected = c.id == selected,
                onClick = { onSelect(c.id) },
                label = { Text(categoryName(c)) },
                leadingIcon = { Icon(categoryIcon(c.icon), null, Modifier.size(18.dp), tint = color) },
            )
        }
        AssistChip(onClick = onAdd, label = { Text(stringResource(R.string.add_custom_category)) }, leadingIcon = { Icon(Icons.Filled.Add, null, Modifier.size(18.dp)) })
    }
}

@Composable
private fun RepeatSection(s: FormState, vm: EventFormViewModel, locale: java.util.Locale, onPickEndDate: () -> Unit) {
    val repeatLabels = mapOf(
        RepeatChoice.NONE to stringResource(R.string.repeat_none),
        RepeatChoice.DAILY to stringResource(R.string.repeat_daily),
        RepeatChoice.WEEKLY to stringResource(R.string.repeat_weekly),
        RepeatChoice.MONTHLY to stringResource(R.string.repeat_monthly),
        RepeatChoice.CUSTOM to stringResource(R.string.repeat_custom),
    )
    SelectField(
        label = stringResource(R.string.field_repeat),
        selectedText = repeatLabels.getValue(s.repeat),
        options = repeatLabels.toList(),
        onSelect = { v ->
            vm.update {
                it.copy(
                    repeat = v,
                    weekdays = it.weekdays.ifEmpty { setOf(it.date.dayOfWeek) },
                    interval = if (v == RepeatChoice.CUSTOM) it.interval.coerceAtLeast(1) else 1,
                )
            }
        },
        leading = Icons.Filled.Repeat,
    )
    if (s.repeat == RepeatChoice.NONE) return

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (s.repeat == RepeatChoice.CUSTOM) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.repeat_every))
                OutlinedTextField(
                    value = s.interval.toString(),
                    onValueChange = { v -> v.filter { it.isDigit() }.take(2).toIntOrNull()?.let { n -> vm.update { it.copy(interval = n.coerceAtLeast(1)) } } },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.size(width = 72.dp, height = 56.dp),
                    isError = ValidationError.INVALID_INTERVAL in s.errors,
                )
                val units = listOf(
                    Frequency.DAILY to stringResource(R.string.unit_days),
                    Frequency.WEEKLY to stringResource(R.string.unit_weeks),
                    Frequency.MONTHLY to stringResource(R.string.unit_months),
                )
                SelectField(
                    label = "",
                    selectedText = units.first { it.first == s.customFrequency }.second,
                    options = units,
                    onSelect = { f -> vm.update { it.copy(customFrequency = f) } },
                    modifier = Modifier.weight(1f),
                )
            }
        }
        if (s.frequency == Frequency.WEEKLY) {
            Text(stringResource(R.string.repeat_on_days), style = MaterialTheme.typography.labelMedium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val first = LocalSettings.current.firstDayOfWeek
                (0 until 7).map { first.plus(it.toLong()) }.forEach { d ->
                    val on = d in s.weekdays
                    Box(
                        Modifier.size(44.dp)
                            .background(if (on) MaterialTheme.colorScheme.primary else Color.Transparent, CircleShape)
                            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                            .clickable(role = Role.Checkbox) { vm.update { it.copy(weekdays = if (on) it.weekdays - d else it.weekdays + d) } }
                            .semantics { contentDescription = weekdayName(d, locale) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            weekdayName(d, locale, TextStyle.SHORT).take(3),
                            color = if (on) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
            }
            if (ValidationError.NO_WEEKDAYS in s.errors) Text(stringResource(R.string.error_weekdays), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Text(stringResource(R.string.repeat_ends), style = MaterialTheme.typography.labelMedium)
        EndOption(s.repeatEnd == RepeatEnd.NEVER, stringResource(R.string.repeat_end_never)) { vm.update { it.copy(repeatEnd = RepeatEnd.NEVER) } }
        EndOption(s.repeatEnd == RepeatEnd.ON_DATE, stringResource(R.string.repeat_end_on, formatDate(s.repeatEndDate, DatePatterns.SHORT + " yyyy", locale))) {
            vm.update { it.copy(repeatEnd = RepeatEnd.ON_DATE) }; onPickEndDate()
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected = s.repeatEnd == RepeatEnd.AFTER_COUNT, onClick = { vm.update { it.copy(repeatEnd = RepeatEnd.AFTER_COUNT) } })
            Text(stringResource(R.string.repeat_end_after))
            OutlinedTextField(
                value = s.repeatCount.toString(),
                onValueChange = { v -> v.filter { it.isDigit() }.take(3).toIntOrNull()?.let { n -> vm.update { it.copy(repeatCount = n, repeatEnd = RepeatEnd.AFTER_COUNT) } } },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.padding(horizontal = 8.dp).size(width = 80.dp, height = 56.dp),
            )
            Text(stringResource(R.string.repeat_occurrences))
        }
        if (ValidationError.INVALID_REPEAT_END in s.errors) Text(stringResource(R.string.error_repeat_end), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun EndOption(selected: Boolean, text: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).height(44.dp), verticalAlignment = Alignment.CenterVertically) {
        RadioButton(selected = selected, onClick = onClick)
        Text(text)
    }
}

@Composable
private fun NewCategoryDialog(onDismiss: () -> Unit, onCreate: (String, Long, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var color by remember { mutableStateOf(categoryColorChoices.first()) }
    var icon by remember { mutableStateOf("star") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.add_custom_category)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text(stringResource(R.string.category_name)) }, singleLine = true)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    categoryColorChoices.forEach { c ->
                        Box(
                            Modifier.size(36.dp).background(Color(c), CircleShape)
                                .border(if (c == color) 3.dp else 0.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                                .clickable { color = c },
                        )
                    }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    com.bashar.physicianschedule.ui.common.categoryIconKeys.forEach { k ->
                        FilterChip(selected = k == icon, onClick = { icon = k }, label = { Icon(categoryIcon(k), null, Modifier.size(18.dp)) })
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { if (name.isNotBlank()) onCreate(name, color, icon) }, enabled = name.isNotBlank()) { Text(stringResource(R.string.save)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

@Composable
private fun CustomReminderDialog(onDismiss: () -> Unit, onSet: (Int) -> Unit) {
    var text by remember { mutableStateOf("15") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.reminder_custom)) },
        text = {
            OutlinedTextField(
                text, { v -> text = v.filter { it.isDigit() }.take(5) },
                label = { Text(stringResource(R.string.minutes_before)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
            )
        },
        confirmButton = { TextButton(onClick = { text.toIntOrNull()?.let(onSet) }, enabled = text.toIntOrNull() != null) { Text(stringResource(R.string.ok)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}
