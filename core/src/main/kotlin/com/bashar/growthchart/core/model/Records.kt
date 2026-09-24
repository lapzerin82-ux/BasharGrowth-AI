package com.bashar.growthchart.core.model

import kotlinx.serialization.Serializable

/**
 * Transport representation of a patient, used for encrypted backup files and
 * for (end-to-end encrypted) cloud synchronisation. Dates are epoch days,
 * timestamps are epoch milliseconds (UTC).
 */
@Serializable
data class PatientRecord(
    val id: String,
    val name: String = "",
    val sex: String = "M",
    val fileNumber: String = "",
    val dobEpochDay: Long = 0,
    val fatherHeightCm: Double? = null,
    val motherHeightCm: Double? = null,
    val mphCm: Double? = null,
    val mphManual: Boolean = false,
    val notes: String = "",
    val preferredReference: String? = null,
    val createdAt: Long = 0,
    val updatedAt: Long = 0,
    val deleted: Boolean = false,
)

@Serializable
data class MeasurementRecord(
    val id: String,
    val patientId: String,
    val dateEpochDay: Long = 0,
    val heightCm: Double? = null,
    val weightKg: Double? = null,
    val notes: String = "",
    val createdAt: Long = 0,
    val updatedAt: Long = 0,
    val deleted: Boolean = false,
)

@Serializable
data class BackupContents(
    val format: String = "bashar-growth-chart-backup",
    val formatVersion: Int = 1,
    val createdAt: Long,
    val appVersion: String,
    val account: String? = null,
    val patients: List<PatientRecord>,
    val measurements: List<MeasurementRecord>,
)
