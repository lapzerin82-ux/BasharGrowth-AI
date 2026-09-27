@file:OptIn(ExperimentalMaterial3Api::class)

package com.bashar.physicianschedule.ui.common

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.bashar.physicianschedule.AppContainer
import com.bashar.physicianschedule.R
import com.bashar.physicianschedule.container
import com.bashar.physicianschedule.core.Category
import com.bashar.physicianschedule.core.Conflict
import com.bashar.physicianschedule.core.DefaultCategories
import com.bashar.physicianschedule.core.Frequency
import com.bashar.physicianschedule.core.Occurrence
import com.bashar.physicianschedule.core.Recurrence
import com.bashar.physicianschedule.ui.theme.LocalExtraColors
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

// ---- view models ------------------------------------------------------------------------

/** Creates a ViewModel with access to the app container; [key] separates instances per argument. */
@Composable
inline fun <reified VM : ViewModel> appViewModel(key: String? = null, crossinline create: (AppContainer) -> VM): VM {
    val container = LocalContext.current.container
    return viewModel(key = key, factory = viewModelFactory { initializer { create(container) } })
}

// ---- formatting -------------------------------------------------------------------------

@Composable
@ReadOnlyComposable
fun currentLocale(): Locale = LocalConfiguration.current.locales[0] ?: Locale.getDefault()

fun formatTime(t: LocalTime, use24: Boolean, locale: Locale = Locale.getDefault()): String =
    t.format(DateTimeFormatter.ofPattern(if (use24) "HH:mm" else "h:mm a", locale))

fun formatRange(o: Occurrence, use24: Boolean, locale: Locale = Locale.getDefault()): String =
    formatTime(o.startTime, use24, locale) + "–" + formatTime(o.endTime, use24, locale)

fun formatDate(d: LocalDate, pattern: String, locale: Locale): String = d.format(DateTimeFormatter.ofPattern(pattern, locale))

object DatePatterns {
    const val FULL = "EEEE, d MMMM yyyy"
    const val DAY = "EEEE, d MMMM"
    const val SHORT = "EEE d MMM"
    const val MONTH_YEAR = "LLLL yyyy"
}

fun LocalDate.toPickerMillis(): Long = atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
fun Long.fromPickerMillis(): LocalDate = Instant.ofEpochMilli(this).atZone(ZoneOffset.UTC).toLocalDate()

fun weekdayName(d: DayOfWeek, locale: Locale, style: TextStyle = TextStyle.FULL): String = d.getDisplayName(style, locale)

fun reminderLabel(context: Context, minutes: Int?): String = when (minutes) {
    null -> context.getString(R.string.reminder_none)
    10 -> context.getString(R.string.reminder_10m)
    30 -> context.getString(R.string.reminder_30m)
    60 -> context.getString(R.string.reminder_1h)
    1440 -> context.getString(R.string.reminder_1d)
    else -> if (minutes % 60 == 0) context.getString(R.string.reminder_custom_hours, minutes / 60)
    else context.getString(R.string.reminder_custom_minutes, minutes)
}

fun repeatDescription(context: Context, r: Recurrence, locale: Locale): String {
    val base = when (r.frequency) {
        Frequency.DAILY -> if (r.interval == 1) context.getString(R.string.repeat_every_day) else context.getString(R.string.repeat_every_n_days, r.interval)
        Frequency.WEEKLY -> {
            val days = r.daysOfWeek.sortedBy { it.value }.joinToString(context.getString(R.string.list_separator)) { weekdayName(it, locale) }
            if (r.interval == 1) context.getString(R.string.repeat_every_weekday, days) else context.getString(R.string.repeat_every_n_weeks, r.interval, days)
        }
        Frequency.MONTHLY -> if (r.interval == 1) context.getString(R.string.repeat_every_month, r.startDate.dayOfMonth)
        else context.getString(R.string.repeat_every_n_months, r.interval, r.startDate.dayOfMonth)
    }
    val end = when {
        r.count != null -> context.getString(R.string.repeat_times, r.count)
        r.endDate != null -> context.getString(R.string.repeat_until, formatDate(r.endDate, DatePatterns.SHORT + " yyyy", locale))
        else -> null
    }
    return if (end == null) base else "$base · $end"
}

// ---- categories -------------------------------------------------------------------------

val categoryIconKeys = listOf("school", "medical", "night", "hospital", "groups", "science", "event", "work", "star", "heart")

