package com.bashar.growthchart.data

import androidx.room.withTransaction
import com.bashar.growthchart.core.model.BackupContents
import com.bashar.growthchart.core.model.MeasurementRecord
import com.bashar.growthchart.core.model.PatientRecord
import kotlinx.coroutines.flow.Flow
import java.util.UUID

data class RestoreReport(val patients: Int, val measurements: Int, val skipped: Int)

class PatientRepository(
    val db: AppDatabase,
    /** Called after every local change (used to schedule a cloud sync). */
    private val onLocalChange: () -> Unit = {},
) {
    private val patients = db.patients()
    private val measurements = db.measurements()

    fun observePatients(query: String): Flow<List<PatientEntity>> {
        val q = query.trim().lowercase()
        return if (q.isEmpty()) patients.observeAll() else patients.search(q)
    }

    fun observeRecent(limit: Int = 5) = patients.observeRecent(limit)
    fun observePatientCount() = patients.observeCount()
    fun observePatient(id: String) = patients.observe(id)
    fun observeMeasurements(patientId: String) = measurements.observeForPatient(patientId)

    suspend fun patient(id: String) = patients.get(id)?.takeIf { !it.deleted }
    suspend fun measurement(id: String) = measurements.get(id)?.takeIf { !it.deleted }
    suspend fun measurementsFor(patientId: String) = measurements.forPatient(patientId)
    suspend fun findByFileNumber(fileNumber: String) =
        if (fileNumber.isBlank()) null else patients.findByFileNumber(fileNumber.trim())

    /** Inserts or updates a patient; returns its id. */
    suspend fun savePatient(
        id: String?,
        name: String,
        sex: String,
        fileNumber: String,
        dobEpochDay: Long,
        fatherHeightCm: Double?,
        motherHeightCm: Double?,
        mphCm: Double?,
        mphManual: Boolean,
        notes: String,
        preferredReference: String? = null,
    ): String {
        val now = System.currentTimeMillis()
        val existing = id?.let { patients.get(it) }
        val entity = PatientEntity(
            id = existing?.id ?: UUID.randomUUID().toString(),
            name = name.trim(),
            nameNormalized = PatientEntity.normalize(name),
            sex = sex,
            fileNumber = fileNumber.trim(),
            dobEpochDay = dobEpochDay,
            fatherHeightCm = fatherHeightCm,
            motherHeightCm = motherHeightCm,
            mphCm = mphCm,
            mphManual = mphManual,
            notes = notes.trim(),
            preferredReference = preferredReference ?: existing?.preferredReference,
            createdAt = existing?.createdAt ?: now,
            updatedAt = maxOf(now, (existing?.updatedAt ?: 0) + 1),
            deleted = false,
            dirty = true,
        )
        patients.upsert(entity)
        onLocalChange()
        return entity.id
    }

    suspend fun setPreferredReference(patientId: String, referenceId: String?) {
        val p = patients.get(patientId) ?: return
        if (p.preferredReference == referenceId) return
        patients.upsert(p.copy(preferredReference = referenceId, updatedAt = maxOf(System.currentTimeMillis(), p.updatedAt + 1), dirty = true))
        onLocalChange()
    }

    suspend fun saveMeasurement(
        id: String?,
        patientId: String,
        dateEpochDay: Long,
        heightCm: Double?,
        weightKg: Double?,
        notes: String,
    ): String {
        val now = System.currentTimeMillis()
        val existing = id?.let { measurements.get(it) }
        val entity = MeasurementEntity(
            id = existing?.id ?: UUID.randomUUID().toString(),
            patientId = patientId,
            dateEpochDay = dateEpochDay,
            heightCm = heightCm,
            weightKg = weightKg,
            notes = notes.trim(),
            createdAt = existing?.createdAt ?: now,
            updatedAt = maxOf(now, (existing?.updatedAt ?: 0) + 1),
            deleted = false,
            dirty = true,
        )
        db.withTransaction {
            measurements.upsert(entity)
            touchPatient(patientId, now)
        }
        onLocalChange()
        return entity.id
    }

    /** Keeps "recently updated" ordering meaningful without marking the patient dirty. */
    private suspend fun touchPatient(patientId: String, now: Long) {
        val p = patients.get(patientId) ?: return
        if (p.updatedAt < now) patients.upsert(p.copy(updatedAt = now, dirty = true))
    }

    suspend fun deleteMeasurement(id: String) {
        val m = measurements.get(id) ?: return
        measurements.upsert(tombstone(m))
        onLocalChange()
    }

    /** Deletes a patient and all measurements; clinical content is wiped, only a tombstone id remains. */
    suspend fun deletePatient(id: String) {
        val p = patients.get(id) ?: return
        val now = System.currentTimeMillis()
        db.withTransaction {
            measurements.forPatientIncludingDeleted(id).forEach { measurements.upsert(tombstone(it)) }
            patients.upsert(
                p.copy(
                    name = "", nameNormalized = "", fileNumber = "", dobEpochDay = 0, fatherHeightCm = null,
                    motherHeightCm = null, mphCm = null, notes = "", preferredReference = null,
                    updatedAt = maxOf(now, p.updatedAt + 1), deleted = true, dirty = true,
                )
            )
        }
        onLocalChange()
    }

    private fun tombstone(m: MeasurementEntity) = m.copy(
        dateEpochDay = 0, heightCm = null, weightKg = null, notes = "",
        updatedAt = maxOf(System.currentTimeMillis(), m.updatedAt + 1), deleted = true, dirty = true,
    )

    // ------------------------------------------------------------ backup / restore

    suspend fun exportAll(appVersion: String, account: String?): BackupContents = BackupContents(
        createdAt = System.currentTimeMillis(),
        appVersion = appVersion,
        account = account,
        patients = patients.allIncludingDeleted().filter { !it.deleted }.map { it.toRecord() },
        measurements = measurements.allIncludingDeleted().filter { !it.deleted }.map { it.toRecord() },
    )

    /**
     * Restores a backup.
     *  - merge: records are added; where the same record exists, the most recently edited version is kept.
     *  - replace: the local database is made identical to the backup (records absent from the backup are deleted).
     * Restored records are marked for upload so that other signed-in devices receive them.
     */
    suspend fun restore(contents: BackupContents, replace: Boolean): RestoreReport {
        var p = 0
        var m = 0
        var skipped = 0
        val now = System.currentTimeMillis()
        db.withTransaction {
            val backupPatientIds = contents.patients.map { it.id }.toSet()
            val backupMeasurementIds = contents.measurements.map { it.id }.toSet()
            if (replace) {
                patients.allIncludingDeleted().filter { !it.deleted && it.id !in backupPatientIds }.forEach { local ->
                    patients.upsert(local.copy(name = "", nameNormalized = "", fileNumber = "", notes = "", deleted = true, dirty = true, updatedAt = maxOf(now, local.updatedAt + 1)))
                }
                measurements.allIncludingDeleted().filter { !it.deleted && it.id !in backupMeasurementIds }.forEach { local ->
                    measurements.upsert(tombstone(local))
                }
            }
            for (r in contents.patients) {
                val local = patients.get(r.id)
                if (replace || local == null || r.updatedAt >= local.updatedAt || local.deleted) {
                    val stamp = if (replace) maxOf(now, (local?.updatedAt ?: 0) + 1) else maxOf(r.updatedAt, (local?.updatedAt ?: 0) + 1)
                    patients.upsert(PatientEntity.fromRecord(r.copy(updatedAt = stamp, deleted = false), dirty = true))
                    p++
                } else skipped++
            }
            for (r in contents.measurements) {
                val local = measurements.get(r.id)
                if (replace || local == null || r.updatedAt >= local.updatedAt || local.deleted) {
                    val stamp = if (replace) maxOf(now, (local?.updatedAt ?: 0) + 1) else maxOf(r.updatedAt, (local?.updatedAt ?: 0) + 1)
                    measurements.upsert(MeasurementEntity.fromRecord(r.copy(updatedAt = stamp, deleted = false), dirty = true))
                    m++
                } else skipped++
            }
        }
        onLocalChange()
        return RestoreReport(p, m, skipped)
    }

    // ------------------------------------------------------------ sync support

    suspend fun dirtyPatients() = patients.dirty()
    suspend fun dirtyMeasurements() = measurements.dirty()
    suspend fun clearPatientDirty(id: String, updatedAt: Long) = patients.clearDirty(id, updatedAt)
    suspend fun clearMeasurementDirty(id: String, updatedAt: Long) = measurements.clearDirty(id, updatedAt)

    suspend fun markAllDirty() = db.withTransaction {
        patients.markAllDirty()
        measurements.markAllDirty()
    }

    /** Applies a record received from the cloud (last-writer-wins on updatedAt). */
    suspend fun applyRemotePatient(r: PatientRecord): Boolean {
        val local = patients.get(r.id)
        if (local != null && local.updatedAt >= r.updatedAt) return false
        patients.upsert(PatientEntity.fromRecord(r, dirty = false))
        return true
    }

    suspend fun applyRemoteMeasurement(r: MeasurementRecord): Boolean {
        val local = measurements.get(r.id)
        if (local != null && local.updatedAt >= r.updatedAt) return false
        measurements.upsert(MeasurementEntity.fromRecord(r, dirty = false))
        return true
    }
}
