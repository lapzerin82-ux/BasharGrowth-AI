package com.bashar.physicianschedule.core

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/** A set of row changes that must be applied together in one database transaction. */
data class Mutation(
    val upsertEvents: List<EventRecord> = emptyList(),
    val upsertRecurrences: List<Recurrence> = emptyList(),
    val deleteEventIds: Set<String> = emptySet(),
    val deleteRecurrenceIds: Set<String> = emptySet(),
) {
    operator fun plus(o: Mutation) = Mutation(
        upsertEvents + o.upsertEvents,
        upsertRecurrences + o.upsertRecurrences,
        deleteEventIds + o.deleteEventIds,
        deleteRecurrenceIds + o.deleteRecurrenceIds,
    )

    /** Ids of rows written by this mutation; their occurrences are the ones to conflict-check. */
    val touchedSourceIds: Set<String> get() = upsertEvents.map { it.id }.toSet()

    /** Applies the mutation to an in-memory snapshot (used to preview conflicts before saving). */
    fun applyTo(events: Collection<EventRecord>, recurrences: Map<String, Recurrence>): Pair<List<EventRecord>, Map<String, Recurrence>> {
        val ev = LinkedHashMap<String, EventRecord>()
        events.forEach { ev[it.id] = it }
        deleteEventIds.forEach { ev.remove(it) }
        upsertEvents.forEach { ev[it.id] = it }
        val rec = LinkedHashMap(recurrences)
        deleteRecurrenceIds.forEach { rec.remove(it) }
        upsertRecurrences.forEach { rec[it.id] = it }
        return ev.values.toList() to rec
    }
}

enum class EditScope { THIS_ONLY, THIS_AND_FUTURE, ENTIRE_SERIES }

/** Everything the operations need to know about one series. */
data class SeriesState(
    val master: EventRecord,
    val recurrence: Recurrence,
    val exceptions: List<EventRecord>,
)

enum class ValidationError { EMPTY_TITLE, END_NOT_AFTER_START, INVALID_REPEAT_END, INVALID_INTERVAL, NO_WEEKDAYS }

object ScheduleOps {

    var idGenerator: () -> String = { UUID.randomUUID().toString() }
    var clock: () -> Long = { System.currentTimeMillis() }

    fun validate(draft: EventDraft, rule: RecurrenceRule?): List<ValidationError> {
        val errors = ArrayList<ValidationError>()
        if (draft.title.isBlank()) errors += ValidationError.EMPTY_TITLE
        if (!draft.endsNextDay && !draft.endTime.isAfter(draft.startTime)) errors += ValidationError.END_NOT_AFTER_START
        if (rule != null) {
            if (rule.interval < 1) errors += ValidationError.INVALID_INTERVAL
            if (rule.endDate != null && rule.endDate.isBefore(draft.date)) errors += ValidationError.INVALID_REPEAT_END
            if (rule.count != null && rule.count < 1) errors += ValidationError.INVALID_REPEAT_END
            if (rule.frequency == Frequency.WEEKLY && rule.daysOfWeek.isEmpty()) errors += ValidationError.NO_WEEKDAYS
        }
        return errors
    }

    private fun EventRecord.withDraft(d: EventDraft, now: Long) = copy(
        title = d.title.trim(), categoryId = d.categoryId, date = d.date,
        startTime = d.startTime, endTime = d.endTime, endsNextDay = d.endsNextDay,
        location = d.location.trim(), notes = d.notes.trim(), reminderMinutes = d.reminderMinutes,
        isDemo = false, updatedAt = now,
    )

    private fun newRecord(d: EventDraft, now: Long, recurrenceId: String? = null) = EventRecord(
        id = idGenerator(), title = d.title.trim(), categoryId = d.categoryId, date = d.date,
        startTime = d.startTime, endTime = d.endTime, endsNextDay = d.endsNextDay,
        location = d.location.trim(), notes = d.notes.trim(), reminderMinutes = d.reminderMinutes,
        recurrenceId = recurrenceId, createdAt = now, updatedAt = now,
    )

