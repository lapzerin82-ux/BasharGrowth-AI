package com.bashar.physicianschedule.core

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

enum class Frequency { DAILY, WEEKLY, MONTHLY }

/**
 * A recurrence rule. The series' first occurrence is [startDate]; the series ends on
 * [endDate] (inclusive) or after [count] occurrences, whichever comes first, or never.
 *
 * For [Frequency.WEEKLY], [daysOfWeek] lists the weekdays and [interval] counts weeks.
 * For [Frequency.MONTHLY] the day of month of [startDate] is repeated; months that are
 * too short for that day are skipped.
 */
data class Recurrence(
    val id: String,
    val frequency: Frequency,
    val interval: Int = 1,
    val daysOfWeek: Set<DayOfWeek> = emptySet(),
    val startDate: LocalDate,
    val endDate: LocalDate? = null,
    val count: Int? = null,
)

/** The editable part of a recurrence, before it is attached to a series. */
data class RecurrenceRule(
    val frequency: Frequency,
    val interval: Int = 1,
    val daysOfWeek: Set<DayOfWeek> = emptySet(),
    val endDate: LocalDate? = null,
    val count: Int? = null,
) {
    fun toRecurrence(id: String, startDate: LocalDate): Recurrence {
        val days = if (frequency == Frequency.WEEKLY && daysOfWeek.isEmpty()) setOf(startDate.dayOfWeek) else daysOfWeek
        return Recurrence(id, frequency, interval.coerceAtLeast(1), days, startDate, endDate, count)
    }
}

fun Recurrence.toRule() = RecurrenceRule(frequency, interval, daysOfWeek, endDate, count)

/**
 * One stored row. There are three kinds:
 *  - a one-time event: [recurrenceId] is null;
 *  - a series master: [recurrenceId] set, [isException] false; its fields are the template
 *    for every occurrence and [date] equals the recurrence start date;
 *  - an exception: [recurrenceId] set, [isException] true, [occurrenceDate] names the
 *    original occurrence it replaces. [isCancelled] marks a deleted occurrence; otherwise
 *    the exception's fields (including a different [date]) override that occurrence.
 */
data class EventRecord(
    val id: String,
    val title: String,
    val categoryId: String,
    val date: LocalDate,
    val startTime: LocalTime,
    val endTime: LocalTime,
    val endsNextDay: Boolean = false,
    val location: String = "",
    val notes: String = "",
    val reminderMinutes: Int? = null,
    val recurrenceId: String? = null,
    val occurrenceDate: LocalDate? = null,
    val isException: Boolean = false,
    val isCancelled: Boolean = false,
    val isDemo: Boolean = false,
    val calendarId: String = DEFAULT_CALENDAR,
    val externalId: String? = null,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
) {
    val isSeriesMaster get() = recurrenceId != null && !isException
    val isSingle get() = recurrenceId == null

    companion object {
        const val DEFAULT_CALENDAR = "local"
    }
}

/** What the user fills in on the Add/Edit form. */
data class EventDraft(
    val title: String,
    val categoryId: String,
    val date: LocalDate,
    val startTime: LocalTime,
    val endTime: LocalTime,
    val endsNextDay: Boolean = false,
    val location: String = "",
    val notes: String = "",
    val reminderMinutes: Int? = null,
)

fun EventRecord.toDraft() = EventDraft(title, categoryId, date, startTime, endTime, endsNextDay, location, notes, reminderMinutes)

/** A concrete, dated appearance of an event, produced by expanding the stored rows. */
data class Occurrence(
    /** Stable identity: the event id for one-time events, "masterId|originalDate" for series. */
    val key: String,
    /** The row whose fields produced this occurrence (single, master or exception). */
    val sourceId: String,
    val masterId: String,
    val recurrenceId: String?,
    /** The date the recurrence rule generated; equals [date] unless the occurrence was moved. */
    val occurrenceDate: LocalDate,
    val date: LocalDate,
    val start: LocalDateTime,
    val end: LocalDateTime,
    val title: String,
    val categoryId: String,
    val location: String,
    val notes: String,
    val reminderMinutes: Int?,
    val isException: Boolean,
    val isDemo: Boolean,
) {
    val isRecurring get() = recurrenceId != null
    val startTime: LocalTime get() = start.toLocalTime()
    val endTime: LocalTime get() = end.toLocalTime()
    val endsNextDay get() = end.toLocalDate().isAfter(start.toLocalDate())

    fun toDraft() = EventDraft(title, categoryId, date, startTime, endTime, endsNextDay, location, notes, reminderMinutes)

    companion object {
        fun seriesKey(masterId: String, occurrenceDate: LocalDate) = "$masterId|$occurrenceDate"
    }
}

data class Category(
    val id: String,
    val name: String,
    val icon: String,
    val color: Long,
    val isCustom: Boolean,
    val sortOrder: Int = 0,
)

object DefaultCategories {
    const val TEACHING = "teaching"
    const val CONSULTATION = "consultation"
    const val NIGHT = "night"
    const val ON_CALL = "oncall"
    const val MEETING = "meeting"
    const val ACADEMIC = "academic"
    const val OTHER = "other"

    /** Names here are English fallbacks; the app shows localized names for built-in ids. */
    val all = listOf(
        Category(TEACHING, "Teaching", "school", 0xFF2F63C8, false, 0),
        Category(CONSULTATION, "Consultation", "medical", 0xFF0E7F6F, false, 1),
        Category(NIGHT, "Night Consultation", "night", 0xFF5A48B0, false, 2),
        Category(ON_CALL, "On-call", "hospital", 0xFFC0442F, false, 3),
        Category(MEETING, "Meeting", "groups", 0xFF7A5C12, false, 4),
        Category(ACADEMIC, "Academic Work", "science", 0xFF3D6B2F, false, 5),
        Category(OTHER, "Other", "event", 0xFF5F6B6A, false, 6),
    )
}

fun eventInterval(date: LocalDate, start: LocalTime, end: LocalTime, endsNextDay: Boolean): Pair<LocalDateTime, LocalDateTime> {
    val s = date.atTime(start)
    val e = (if (endsNextDay) date.plusDays(1) else date).atTime(end)
    return s to e
}
