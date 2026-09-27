package com.bashar.physicianschedule.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Upsert
import com.bashar.physicianschedule.core.Category
import com.bashar.physicianschedule.core.EventRecord
import com.bashar.physicianschedule.core.Frequency
import com.bashar.physicianschedule.core.Recurrence
import kotlinx.coroutines.flow.Flow
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime

/*
 * Dates are stored as ISO-8601 text ("2026-09-16") and times as "HH:mm", which sort and
 * compare correctly in SQL and survive export/import unchanged.
 */

@Entity(
    tableName = "events",
    indices = [Index("date"), Index("recurrenceId"), Index("isException"), Index("isDemo")],
)
data class EventEntity(
    @PrimaryKey val id: String,
    val title: String,
    val categoryId: String,
    val date: String,
    val startTime: String,
    val endTime: String,
    val endsNextDay: Boolean,
    val location: String,
    val notes: String,
    val reminderMinutes: Int?,
    val recurrenceId: String?,
    val occurrenceDate: String?,
    val isException: Boolean,
    val isCancelled: Boolean,
    val isDemo: Boolean,
    val calendarId: String,
    val externalId: String?,
    val createdAt: Long,
    val updatedAt: Long,
)

@Entity(tableName = "recurrences", indices = [Index("startDate"), Index("endDate")])
data class RecurrenceEntity(
    @PrimaryKey val id: String,
    val frequency: String,
    val interval: Int,
    /** Bit (value-1) set for each ISO weekday: Monday = bit 0 … Sunday = bit 6. */
    val daysOfWeek: Int,
    val startDate: String,
    val endDate: String?,
    val count: Int?,
)

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val id: String,
    val name: String,
    val icon: String,
    val color: Long,
    val isCustom: Boolean,
    val sortOrder: Int,
)

fun EventEntity.toModel() = EventRecord(
    id, title, categoryId, LocalDate.parse(date), LocalTime.parse(startTime), LocalTime.parse(endTime), endsNextDay,
    location, notes, reminderMinutes, recurrenceId, occurrenceDate?.let(LocalDate::parse), isException, isCancelled,
    isDemo, calendarId, externalId, createdAt, updatedAt,
)

fun EventRecord.toEntity() = EventEntity(
    id, title, categoryId, date.toString(), startTime.toString(), endTime.toString(), endsNextDay,
    location, notes, reminderMinutes, recurrenceId, occurrenceDate?.toString(), isException, isCancelled,
    isDemo, calendarId, externalId, createdAt, updatedAt,
)

fun RecurrenceEntity.toModel() = Recurrence(
    id, Frequency.valueOf(frequency), interval,
    DayOfWeek.entries.filter { daysOfWeek and (1 shl (it.value - 1)) != 0 }.toSet(),
    LocalDate.parse(startDate), endDate?.let(LocalDate::parse), count,
)

fun Recurrence.toEntity() = RecurrenceEntity(
    id, frequency.name, interval, daysOfWeek.fold(0) { acc, d -> acc or (1 shl (d.value - 1)) },
    startDate.toString(), endDate?.toString(), count,
)

fun CategoryEntity.toModel() = Category(id, name, icon, color, isCustom, sortOrder)
fun Category.toEntity() = CategoryEntity(id, name, icon, color, isCustom, sortOrder)

@Dao
interface ScheduleDao {
    @Query("SELECT * FROM events WHERE recurrenceId IS NULL AND date BETWEEN :from AND :to")
    suspend fun singlesBetween(from: String, to: String): List<EventEntity>

    @Query(
        """SELECT e.* FROM events e JOIN recurrences r ON e.recurrenceId = r.id
           WHERE e.isException = 0 AND r.startDate <= :to AND (r.endDate IS NULL OR r.endDate >= :from)"""
    )
    suspend fun activeMasters(from: String, to: String): List<EventEntity>

    @Query("SELECT * FROM events WHERE isException = 1 AND date BETWEEN :from AND :to")
    suspend fun exceptionsBetween(from: String, to: String): List<EventEntity>

    @Query("SELECT * FROM events WHERE recurrenceId IN (:recurrenceIds)")
    suspend fun seriesRows(recurrenceIds: List<String>): List<EventEntity>

    @Query("SELECT * FROM recurrences WHERE id IN (:ids)")
    suspend fun recurrences(ids: List<String>): List<RecurrenceEntity>

    @Query("SELECT * FROM events WHERE id = :id")
    suspend fun event(id: String): EventEntity?

    @Query("SELECT * FROM events WHERE recurrenceId IS NOT NULL AND isException = 0 ORDER BY title")
    suspend fun allMasters(): List<EventEntity>

    @Query("SELECT * FROM events")
    suspend fun allEvents(): List<EventEntity>

    @Query("SELECT * FROM recurrences")
    suspend fun allRecurrences(): List<RecurrenceEntity>

    @Query("SELECT id FROM events")
    suspend fun allEventIds(): List<String>

    @Query("SELECT id FROM recurrences")
    suspend fun allRecurrenceIds(): List<String>

    @Query("SELECT COUNT(*) FROM events")
    suspend fun eventCount(): Int

    @Query("SELECT DISTINCT location FROM events WHERE location != '' ORDER BY updatedAt DESC LIMIT 30")
    suspend fun recentLocations(): List<String>

    @Query("SELECT * FROM events WHERE isDemo = 1")
    suspend fun demoEvents(): List<EventEntity>

    @Upsert suspend fun upsertEvents(events: List<EventEntity>)
    @Upsert suspend fun upsertRecurrences(recurrences: List<RecurrenceEntity>)

    @Query("DELETE FROM events WHERE id IN (:ids)")
    suspend fun deleteEvents(ids: List<String>)

    @Query("DELETE FROM recurrences WHERE id IN (:ids)")
    suspend fun deleteRecurrences(ids: List<String>)

    @Query("SELECT * FROM categories ORDER BY sortOrder, name")
    fun observeCategories(): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM categories ORDER BY sortOrder, name")
    suspend fun categories(): List<CategoryEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertCategoriesIfMissing(categories: List<CategoryEntity>)

    @Upsert suspend fun upsertCategory(category: CategoryEntity)
}

@Database(entities = [EventEntity::class, RecurrenceEntity::class, CategoryEntity::class], version = 1, exportSchema = true)
abstract class AppDatabase : RoomDatabase() {
    abstract fun dao(): ScheduleDao

    companion object {
        fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "schedule.db").build()
    }
}
