package com.bashar.growthchart.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.bashar.growthchart.core.growth.AgeCalculator
import com.bashar.growthchart.core.growth.ExactAge
import com.bashar.growthchart.core.growth.Sex
import com.bashar.growthchart.core.model.MeasurementRecord
import com.bashar.growthchart.core.model.PatientRecord
import java.time.LocalDate

/**
 * Records are never hard-deleted while cloud sync may need to propagate the deletion:
 * a deleted record becomes a tombstone (deleted = 1) with all clinical fields wiped.
 * dirty = 1 means "changed locally, not yet uploaded".
 */
@Entity(
    tableName = "patients",
    indices = [Index("fileNumber"), Index("nameNormalized"), Index("dirty")],
)
data class PatientEntity(
    @PrimaryKey val id: String,
    val name: String,
    val nameNormalized: String,
    val sex: String,
    val fileNumber: String,
    val dobEpochDay: Long,
    val fatherHeightCm: Double?,
    val motherHeightCm: Double?,
    val mphCm: Double?,
    val mphManual: Boolean,
    val notes: String,
    val preferredReference: String?,
    val createdAt: Long,
    val updatedAt: Long,
    val deleted: Boolean,
    val dirty: Boolean,
) {
    val sexEnum: Sex get() = Sex.fromCode(sex)
    val dob: LocalDate get() = LocalDate.ofEpochDay(dobEpochDay)
    fun ageOn(date: LocalDate): ExactAge = AgeCalculator.exactAge(dob, date)

    fun toRecord() = PatientRecord(
        id, name, sex, fileNumber, dobEpochDay, fatherHeightCm, motherHeightCm, mphCm, mphManual,
        notes, preferredReference, createdAt, updatedAt, deleted,
    )

    companion object {
        fun normalize(name: String) = name.trim().lowercase()

        fun fromRecord(r: PatientRecord, dirty: Boolean) = PatientEntity(
            r.id, r.name, normalize(r.name), r.sex, r.fileNumber, r.dobEpochDay, r.fatherHeightCm, r.motherHeightCm,
            r.mphCm, r.mphManual, r.notes, r.preferredReference, r.createdAt, r.updatedAt, r.deleted, dirty,
        )
    }
}

@Entity(
    tableName = "measurements",
    indices = [Index("patientId"), Index("dirty")],
)
data class MeasurementEntity(
    @PrimaryKey val id: String,
    val patientId: String,
    val dateEpochDay: Long,
    val heightCm: Double?,
    val weightKg: Double?,
    val notes: String,
    val createdAt: Long,
    val updatedAt: Long,
    val deleted: Boolean,
    val dirty: Boolean,
) {
    val date: LocalDate get() = LocalDate.ofEpochDay(dateEpochDay)

    fun toRecord() = MeasurementRecord(id, patientId, dateEpochDay, heightCm, weightKg, notes, createdAt, updatedAt, deleted)

    companion object {
        fun fromRecord(r: MeasurementRecord, dirty: Boolean) = MeasurementEntity(
            r.id, r.patientId, r.dateEpochDay, r.heightCm, r.weightKg, r.notes, r.createdAt, r.updatedAt, r.deleted, dirty,
        )
    }
}
