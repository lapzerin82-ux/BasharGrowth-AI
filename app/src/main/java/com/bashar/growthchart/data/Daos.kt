package com.bashar.growthchart.data

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface PatientDao {
    @Query("SELECT * FROM patients WHERE deleted = 0 ORDER BY nameNormalized")
    fun observeAll(): Flow<List<PatientEntity>>

    @Query(
        """SELECT * FROM patients WHERE deleted = 0 AND
           (nameNormalized LIKE '%' || :q || '%' OR fileNumber LIKE '%' || :q || '%')
           ORDER BY CASE WHEN fileNumber = :q COLLATE NOCASE THEN 0 ELSE 1 END, nameNormalized"""
    )
    fun search(q: String): Flow<List<PatientEntity>>

    @Query("SELECT * FROM patients WHERE deleted = 0 ORDER BY updatedAt DESC LIMIT :limit")
    fun observeRecent(limit: Int): Flow<List<PatientEntity>>

    @Query("SELECT * FROM patients WHERE id = :id")
    fun observe(id: String): Flow<PatientEntity?>

    @Query("SELECT * FROM patients WHERE id = :id")
    suspend fun get(id: String): PatientEntity?

    @Query("SELECT * FROM patients WHERE deleted = 0 AND fileNumber = :fileNumber COLLATE NOCASE LIMIT 1")
    suspend fun findByFileNumber(fileNumber: String): PatientEntity?

    @Query("SELECT COUNT(*) FROM patients WHERE deleted = 0")
    fun observeCount(): Flow<Int>

    @Upsert
    suspend fun upsert(p: PatientEntity)

    @Query("SELECT * FROM patients WHERE dirty = 1")
    suspend fun dirty(): List<PatientEntity>

    @Query("UPDATE patients SET dirty = 0 WHERE id = :id AND updatedAt = :updatedAt")
    suspend fun clearDirty(id: String, updatedAt: Long)

    @Query("UPDATE patients SET dirty = 1")
    suspend fun markAllDirty()

    @Query("SELECT * FROM patients")
    suspend fun allIncludingDeleted(): List<PatientEntity>
}

@Dao
interface MeasurementDao {
    @Query("SELECT * FROM measurements WHERE patientId = :patientId AND deleted = 0 ORDER BY dateEpochDay, createdAt")
    fun observeForPatient(patientId: String): Flow<List<MeasurementEntity>>

    @Query("SELECT * FROM measurements WHERE patientId = :patientId AND deleted = 0 ORDER BY dateEpochDay, createdAt")
    suspend fun forPatient(patientId: String): List<MeasurementEntity>

    @Query("SELECT * FROM measurements WHERE patientId = :patientId")
    suspend fun forPatientIncludingDeleted(patientId: String): List<MeasurementEntity>

    @Query("SELECT * FROM measurements WHERE id = :id")
    suspend fun get(id: String): MeasurementEntity?

    @Upsert
    suspend fun upsert(m: MeasurementEntity)

    @Query("SELECT * FROM measurements WHERE dirty = 1")
    suspend fun dirty(): List<MeasurementEntity>

    @Query("UPDATE measurements SET dirty = 0 WHERE id = :id AND updatedAt = :updatedAt")
    suspend fun clearDirty(id: String, updatedAt: Long)

    @Query("UPDATE measurements SET dirty = 1")
    suspend fun markAllDirty()

    @Query("SELECT * FROM measurements")
    suspend fun allIncludingDeleted(): List<MeasurementEntity>
}