    /** Creates a one-time event, or a series when [rule] is given. */
    fun create(draft: EventDraft, rule: RecurrenceRule?): Mutation {
        val now = clock()
        if (rule == null) return Mutation(upsertEvents = listOf(newRecord(draft, now)))
        val rec = rule.toRecurrence(idGenerator(), draft.date)
        return Mutation(upsertEvents = listOf(newRecord(draft, now, rec.id)), upsertRecurrences = listOf(rec))
    }

    /** Edits a one-time event. Passing a [rule] turns it into a series starting on the draft date. */
    fun editSingle(event: EventRecord, draft: EventDraft, rule: RecurrenceRule?): Mutation {
        val now = clock()
        if (rule == null) return Mutation(upsertEvents = listOf(event.withDraft(draft, now)))
        val rec = rule.toRecurrence(idGenerator(), draft.date)
        return Mutation(upsertEvents = listOf(event.withDraft(draft, now).copy(recurrenceId = rec.id)), upsertRecurrences = listOf(rec))
    }

    /**
     * Edits the occurrence of [series] originally dated [occurrenceDate].
     * [rule] is the (possibly changed) recurrence; null means "does not repeat" and, for the
     * whole series, turns it back into a one-time event. It is ignored for [EditScope.THIS_ONLY].
     */
    fun editOccurrence(series: SeriesState, occurrenceDate: LocalDate, draft: EventDraft, rule: RecurrenceRule?, scope: EditScope): Mutation {
        val now = clock()
        val rec = series.recurrence
        val isFirst = RecurrenceEngine.countBefore(rec, occurrenceDate) == 0
        return when {
            scope == EditScope.THIS_ONLY -> {
                val existing = series.exceptions.firstOrNull { it.occurrenceDate == occurrenceDate }
                val base = existing ?: series.master.copy(
                    id = idGenerator(), recurrenceId = rec.id, occurrenceDate = occurrenceDate,
                    isException = true, isCancelled = false, createdAt = now,
                )
                Mutation(upsertEvents = listOf(base.withDraft(draft, now).copy(isException = true, isCancelled = false, occurrenceDate = occurrenceDate)))
            }
            scope == EditScope.ENTIRE_SERIES || isFirst -> editWholeSeries(series, occurrenceDate, draft, rule, now)
            else -> splitSeries(series, occurrenceDate, draft, rule, now)
        }
    }

    private fun editWholeSeries(series: SeriesState, occurrenceDate: LocalDate, draft: EventDraft, rule: RecurrenceRule?, now: Long): Mutation {
        val rec = series.recurrence
        val allExceptionIds = series.exceptions.map { it.id }.toSet()
        if (rule == null) {
            // Stop repeating: keep a single event on the edited date.
            val single = series.master.withDraft(draft, now).copy(recurrenceId = null, occurrenceDate = null, isException = false)
            return Mutation(upsertEvents = listOf(single), deleteEventIds = allExceptionIds, deleteRecurrenceIds = setOf(rec.id))
        }
        val shift = ChronoUnit.DAYS.between(occurrenceDate, draft.date)
        val newStart = rec.startDate.plusDays(shift)
        val adjustedRule = shiftWeekdaysIfUnchanged(rule, rec, shift)
        val newRec = adjustedRule.toRecurrence(rec.id, newStart)
        // Exceptions are pinned to original dates; if the pattern moves they no longer apply.
        val patternChanged = newRec.frequency != rec.frequency || newRec.interval != rec.interval || newRec.daysOfWeek != rec.daysOfWeek
        val dropExceptions = shift != 0L || patternChanged
        val master = series.master.withDraft(draft, now).copy(date = newStart)
        return Mutation(
            upsertEvents = listOf(master),
            upsertRecurrences = listOf(newRec),
            deleteEventIds = if (dropExceptions) allExceptionIds else emptySet(),
        )
    }

