package com.bashar.physicianschedule.core

import org.junit.Before
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScheduleTest {

    /** In-memory store that applies mutations the way the Room repository does. */
    private class Store {
        val events = LinkedHashMap<String, EventRecord>()
        val recs = LinkedHashMap<String, Recurrence>()
        fun apply(m: Mutation) {
            val (e, r) = m.applyTo(events.values, recs)
            events.clear(); e.forEach { events[it.id] = it }
            recs.clear(); recs.putAll(r)
        }
        fun expand(from: LocalDate, to: LocalDate) = ScheduleExpander.expand(events.values, recs, from, to)
        fun series(recId: String) = SeriesState(
            events.values.first { it.recurrenceId == recId && !it.isException },
            recs.getValue(recId),
            events.values.filter { it.recurrenceId == recId && it.isException },
        )
    }

    private var n = 0
    private lateinit var store: Store

    @Before fun setUp() {
        n = 0
        ScheduleOps.idGenerator = { "id${++n}" }
        ScheduleOps.clock = { 1L }
        store = Store()
    }

    private fun d(s: String) = LocalDate.parse(s)
    private fun t(s: String) = LocalTime.parse(s)
    private fun draft(title: String, date: String, start: String, end: String, nextDay: Boolean = false) =
        EventDraft(title, DefaultCategories.TEACHING, d(date), t(start), t(end), nextDay, "University")

    private val weeklyMonday = RecurrenceRule(Frequency.WEEKLY, 1, setOf(DayOfWeek.MONDAY))
    private val sep = d("2026-09-01") to d("2026-09-30")

    // ---- conflict engine -------------------------------------------------------------

    @Test fun overlappingEventsConflict() {
        store.apply(ScheduleOps.create(draft("Lecture", "2026-09-16", "09:00", "10:00"), null))
        store.apply(ScheduleOps.create(draft("Consult", "2026-09-16", "09:59", "11:00"), null))
        val c = ConflictDetector.findConflicts(store.expand(sep.first, sep.second))
        assertEquals(1, c.size)
        assertEquals(setOf("Lecture", "Consult"), setOf(c[0].first.title, c[0].second.title))
    }

    @Test fun backToBackEventsDoNotConflict() {
        store.apply(ScheduleOps.create(draft("A", "2026-09-16", "09:00", "10:00"), null))
        store.apply(ScheduleOps.create(draft("B", "2026-09-16", "10:00", "11:00"), null))
        assertTrue(ConflictDetector.findConflicts(store.expand(sep.first, sep.second)).isEmpty())
    }

    @Test fun eventCrossingMidnightConflictsWithNextMorning() {
        store.apply(ScheduleOps.create(draft("Night", "2026-09-16", "20:00", "08:00", nextDay = true), null))
        store.apply(ScheduleOps.create(draft("Lecture", "2026-09-17", "07:30", "09:00"), null))
        store.apply(ScheduleOps.create(draft("Later", "2026-09-17", "08:00", "09:00"), null))
        val c = ConflictDetector.findConflicts(store.expand(sep.first, sep.second))
        // Night overlaps Lecture; Lecture overlaps Later; Night ends exactly when Later starts.
        assertEquals(setOf(setOf("Night", "Lecture"), setOf("Lecture", "Later")), c.map { setOf(it.first.title, it.second.title) }.toSet())
    }

    @Test fun recurringEventsConflictWithOneTimeEvents() {
        store.apply(ScheduleOps.create(draft("Weekly", "2026-09-07", "09:00", "10:30"), weeklyMonday))
        store.apply(ScheduleOps.create(draft("Meeting", "2026-09-21", "10:00", "11:00"), null))
        val c = ConflictDetector.findConflicts(store.expand(sep.first, sep.second))
        assertEquals(1, c.size)
        assertEquals(d("2026-09-21"), c[0].date)
    }

    @Test fun validationRejectsBadInput() {
        assertEquals(listOf(ValidationError.EMPTY_TITLE), ScheduleOps.validate(draft(" ", "2026-09-16", "09:00", "10:00"), null))
        assertEquals(listOf(ValidationError.END_NOT_AFTER_START), ScheduleOps.validate(draft("x", "2026-09-16", "10:00", "09:00"), null))
        assertTrue(ScheduleOps.validate(draft("x", "2026-09-16", "20:00", "08:00", nextDay = true), null).isEmpty())
        assertTrue(ScheduleOps.validate(draft("x", "2026-09-16", "08:00", "08:00", nextDay = true), null).isEmpty())
        assertEquals(listOf(ValidationError.INVALID_REPEAT_END),
            ScheduleOps.validate(draft("x", "2026-09-16", "09:00", "10:00"), weeklyMonday.copy(endDate = d("2026-09-01"))))
    }

    // ---- recurrence engine -----------------------------------------------------------

    @Test fun weeklySeriesProducesEveryMonday() {
        store.apply(ScheduleOps.create(draft("Lecture", "2026-09-07", "09:00", "10:30"), weeklyMonday))
        assertEquals(listOf("2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"),
            store.expand(sep.first, sep.second).map { it.date.toString() })
        assertEquals(1, store.events.size) // stored once, not per occurrence
    }

    @Test fun specificWeekdaysEveryTwoWeeksWithCount() {
        val r = Recurrence("r", Frequency.WEEKLY, 2, setOf(DayOfWeek.SUNDAY, DayOfWeek.WEDNESDAY), d("2026-09-02"), count = 4)
        assertEquals(listOf("2026-09-02", "2026-09-06", "2026-09-16", "2026-09-20"),
            RecurrenceEngine.occurrenceDates(r, d("2026-01-01"), d("2027-01-01")).map { it.toString() })
        assertEquals(d("2026-09-20"), RecurrenceEngine.lastOccurrence(r))
    }

    @Test fun monthlySkipsShortMonths() {
        val r = Recurrence("r", Frequency.MONTHLY, 1, emptySet(), d("2026-01-31"))
        assertEquals(listOf("2026-01-31", "2026-03-31", "2026-05-31"),
            RecurrenceEngine.occurrenceDates(r, d("2026-01-01"), d("2026-06-15")).map { it.toString() })
    }

    @Test fun dailyWithEndDateAndSkipAhead() {
        val r = Recurrence("r", Frequency.DAILY, 3, emptySet(), d("2026-01-01"), endDate = d("2026-12-31"))
        val dates = RecurrenceEngine.occurrenceDates(r, d("2026-09-01"), d("2026-09-10"))
        assertEquals(listOf("2026-09-01", "2026-09-04", "2026-09-07", "2026-09-10"), dates.map { it.toString() })
        assertTrue(RecurrenceEngine.occurrenceDates(r, d("2027-01-01"), d("2027-02-01")).isEmpty())
    }

    // ---- editing recurring series ----------------------------------------------------

    private fun createWeekly(): String {
        store.apply(ScheduleOps.create(draft("Lecture", "2026-09-07", "09:00", "10:30"), weeklyMonday))
        return store.recs.keys.single()
    }

    @Test fun modifyOneOccurrence() {
        val rec = createWeekly()
        val occ = store.expand(sep.first, sep.second).first { it.date == d("2026-09-14") }
        store.apply(ScheduleOps.editOccurrence(store.series(rec), occ.occurrenceDate,
            occ.toDraft().copy(date = d("2026-09-15"), startTime = t("11:00"), endTime = t("12:00"), location = "Hall 2"), weeklyMonday, EditScope.THIS_ONLY))
        val list = store.expand(sep.first, sep.second)
        assertEquals(listOf("2026-09-07", "2026-09-15", "2026-09-21", "2026-09-28"), list.map { it.date.toString() })
        val moved = list.first { it.date == d("2026-09-15") }
        assertEquals("Hall 2", moved.location)
        assertEquals(occ.key, moved.key) // same identity as the original occurrence
        assertTrue(moved.isException)
        // Editing the same occurrence again updates the existing exception instead of adding one.
        store.apply(ScheduleOps.editOccurrence(store.series(rec), occ.occurrenceDate, moved.toDraft().copy(title = "Renamed"), null, EditScope.THIS_ONLY))
        assertEquals(1, store.events.values.count { it.isException })
    }

    @Test fun modifyThisAndFutureSplitsSeries() {
        val rec = createWeekly()
        val occ = store.expand(sep.first, sep.second).first { it.date == d("2026-09-21") }
        store.apply(ScheduleOps.editOccurrence(store.series(rec), occ.occurrenceDate,
            occ.toDraft().copy(startTime = t("12:00"), endTime = t("13:00")), weeklyMonday, EditScope.THIS_AND_FUTURE))
        val list = store.expand(sep.first, d("2026-10-12"))
        assertEquals(listOf("09:00", "09:00", "12:00", "12:00", "12:00", "12:00"), list.map { it.startTime.toString() })
        assertEquals(2, store.recs.size)
        assertEquals(d("2026-09-14"), store.recs.getValue(rec).endDate)
    }

    @Test fun modifyThisAndFutureWithDateShiftMovesWeekday() {
        val rec = createWeekly()
        store.apply(ScheduleOps.editOccurrence(store.series(rec), d("2026-09-21"),
            draft("Lecture", "2026-09-23", "09:00", "10:30"), weeklyMonday, EditScope.THIS_AND_FUTURE))
        assertEquals(listOf("2026-09-07", "2026-09-14", "2026-09-23", "2026-09-30"),
            store.expand(sep.first, d("2026-09-30")).map { it.date.toString() })
    }

    @Test fun modifyEntireSeries() {
        val rec = createWeekly()
        store.apply(ScheduleOps.editOccurrence(store.series(rec), d("2026-09-21"),
            draft("Pediatrics", "2026-09-21", "10:00", "11:00").copy(location = "Hall 5"), weeklyMonday, EditScope.ENTIRE_SERIES))
        val list = store.expand(sep.first, sep.second)
        assertEquals(4, list.size)
        assertTrue(list.all { it.title == "Pediatrics" && it.location == "Hall 5" && it.startTime == t("10:00") })
    }

    @Test fun deleteOneOccurrence() {
        val rec = createWeekly()
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-14"), EditScope.THIS_ONLY))
        assertEquals(listOf("2026-09-07", "2026-09-21", "2026-09-28"), store.expand(sep.first, sep.second).map { it.date.toString() })
    }

    @Test fun deleteThisAndFuture() {
        val rec = createWeekly()
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-14"), EditScope.THIS_ONLY))
        store.apply(ScheduleOps.editOccurrence(store.series(rec), d("2026-09-28"), draft("Moved", "2026-09-29", "09:00", "10:00"), null, EditScope.THIS_ONLY))
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-21"), EditScope.THIS_AND_FUTURE))
        assertEquals(listOf("2026-09-07"), store.expand(sep.first, d("2026-12-31")).map { it.date.toString() })
        // The earlier cancellation stays; the later modified occurrence is removed with the future.
        assertEquals(listOf(d("2026-09-14")), store.events.values.filter { it.isException }.map { it.occurrenceDate })
    }

    @Test fun deleteEntireSeries() {
        val rec = createWeekly()
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-14"), EditScope.THIS_ONLY))
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-21"), EditScope.ENTIRE_SERIES))
        assertTrue(store.events.isEmpty())
        assertTrue(store.recs.isEmpty())
    }

    @Test fun deletingLastRemainingOccurrenceRemovesSeries() {
        store.apply(ScheduleOps.create(draft("Two", "2026-09-07", "09:00", "10:00"), weeklyMonday.copy(count = 2)))
        val rec = store.recs.keys.single()
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-07"), EditScope.THIS_ONLY))
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-14"), EditScope.THIS_ONLY))
        assertTrue(store.events.isEmpty())
    }

    @Test fun conflictsOfModifiedOccurrenceUseItsNewTime() {
        val rec = createWeekly()
        store.apply(ScheduleOps.create(draft("Clinic", "2026-09-14", "09:30", "10:00"), null))
        assertEquals(1, ConflictDetector.findConflicts(store.expand(sep.first, sep.second)).size)
        store.apply(ScheduleOps.editOccurrence(store.series(rec), d("2026-09-14"),
            draft("Lecture", "2026-09-14", "11:00", "12:00"), null, EditScope.THIS_ONLY))
        assertTrue(ConflictDetector.findConflicts(store.expand(sep.first, sep.second)).isEmpty())
    }

    @Test fun previewConflictsOnlyForTouchedEvents() {
        store.apply(ScheduleOps.create(draft("A", "2026-09-16", "09:00", "10:00"), null))
        store.apply(ScheduleOps.create(draft("B", "2026-09-16", "09:30", "10:30"), null)) // existing conflict
        val m = ScheduleOps.create(draft("C", "2026-09-17", "09:00", "10:00"), null)
        val (e, r) = m.applyTo(store.events.values, store.recs)
        assertTrue(ConflictDetector.conflictsInvolving(ScheduleExpander.expand(e, r, sep.first, sep.second), m.touchedSourceIds).isEmpty())
        val m2 = ScheduleOps.create(draft("D", "2026-09-16", "10:15", "11:00"), null)
        val (e2, r2) = m2.applyTo(store.events.values, store.recs)
        assertEquals(1, ConflictDetector.conflictsInvolving(ScheduleExpander.expand(e2, r2, sep.first, sep.second), m2.touchedSourceIds).size)
    }

    @Test fun moveOccurrenceAndDuplicate() {
        val rec = createWeekly()
        val occ = store.expand(sep.first, sep.second).first { it.date == d("2026-09-14") }
        store.apply(ScheduleOps.move(occ, d("2026-09-18"), null, store.series(rec)))
        store.apply(ScheduleOps.duplicate(occ, d("2026-09-25")))
        val dates = store.expand(sep.first, sep.second).map { it.date.toString() }
        assertEquals(listOf("2026-09-07", "2026-09-18", "2026-09-21", "2026-09-25", "2026-09-28"), dates)
    }

    // ---- backup / export ---------------------------------------------------------------

    @Test fun backupRoundTripAndImportSkipsDuplicates() {
        val rec = createWeekly()
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-14"), EditScope.THIS_ONLY))
        store.apply(ScheduleOps.create(draft("Single", "2026-09-16", "09:00", "10:00"), null))
        val text = BackupCodec.encode(DefaultCategories.all, store.recs.values.toList(), store.events.values.toList(), LocalDateTime.of(2026, 9, 27, 10, 0))
        val file = BackupCodec.decode(text)

        val fresh = BackupCodec.planImport(file, emptySet(), emptySet(), emptySet())
        assertEquals(2, fresh.visibleEventCount)
        assertEquals(3, fresh.events.size)

        val again = BackupCodec.planImport(file, store.events.keys, store.recs.keys, DefaultCategories.all.map { it.id }.toSet())
        assertEquals(0, again.events.size)
        assertEquals(3, again.skippedDuplicates)
        assertFailsWith<IllegalArgumentException> { BackupCodec.decode("{\"hello\":1}") }
    }

    @Test fun icsContainsRruleAndExdate() {
        val rec = createWeekly()
        store.apply(ScheduleOps.deleteOccurrence(store.series(rec), d("2026-09-14"), EditScope.THIS_ONLY))
        val ics = IcsExporter.export(store.events.values.toList(), store.recs, { "Teaching" }, LocalDateTime.of(2026, 9, 27, 10, 0))
        assertTrue("RRULE:FREQ=WEEKLY;BYDAY=MO" in ics)
        assertTrue("EXDATE:20260914T090000" in ics)
        assertTrue("DTSTART:20260907T090000" in ics)
        assertFalse(ics.contains("\n\n"))
    }

    @Test fun csvEscapesCommas() {
        store.apply(ScheduleOps.create(draft("Lecture, part 1", "2026-09-16", "09:00", "10:00"), null))
        val csv = CsvExporter.export(store.expand(sep.first, sep.second)) { "Teaching" }
        assertTrue("\"Lecture, part 1\"" in csv)
    }

    @Test fun seriesWithoutRecurrenceIsIgnored() {
        store.events["x"] = EventRecord("x", "Orphan", "other", d("2026-09-16"), t("09:00"), t("10:00"), recurrenceId = "missing")
        assertTrue(store.expand(sep.first, sep.second).isEmpty())
        assertNull(RecurrenceEngine.lastOccurrence(Recurrence("r", Frequency.DAILY, 1, emptySet(), d("2026-01-01"))))
    }
}
