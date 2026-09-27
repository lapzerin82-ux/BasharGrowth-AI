package com.bashar.physicianschedule.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

@Serializable
data class BackupFile(
    val format: String = FORMAT,
    val version: Int = 1,
    val exportedAt: String,
    val categories: List<CategoryDto> = emptyList(),
    val recurrences: List<RecurrenceDto> = emptyList(),
    val events: List<EventDto> = emptyList(),
) {
    companion object { const val FORMAT = "physician-schedule-backup" }
}

@Serializable
data class CategoryDto(val id: String, val name: String, val icon: String, val color: Long, val isCustom: Boolean, val sortOrder: Int = 0)

@Serializable
data class RecurrenceDto(
    val id: String, val frequency: String, val interval: Int = 1, val daysOfWeek: List<Int> = emptyList(),
    val startDate: String, val endDate: String? = null, val count: Int? = null,
)

@Serializable
data class EventDto(
    val id: String, val title: String, val categoryId: String, val date: String,
    val startTime: String, val endTime: String, val endsNextDay: Boolean = false,
    val location: String = "", val notes: String = "", val reminderMinutes: Int? = null,
    val recurrenceId: String? = null, val occurrenceDate: String? = null,
    val isException: Boolean = false, val isCancelled: Boolean = false, val isDemo: Boolean = false,
    val calendarId: String = EventRecord.DEFAULT_CALENDAR, val externalId: String? = null,
    val createdAt: Long = 0, val updatedAt: Long = 0,
)

fun Category.toDto() = CategoryDto(id, name, icon, color, isCustom, sortOrder)
fun CategoryDto.toModel() = Category(id, name, icon, color, isCustom, sortOrder)

fun Recurrence.toDto() = RecurrenceDto(id, frequency.name, interval, daysOfWeek.map { it.value }.sorted(), startDate.toString(), endDate?.toString(), count)
fun RecurrenceDto.toModel() = Recurrence(
    id, Frequency.valueOf(frequency), interval, daysOfWeek.map { DayOfWeek.of(it) }.toSet(),
    LocalDate.parse(startDate), endDate?.let(LocalDate::parse), count,
)

fun EventRecord.toDto() = EventDto(
    id, title, categoryId, date.toString(), startTime.toString(), endTime.toString(), endsNextDay,
    location, notes, reminderMinutes, recurrenceId, occurrenceDate?.toString(), isException, isCancelled,
    isDemo, calendarId, externalId, createdAt, updatedAt,
)
fun EventDto.toModel() = EventRecord(
    id, title, categoryId, LocalDate.parse(date), LocalTime.parse(startTime), LocalTime.parse(endTime), endsNextDay,
    location, notes, reminderMinutes, recurrenceId, occurrenceDate?.let(LocalDate::parse), isException, isCancelled,
    isDemo, calendarId, externalId, createdAt, updatedAt,
)

data class ImportPlan(
    val categories: List<Category>,
    val recurrences: List<Recurrence>,
    val events: List<EventRecord>,
    val skippedDuplicates: Int,
) {
    /** Number of events the user sees as "added": one-time events plus series (not exceptions). */
    val visibleEventCount get() = events.count { !it.isException }
}

object BackupCodec {
    private val json = Json { prettyPrint = true; ignoreUnknownKeys = true; encodeDefaults = true }

    fun encode(categories: List<Category>, recurrences: List<Recurrence>, events: List<EventRecord>, now: LocalDateTime): String =
        json.encodeToString(
            BackupFile.serializer(),
            BackupFile(
                exportedAt = now.toString(),
                categories = categories.map { it.toDto() },
                recurrences = recurrences.map { it.toDto() },
                events = events.map { it.toDto() },
            ),
        )

    /** Parses a backup; throws [IllegalArgumentException] with a readable message if invalid. */
    fun decode(text: String): BackupFile {
        val file = try {
            json.decodeFromString(BackupFile.serializer(), text)
        } catch (e: Exception) {
            throw IllegalArgumentException("Not a valid schedule backup file", e)
        }
        require(file.format == BackupFile.FORMAT) { "Not a schedule backup file" }
        // Validate all values up front so a bad file never half-imports.
        try {
            file.recurrences.forEach { it.toModel() }
            file.events.forEach { it.toModel() }
        } catch (e: Exception) {
            throw IllegalArgumentException("The backup file contains invalid dates or times", e)
        }
        return file
    }

    /**
     * Import only adds: rows whose id already exists are skipped, so existing events are never
     * overwritten or deleted. A series is skipped as a whole when its master already exists.
     */
    fun planImport(file: BackupFile, existingEventIds: Set<String>, existingRecurrenceIds: Set<String>, existingCategoryIds: Set<String>): ImportPlan {
        val skippedSeries = file.events.filter { it.recurrenceId != null && !it.isException && it.id in existingEventIds }
            .mapNotNull { it.recurrenceId }.toSet() + file.recurrences.map { it.id }.filter { it in existingRecurrenceIds }
        val events = file.events.filter { it.id !in existingEventIds && (it.recurrenceId == null || it.recurrenceId !in skippedSeries) }
        val recIds = events.mapNotNull { it.recurrenceId }.toSet()
        val recurrences = file.recurrences.filter { it.id in recIds && it.id !in existingRecurrenceIds }
        val categories = file.categories.filter { it.id !in existingCategoryIds }
        val skipped = file.events.count { it.id in existingEventIds || (it.recurrenceId != null && it.recurrenceId in skippedSeries) }
        return ImportPlan(categories.map { it.toModel() }, recurrences.map { it.toModel() }, events.map { it.toModel() }, skipped)
    }
}

