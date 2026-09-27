package com.bashar.physicianschedule.data

import androidx.room.withTransaction
import com.bashar.physicianschedule.core.BackupCodec
import com.bashar.physicianschedule.core.Category
import com.bashar.physicianschedule.core.Conflict
import com.bashar.physicianschedule.core.ConflictDetector
import com.bashar.physicianschedule.core.CsvExporter
import com.bashar.physicianschedule.core.DefaultCategories
import com.bashar.physicianschedule.core.EventDraft
import com.bashar.physicianschedule.core.EventRecord
import com.bashar.physicianschedule.core.Frequency
import com.bashar.physicianschedule.core.IcsExporter
import com.bashar.physicianschedule.core.ImportPlan
import com.bashar.physicianschedule.core.Mutation
import com.bashar.physicianschedule.core.Occurrence
import com.bashar.physicianschedule.core.Recurrence
import com.bashar.physicianschedule.core.RecurrenceEngine
import com.bashar.physicianschedule.core.RecurrenceRule
import com.bashar.physicianschedule.core.ScheduleExpander
import com.bashar.physicianschedule.core.ScheduleOps
import com.bashar.physicianschedule.core.SeriesState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.mapLatest
import kotlinx.coroutines.withContext
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.TemporalAdjusters
import java.util.UUID

/** Rows needed to expand a date range. */
data class Window(val events: List<EventRecord>, val recurrences: Map<String, Recurrence>)

/** A series with its rule, for the recurring-events screen. */
data class SeriesInfo(val master: EventRecord, val recurrence: Recurrence, val next: LocalDate?, val exceptionCount: Int)

