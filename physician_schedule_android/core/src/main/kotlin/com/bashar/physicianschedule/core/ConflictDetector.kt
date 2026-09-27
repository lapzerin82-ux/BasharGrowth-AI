package com.bashar.physicianschedule.core

import java.time.LocalDate

data class Conflict(val first: Occurrence, val second: Occurrence) {
    /** The calendar date the overlap is reported under (the later-starting event's date). */
    val date: LocalDate get() = second.date
    val key: String get() = "${first.key}#${second.key}"
}

object ConflictDetector {

    /**
     * Two occurrences conflict when `a.start < b.end && b.start < a.end`. Back-to-back events
     * (one ends exactly when the other starts) do not conflict. Works across midnight because
     * occurrences carry full date-times.
     */
    fun overlaps(a: Occurrence, b: Occurrence): Boolean = a.start < b.end && b.start < a.end

    /** All overlapping pairs, ordered by start time. */
    fun findConflicts(occurrences: List<Occurrence>): List<Conflict> {
        val sorted = occurrences.sortedWith(compareBy<Occurrence> { it.start }.thenBy { it.end }.thenBy { it.key })
        val result = ArrayList<Conflict>()
        for (i in sorted.indices) {
            val a = sorted[i]
            var j = i + 1
            // Sorted by start: once b starts at or after a ends, no later b can overlap a.
            while (j < sorted.size && sorted[j].start < a.end) {
                val b = sorted[j]
                if (a.key != b.key && overlaps(a, b)) result += Conflict(a, b)
                j++
            }
        }
        return result
    }

    /** Conflicts in [occurrences] that involve at least one occurrence produced by a row in [sourceIds]. */
    fun conflictsInvolving(occurrences: List<Occurrence>, sourceIds: Set<String>): List<Conflict> =
        findConflicts(occurrences).filter { it.first.sourceId in sourceIds || it.second.sourceId in sourceIds }

    /** Keys of occurrences that are part of any conflict. */
    fun conflictingKeys(conflicts: List<Conflict>): Set<String> =
        conflicts.flatMap { listOf(it.first.key, it.second.key) }.toSet()
}
