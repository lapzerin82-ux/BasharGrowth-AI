package com.bashar.physicianschedule.core

import java.time.LocalDate

/**
 * Turns stored rows into dated [Occurrence]s for a date range. Only the rows relevant to the
 * range need to be passed in: one-time events and exceptions dated in the range (or whose
 * original occurrence date is in the range), and the masters of series active in the range.
 */
object ScheduleExpander {

    fun expand(
        events: Collection<EventRecord>,
        recurrences: Map<String, Recurrence>,
        from: LocalDate,
        to: LocalDate,
    ): List<Occurrence> {
        val result = ArrayList<Occurrence>()
        val masters = events.filter { it.isSeriesMaster }.associateBy { it.recurrenceId!! }
        val exceptionsBySeries = events.filter { it.recurrenceId != null && it.isException }
            .groupBy { it.recurrenceId!! }

        for (e in events) {
            if (e.isSingle && e.date.inRange(from, to)) result += e.toOccurrence(e.id, e.date, e.id)
        }

        for ((recId, master) in masters) {
            val rule = recurrences[recId] ?: continue
            val exceptions = exceptionsBySeries[recId].orEmpty()
            val replaced = exceptions.mapNotNull { it.occurrenceDate }.toSet()
            for (d in RecurrenceEngine.occurrenceDates(rule, from, to)) {
                if (d in replaced) continue
                result += master.copy(date = d).toOccurrence(Occurrence.seriesKey(master.id, d), d, master.id)
            }
            for (x in exceptions) {
                val original = x.occurrenceDate ?: continue
                if (x.isCancelled || !x.date.inRange(from, to)) continue
                // An exception only counts while its original date still belongs to the series.
                if (!RecurrenceEngine.isOccurrence(rule, original)) continue
                result += x.toOccurrence(Occurrence.seriesKey(master.id, original), original, master.id)
            }
        }
        return result.sortedWith(compareBy<Occurrence> { it.start }.thenBy { it.end }.thenBy { it.key })
    }

    private fun LocalDate.inRange(from: LocalDate, to: LocalDate) = !isBefore(from) && !isAfter(to)

    private fun EventRecord.toOccurrence(key: String, originalDate: LocalDate, masterId: String): Occurrence {
        val (s, e) = eventInterval(date, startTime, endTime, endsNextDay)
        return Occurrence(
            key = key,
            sourceId = id,
            masterId = masterId,
            recurrenceId = recurrenceId,
            occurrenceDate = originalDate,
            date = date,
            start = s,
            end = e,
            title = title,
            categoryId = categoryId,
            location = location,
            notes = notes,
            reminderMinutes = reminderMinutes,
            isException = isException,
            isDemo = isDemo,
        )
    }
}