/**
 * Single entry point to stored schedule data. All writes go through [apply] (one transaction
 * each) so [version] reliably signals every change to observers.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ScheduleRepository(private val db: AppDatabase) {
    private val dao = db.dao()
    private val _version = MutableStateFlow(0L)
    val version: StateFlow<Long> = _version

    val categories: Flow<List<Category>> = dao.observeCategories().map { list -> list.map { it.toModel() } }

    suspend fun ensureDefaults() = withContext(Dispatchers.IO) {
        dao.insertCategoriesIfMissing(DefaultCategories.all.map { it.toEntity() })
    }

    // ---- reading ---------------------------------------------------------------------

    /** Loads only the rows that can produce occurrences in [from]..[to]. */
    suspend fun window(from: LocalDate, to: LocalDate): Window = withContext(Dispatchers.IO) {
        val f = from.toString()
        val t = to.toString()
        val singles = dao.singlesBetween(f, t)
        val masters = dao.activeMasters(f, t)
        val moved = dao.exceptionsBetween(f, t)
        val recIds = (masters.mapNotNull { it.recurrenceId } + moved.mapNotNull { it.recurrenceId }).distinct()
        val seriesRows = recIds.chunked(500).flatMap { dao.seriesRows(it) }
        val recs = recIds.chunked(500).flatMap { dao.recurrences(it) }.map { it.toModel() }.associateBy { it.id }
        Window((singles + seriesRows).map { it.toModel() }, recs)
    }

    suspend fun occurrences(from: LocalDate, to: LocalDate): List<Occurrence> {
        val w = window(from, to)
        return withContext(Dispatchers.Default) { ScheduleExpander.expand(w.events, w.recurrences, from, to) }
    }

    fun observeOccurrences(from: LocalDate, to: LocalDate): Flow<List<Occurrence>> =
        version.mapLatest { occurrences(from, to) }.flowOn(Dispatchers.Default)

    /**
     * Conflicts whose overlap touches [from]..[to]. The day before is included so an overnight
     * duty that starts on [from]-1 is compared with the morning of [from].
     */
    suspend fun conflicts(from: LocalDate, to: LocalDate): List<Conflict> {
        val occ = occurrences(from.minusDays(1), to)
        val rangeStart = from.atStartOfDay()
        // Keep a pair when the overlapping stretch reaches into the range.
        return ConflictDetector.findConflicts(occ).filter { minOf(it.first.end, it.second.end) > rangeStart }
    }

    fun observeConflicts(from: LocalDate, to: LocalDate): Flow<List<Conflict>> =
        version.mapLatest { conflicts(from, to) }.flowOn(Dispatchers.Default)

    suspend fun single(id: String): EventRecord? = withContext(Dispatchers.IO) { dao.event(id)?.toModel() }

    suspend fun series(recurrenceId: String): SeriesState? = withContext(Dispatchers.IO) {
        val rows = dao.seriesRows(listOf(recurrenceId)).map { it.toModel() }
        val rec = dao.recurrences(listOf(recurrenceId)).firstOrNull()?.toModel() ?: return@withContext null
        val master = rows.firstOrNull { !it.isException } ?: return@withContext null
        SeriesState(master, rec, rows.filter { it.isException })
    }

    /** Resolves an occurrence key ("id" or "masterId|yyyy-MM-dd"); null if it no longer exists. */
    suspend fun findOccurrence(key: String): Occurrence? {
        val parts = key.split("|")
        if (parts.size == 1) {
            val e = single(key) ?: return null
            if (!e.isSingle) return null
            return ScheduleExpander.expand(listOf(e), emptyMap(), e.date, e.date).firstOrNull()
        }
        val master = single(parts[0]) ?: return null
        val recId = master.recurrenceId ?: return null
        val original = runCatching { LocalDate.parse(parts[1]) }.getOrNull() ?: return null
        val s = series(recId) ?: return null
        val exception = s.exceptions.firstOrNull { it.occurrenceDate == original }
        val day = exception?.date ?: original
        val occ = ScheduleExpander.expand(listOf(s.master) + s.exceptions, mapOf(recId to s.recurrence), minOf(day, original), maxOf(day, original))
        return occ.firstOrNull { it.key == key }
    }

    suspend fun allSeries(today: LocalDate): List<SeriesInfo> = withContext(Dispatchers.IO) {
        val masters = dao.allMasters().map { it.toModel() }
        val recIds = masters.mapNotNull { it.recurrenceId }
        val recs = recIds.chunked(500).flatMap { dao.recurrences(it) }.map { it.toModel() }.associateBy { it.id }
        val rows = recIds.chunked(500).flatMap { dao.seriesRows(it) }.map { it.toModel() }
        masters.mapNotNull { m ->
            val r = recs[m.recurrenceId] ?: return@mapNotNull null
            val ex = rows.filter { it.recurrenceId == r.id && it.isException }
            val cancelled = ex.filter { it.isCancelled }.mapNotNull { it.occurrenceDate }.toSet()
            val next = RecurrenceEngine.occurrenceDates(r, today, today.plusYears(2)).firstOrNull { it !in cancelled }
            SeriesInfo(m, r, next, ex.size)
        }
    }

    suspend fun recentLocations(): List<String> = withContext(Dispatchers.IO) { dao.recentLocations() }

    suspend fun hasEvents(): Boolean = withContext(Dispatchers.IO) { dao.eventCount() > 0 }

    suspend fun hasDemoEvents(): Boolean = withContext(Dispatchers.IO) { dao.demoEvents().isNotEmpty() }

    // ---- writing ---------------------------------------------------------------------

    /**
     * Conflicts that saving [mutation] would leave involving the rows it writes, checked over
     * [from]..[to]. Nothing is written.
     */
    suspend fun previewConflicts(mutation: Mutation, from: LocalDate, to: LocalDate): List<Conflict> {
        val w = window(from.minusDays(1), to)
        // The mutated rows may lie outside the window (e.g. a series master dated long ago).
        val (events, recs) = mutation.applyTo(w.events, w.recurrences)
        return withContext(Dispatchers.Default) {
            val occ = ScheduleExpander.expand(events, recs, from.minusDays(1), to)
            ConflictDetector.conflictsInvolving(occ, mutation.touchedSourceIds)
        }
    }

    suspend fun apply(mutation: Mutation) {
        withContext(Dispatchers.IO) {
            db.withTransaction {
                if (mutation.deleteEventIds.isNotEmpty()) dao.deleteEvents(mutation.deleteEventIds.toList())
                if (mutation.upsertRecurrences.isNotEmpty()) dao.upsertRecurrences(mutation.upsertRecurrences.map { it.toEntity() })
                if (mutation.upsertEvents.isNotEmpty()) dao.upsertEvents(mutation.upsertEvents.map { it.toEntity() })
                if (mutation.deleteRecurrenceIds.isNotEmpty()) dao.deleteRecurrences(mutation.deleteRecurrenceIds.toList())
            }
        }
        _version.value++
    }

    suspend fun addCategory(name: String, color: Long, icon: String): Category = withContext(Dispatchers.IO) {
        val order = (dao.categories().maxOfOrNull { it.sortOrder } ?: 0) + 1
        val c = Category("custom-" + UUID.randomUUID().toString().take(8), name.trim(), icon, color, true, order)
        dao.upsertCategory(c.toEntity())
        c
    }

    // ---- demo data -------------------------------------------------------------------

    /** Adds clearly-labelled sample events around [today]; they can be removed from Settings. */
    suspend fun addDemoEvents(today: LocalDate, titles: DemoTitles) {
        val monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        val wednesday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.WEDNESDAY))
        val t = { s: String -> LocalTime.parse(s) }
        val m = ScheduleOps.create(
            EventDraft(titles.lecture, DefaultCategories.TEACHING, monday, t("09:00"), t("10:30"), location = titles.university, reminderMinutes = 30),
            RecurrenceRule(Frequency.WEEKLY, 1, setOf(DayOfWeek.MONDAY), endDate = monday.plusWeeks(8)),
        ) + ScheduleOps.create(
            EventDraft(titles.consultation, DefaultCategories.CONSULTATION, wednesday, t("12:00"), t("15:00"), location = titles.hospital, reminderMinutes = 30),
            RecurrenceRule(Frequency.WEEKLY, 1, setOf(DayOfWeek.WEDNESDAY), endDate = wednesday.plusWeeks(8)),
        ) + ScheduleOps.create(
            EventDraft(titles.night, DefaultCategories.NIGHT, today.plusDays(3), t("20:00"), t("23:00"), location = titles.hospital, reminderMinutes = 60),
            null,
        ) + ScheduleOps.create(
            EventDraft(titles.onCall, DefaultCategories.ON_CALL, today.plusDays(6), t("08:00"), t("08:00"), endsNextDay = true, location = titles.hospital, reminderMinutes = 1440),
            null,
        )
        apply(m.copy(upsertEvents = m.upsertEvents.map { it.copy(isDemo = true) }))
    }

    suspend fun removeDemoEvents() {
        val demo = withContext(Dispatchers.IO) { dao.demoEvents().map { it.toModel() } }
        val recIds = demo.mapNotNull { it.recurrenceId }.toSet()
        val seriesRows = withContext(Dispatchers.IO) { if (recIds.isEmpty()) emptyList() else dao.seriesRows(recIds.toList()) }
        apply(Mutation(deleteEventIds = demo.map { it.id }.toSet() + seriesRows.map { it.id }, deleteRecurrenceIds = recIds))
    }

    // ---- backup / export -------------------------------------------------------------

    suspend fun exportJson(now: LocalDateTime): String = withContext(Dispatchers.IO) {
        BackupCodec.encode(
            dao.categories().map { it.toModel() },
            dao.allRecurrences().map { it.toModel() },
            dao.allEvents().map { it.toModel() },
            now,
        )
    }

    suspend fun exportCsv(from: LocalDate, to: LocalDate, categoryName: (String) -> String): String {
        val occ = occurrences(from, to)
        return CsvExporter.export(occ, categoryName)
    }

    suspend fun exportIcs(nowUtc: LocalDateTime, categoryName: (String) -> String): String = withContext(Dispatchers.IO) {
        IcsExporter.export(
            dao.allEvents().map { it.toModel() },
            dao.allRecurrences().map { it.toModel() }.associateBy { it.id },
            categoryName,
            nowUtc,
        )
    }

    /** Parses a backup and works out what importing it would add. Throws on an invalid file. */
    suspend fun planImport(text: String): ImportPlan = withContext(Dispatchers.IO) {
        val file = BackupCodec.decode(text)
        BackupCodec.planImport(
            file,
            dao.allEventIds().toSet(),
            dao.allRecurrenceIds().toSet(),
            dao.categories().map { it.id }.toSet(),
        )
    }

    suspend fun applyImport(plan: ImportPlan) {
        withContext(Dispatchers.IO) {
            db.withTransaction {
                dao.insertCategoriesIfMissing(plan.categories.map { it.toEntity() })
                if (plan.recurrences.isNotEmpty()) dao.upsertRecurrences(plan.recurrences.map { it.toEntity() })
                if (plan.events.isNotEmpty()) dao.upsertEvents(plan.events.map { it.toEntity() })
            }
        }
        _version.value++
    }
}

/** Localized names for the demo events. */
data class DemoTitles(
    val lecture: String,
    val consultation: String,
    val night: String,
    val onCall: String,
    val university: String,
    val hospital: String,
)