fun categoryIcon(key: String): ImageVector = when (key) {
    "school" -> Icons.Filled.School
    "medical" -> Icons.Filled.MedicalServices
    "night" -> Icons.Filled.Bedtime
    "hospital" -> Icons.Filled.LocalHospital
    "groups" -> Icons.Filled.Groups
    "science" -> Icons.Filled.Science
    "work" -> Icons.Filled.Work
    "star" -> Icons.Filled.Star
    "heart" -> Icons.Filled.Favorite
    else -> Icons.Filled.Event
}

val categoryColorChoices = listOf(0xFF2F63C8, 0xFF0E7F6F, 0xFF5A48B0, 0xFFC0442F, 0xFF7A5C12, 0xFF3D6B2F, 0xFFAD3A78, 0xFF5F6B6A)

@Composable
fun categoryName(c: Category?): String = when (c?.id) {
    null -> stringResource(R.string.cat_other)
    DefaultCategories.TEACHING -> stringResource(R.string.cat_teaching)
    DefaultCategories.CONSULTATION -> stringResource(R.string.cat_consultation)
    DefaultCategories.NIGHT -> stringResource(R.string.cat_night)
    DefaultCategories.ON_CALL -> stringResource(R.string.cat_oncall)
    DefaultCategories.MEETING -> stringResource(R.string.cat_meeting)
    DefaultCategories.ACADEMIC -> stringResource(R.string.cat_academic)
    DefaultCategories.OTHER -> stringResource(R.string.cat_other)
    else -> c?.name.orEmpty()
}

fun categoryNameFor(context: Context, c: Category?): String = when (c?.id) {
    null -> context.getString(R.string.cat_other)
    DefaultCategories.TEACHING -> context.getString(R.string.cat_teaching)
    DefaultCategories.CONSULTATION -> context.getString(R.string.cat_consultation)
    DefaultCategories.NIGHT -> context.getString(R.string.cat_night)
    DefaultCategories.ON_CALL -> context.getString(R.string.cat_oncall)
    DefaultCategories.MEETING -> context.getString(R.string.cat_meeting)
    DefaultCategories.ACADEMIC -> context.getString(R.string.cat_academic)
    DefaultCategories.OTHER -> context.getString(R.string.cat_other)
    else -> c?.name.orEmpty()
}

/** Category color adjusted for the current theme so it stays legible on dark surfaces. */
@Composable
fun categoryColor(c: Category?): Color {
    val base = Color(c?.color ?: 0xFF5F6B6A)
    return if (LocalExtraColors.current.isDark) lerp(base, Color.White, 0.45f) else base
}