    private fun splitSeries(series: SeriesState, occurrenceDate: LocalDate, draft: EventDraft, rule: RecurrenceRule?, now: Long): Mutation {
        val rec = series.recurrence
        val before = RecurrenceEngine.countBefore(rec, occurrenceDate)
        val lastBefore = RecurrenceEngine.previousOccurrence(rec, occurrenceDate) ?: occurrenceDate.minusDays(1)
        val truncated = rec.copy(endDate = lastBefore, count = null)
        val futureExceptionIds = series.exceptions.filter { (it.occurrenceDate ?: it.date) >= occurrenceDate }.map { it.id }.toSet()

        if (rule == null) {
            // "This and future" stop repeating: end the series and keep this one as a single event.
            val single = newRecord(draft, now)
            return Mutation(upsertEvents = listOf(single), upsertRecurrences = listOf(truncated), deleteEventIds = futureExceptionIds)
        }
        val shift = ChronoUnit.DAYS.between(occurrenceDate, draft.date)
        var newRule = shiftWeekdaysIfUnchanged(rule, rec, shift)
        if (newRule.count != null && newRule.count == rec.count) newRule = newRule.copy(count = (rec.count!! - before).coerceAtLeast(1))
        val newRec = newRule.toRecurrence(idGenerator(), draft.date)
        val newMaster = newRecord(draft, now, newRec.id)
        return Mutation(
            upsertEvents = listOf(newMaster),
            upsertRecurrences = listOf(truncated, newRec),
            deleteEventIds = futureExceptionIds,
        )
    }

    /** When the user moved the date but left the weekly days alone, move the weekdays with it. */
    private fun shiftWeekdaysIfUnchanged(rule: RecurrenceRule, original: Recurrence, shiftDays: Long): RecurrenceRule {
        if (shiftDays == 0L || rule.frequency != Frequency.WEEKLY || original.frequency != Frequency.WEEKLY) return rule
        if (rule.daysOfWeek != original.daysOfWeek) return rule
        return rule.copy(daysOfWeek = rule.daysOfWeek.map { it.plus(shiftDays) }.toSet())
    }

    fun deleteSingle(event: EventRecord) = Mutation(deleteEventIds = setOf(event.id))

    fun deleteOccurrence(series: SeriesState, occurrenceDate: LocalDate, scope: EditScope): Mutation {
        val now = clock()
        val rec = series.recurrence
        val isFirst = RecurrenceEngine.countBefore(rec, occurrenceDate) == 0
        return when {
            scope == EditScope.ENTIRE_SERIES || (scope == EditScope.THIS_AND_FUTURE && isFirst) -> Mutation(
                deleteEventIds = series.exceptions.map { it.id }.toSet() + series.master.id,
                deleteRecurrenceIds = setOf(rec.id),
            )
            scope == EditScope.THIS_AND_FUTURE -> {
                val lastBefore = RecurrenceEngine.previousOccurrence(rec, occurrenceDate) ?: occurrenceDate.minusDays(1)
                Mutation(
                    upsertRecurrences = listOf(rec.copy(endDate = lastBefore, count = null)),
                    deleteEventIds = series.exceptions.filter { (it.occurrenceDate ?: it.date) >= occurrenceDate }.map { it.id }.toSet(),
                )
            }
            else -> {
                val existing = series.exceptions.firstOrNull { it.occurrenceDate == occurrenceDate }
                val cancelled = (existing ?: series.master.copy(id = idGenerator(), createdAt = now)).copy(
                    recurrenceId = rec.id, occurrenceDate = occurrenceDate, date = occurrenceDate,
                    isException = true, isCancelled = true, updatedAt = now,
                )
                // Deleting the last remaining occurrence removes the whole series.
                val remaining = RecurrenceEngine.lastOccurrence(rec)?.let { last ->
                    RecurrenceEngine.occurrenceDates(rec, rec.startDate, last).count { d ->
                        d != occurrenceDate && series.exceptions.none { it.occurrenceDate == d && it.isCancelled }
                    }
                }
                if (remaining == 0) deleteOccurrence(series, occurrenceDate, EditScope.ENTIRE_SERIES)
                else Mutation(upsertEvents = listOf(cancelled))
            }
        }
    }

    /** Moves a single occurrence (or one-time event) to [newDate], keeping its times. */
    fun move(occurrence: Occurrence, newDate: LocalDate, single: EventRecord?, series: SeriesState?): Mutation {
        val draft = occurrence.toDraft().copy(date = newDate)
        return if (series != null) editOccurrence(series, occurrence.occurrenceDate, draft, null, EditScope.THIS_ONLY)
        else editSingle(single!!, draft, null)
    }

    /** Copies an occurrence as a new one-time event on [date]. */
    fun duplicate(occurrence: Occurrence, date: LocalDate): Mutation = create(occurrence.toDraft().copy(date = date), null)
}