object CsvExporter {
    private val header = listOf("Date", "Start", "End", "Ends next day", "Title", "Category", "Location", "Notes", "Recurring", "Reminder (min)")

    fun export(occurrences: List<Occurrence>, categoryName: (String) -> String): String {
        val sb = StringBuilder()
        sb.append(header.joinToString(",")).append("\r\n")
        for (o in occurrences) {
            val row = listOf(
                o.date.toString(), o.startTime.toString(), o.endTime.toString(), if (o.endsNextDay) "yes" else "no",
                o.title, categoryName(o.categoryId), o.location, o.notes,
                if (o.isRecurring) "yes" else "no", o.reminderMinutes?.toString() ?: "",
            )
            sb.append(row.joinToString(",") { escape(it) }).append("\r\n")
        }
        return sb.toString()
    }

    private fun escape(v: String): String =
        if (v.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) "\"" + v.replace("\"", "\"\"") + "\"" else v
}

/** RFC 5545 export. Times are floating local times (no time zone), as entered in the app. */
object IcsExporter {
    private val dt = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss")

    fun export(events: List<EventRecord>, recurrences: Map<String, Recurrence>, categoryName: (String) -> String, nowUtc: LocalDateTime): String {
        val lines = ArrayList<String>()
        lines += "BEGIN:VCALENDAR"
        lines += "VERSION:2.0"
        lines += "PRODID:-//Physician Schedule//EN"
        lines += "CALSCALE:GREGORIAN"
        val stamp = nowUtc.atOffset(ZoneOffset.UTC).format(dt) + "Z"
        val masters = events.filter { it.isSeriesMaster }.associateBy { it.recurrenceId }

        for (e in events) {
            val rec = e.recurrenceId?.let { recurrences[it] }
            if (e.recurrenceId != null && rec == null) continue
            if (e.isException && e.isCancelled) continue
            val master = if (e.isException) masters[e.recurrenceId] ?: continue else e
            val (s, en) = eventInterval(e.date, e.startTime, e.endTime, e.endsNextDay)
            lines += "BEGIN:VEVENT"
            lines += "UID:${master.id}@physician-schedule"
            lines += "DTSTAMP:$stamp"
            lines += "DTSTART:${s.format(dt)}"
            lines += "DTEND:${en.format(dt)}"
            if (e.isException) {
                lines += "RECURRENCE-ID:${e.occurrenceDate!!.atTime(master.startTime).format(dt)}"
            } else if (rec != null) {
                val firstDate = RecurrenceEngine.occurrenceDates(rec, rec.startDate, rec.startDate.plusYears(5)).firstOrNull()
                if (firstDate != null && firstDate != e.date) {
                    val (fs, fe) = eventInterval(firstDate, e.startTime, e.endTime, e.endsNextDay)
                    lines[lines.size - 2] = "DTSTART:${fs.format(dt)}"
                    lines[lines.size - 1] = "DTEND:${fe.format(dt)}"
                }
                lines += "RRULE:" + rrule(rec, e)
                val cancelled = events.filter { it.recurrenceId == rec.id && it.isException && it.isCancelled }
                if (cancelled.isNotEmpty()) {
                    lines += "EXDATE:" + cancelled.joinToString(",") { it.occurrenceDate!!.atTime(e.startTime).format(dt) }
                }
            }
            lines += "SUMMARY:" + text(e.title)
            if (e.location.isNotBlank()) lines += "LOCATION:" + text(e.location)
            if (e.notes.isNotBlank()) lines += "DESCRIPTION:" + text(e.notes)
            lines += "CATEGORIES:" + text(categoryName(e.categoryId))
            if (e.reminderMinutes != null) {
                lines += "BEGIN:VALARM"
                lines += "ACTION:DISPLAY"
                lines += "DESCRIPTION:" + text(e.title)
                lines += "TRIGGER:-PT${e.reminderMinutes}M"
                lines += "END:VALARM"
            }
            lines += "END:VEVENT"
        }
        lines += "END:VCALENDAR"
        return lines.joinToString("\r\n") { fold(it) } + "\r\n"
    }

    private fun rrule(r: Recurrence, master: EventRecord): String {
        val parts = mutableListOf("FREQ=${r.frequency.name}")
        if (r.interval > 1) parts += "INTERVAL=${r.interval}"
        if (r.frequency == Frequency.WEEKLY) {
            parts += "BYDAY=" + r.daysOfWeek.sortedBy { it.value }.joinToString(",") { it.name.take(2) }
        }
        if (r.count != null) parts += "COUNT=${r.count}"
        else if (r.endDate != null) parts += "UNTIL=${r.endDate.atTime(master.startTime).format(dt)}"
        return parts.joinToString(";")
    }

    private fun text(v: String) = v.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")

    /** Folds content lines longer than 75 octets (RFC 5545 §3.1). */
    private fun fold(line: String): String {
        val bytes = line.toByteArray(Charsets.UTF_8)
        if (bytes.size <= 75) return line
        val sb = StringBuilder()
        var count = 0
        for (ch in line) {
            val n = ch.toString().toByteArray(Charsets.UTF_8).size
            if (count + n > 75) { sb.append("\r\n "); count = 1 }
            sb.append(ch); count += n
        }
        return sb.toString()
    }
}