@Composable
fun CategoryBadge(c: Category?, size: Dp = 32.dp) {
    val color = categoryColor(c)
    Box(
        Modifier.size(size).background(color.copy(alpha = 0.16f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(categoryIcon(c?.icon ?: "event"), contentDescription = null, tint = color, modifier = Modifier.size(size * 0.58f))
    }
}

// ---- shared pieces ----------------------------------------------------------------------

/**
 * One event as a card: colored stripe + icon + category label (so color is never the only
 * cue), then time, title and location in that order of emphasis.
 */
@Composable
fun EventCard(
    o: Occurrence,
    category: Category?,
    use24: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    conflictWith: List<Occurrence> = emptyList(),
    showDate: Boolean = false,
) {
    val locale = currentLocale()
    val color = categoryColor(category)
    val warn = LocalExtraColors.current.warning
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (conflictWith.isNotEmpty()) warn else MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            Box(Modifier.width(5.dp).fillMaxHeight().background(color))
            Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                CategoryBadge(category, 36.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    val timeText = buildString {
                        if (showDate) append(formatDate(o.date, DatePatterns.SHORT, locale)).append(" · ")
                        append(formatRange(o, use24, locale))
                        if (o.endsNextDay) append(" (+1)")
                    }
                    Text(timeText, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(o.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(categoryName(category), style = MaterialTheme.typography.labelMedium, color = color)
                        if (o.isRecurring) Icon(Icons.Filled.Repeat, stringResource(R.string.recurring), Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (o.isDemo) DemoTag()
                    }
                    if (o.location.isNotBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Filled.LocationOn, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(o.location, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    if (conflictWith.isNotEmpty()) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Filled.Warning, null, Modifier.size(14.dp), tint = warn)
                            Text(
                                stringResource(R.string.overlaps_with, conflictWith.joinToString(", ") { it.title }),
                                style = MaterialTheme.typography.labelMedium, color = warn,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DemoTag() {
    Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(4.dp)) {
        Text(stringResource(R.string.demo_tag), Modifier.padding(horizontal = 6.dp, vertical = 1.dp), style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(currentLocale()),
        modifier = modifier.padding(top = 12.dp, bottom = 4.dp),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
fun EmptyState(icon: ImageVector, text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, null, Modifier.size(40.dp), tint = MaterialTheme.colorScheme.outline)
        Text(text, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        action?.invoke()
    }
}

/** A read-only field that opens a picker when tapped. */
@Composable
fun PickerField(label: String, value: String, icon: ImageVector, onClick: () -> Unit, modifier: Modifier = Modifier, isError: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = if (isError) colors.error else colors.onSurfaceVariant)
        Surface(
            shape = RoundedCornerShape(10.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, if (isError) colors.error else colors.outline),
            color = colors.surface,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp).clickable(onClick = onClick)
                .semantics { contentDescription = "$label: $value" },
        ) {
            Row(Modifier.padding(horizontal = 12.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(icon, null, Modifier.size(20.dp), tint = colors.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Composable
fun DatePickerModal(initial: LocalDate, onPicked: (LocalDate) -> Unit, onDismiss: () -> Unit) {
    val state = rememberDatePickerState(initialSelectedDateMillis = initial.toPickerMillis())
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { state.selectedDateMillis?.let { onPicked(it.fromPickerMillis()) }; onDismiss() }) { Text(stringResource(R.string.ok)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    ) { DatePicker(state = state) }
}

@Composable
fun TimePickerModal(initial: LocalTime, is24: Boolean, onPicked: (LocalTime) -> Unit, onDismiss: () -> Unit) {
    val state = rememberTimePickerState(initial.hour, initial.minute, is24)
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = { onPicked(LocalTime.of(state.hour, state.minute)); onDismiss() }) { Text(stringResource(R.string.ok)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
        text = { TimePicker(state = state) },
    )
}

/** "What do you want to change / delete?" for recurring events. */
@Composable
fun <T> ChoiceDialog(title: String, options: List<Pair<T, String>>, onPick: (T) -> Unit, onDismiss: () -> Unit, destructive: Boolean = false) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                options.forEach { (value, label) ->
                    OutlinedButton(
                        onClick = { onPick(value) },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        colors = if (destructive) androidx.compose.material3.ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                        else androidx.compose.material3.ButtonDefaults.outlinedButtonColors(),
                    ) { Text(label) }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

/** Shown before saving when the change would overlap existing events. */
@Composable
fun ConflictWarningDialog(conflicts: List<Conflict>, touchedKeys: (Conflict) -> Occurrence, use24: Boolean, onSaveAnyway: () -> Unit, onEdit: () -> Unit) {
    val locale = currentLocale()
    AlertDialog(
        onDismissRequest = onEdit,
        icon = { Icon(Icons.Filled.Warning, null, tint = LocalExtraColors.current.warning) },
        title = { Text(stringResource(R.string.conflict_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(stringResource(R.string.conflict_overlaps_with))
                conflicts.take(4).forEach { c ->
                    val other = touchedKeys(c)
                    Column {
                        Text(other.title, fontWeight = FontWeight.SemiBold)
                        Text(formatDate(other.date, DatePatterns.SHORT, locale) + " · " + formatRange(other, use24, locale), style = MaterialTheme.typography.bodyMedium)
                        if (other.location.isNotBlank()) Text(other.location, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (conflicts.size > 4) Text(stringResource(R.string.conflict_more, conflicts.size - 4))
            }
        },
        confirmButton = { TextButton(onClick = onSaveAnyway) { Text(stringResource(R.string.save_anyway)) } },
        dismissButton = { TextButton(onClick = onEdit) { Text(stringResource(R.string.edit_event)) } },
    )
}

/** A labelled field that opens a menu of options. */
@Composable
fun <T> SelectField(
    label: String,
    selectedText: String,
    options: List<Pair<T, String>>,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
    leading: ImageVector? = null,
    optionIcon: (@Composable (T) -> Unit)? = null,
    footer: (@Composable (close: () -> Unit) -> Unit)? = null,
) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        PickerField(label, selectedText, leading ?: Icons.Filled.ArrowDropDown, onClick = { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (value, text) ->
                DropdownMenuItem(
                    text = { Text(text) },
                    leadingIcon = if (optionIcon != null) ({ optionIcon(value) }) else null,
                    onClick = { onSelect(value); open = false },
                    modifier = Modifier.heightIn(min = 48.dp),
                )
            }
            footer?.invoke { open = false }
        }
    }
}
