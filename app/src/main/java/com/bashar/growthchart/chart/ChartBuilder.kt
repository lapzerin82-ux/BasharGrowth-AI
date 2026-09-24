package com.bashar.growthchart.chart

import com.bashar.growthchart.core.growth.GrowthAssessment
import com.bashar.growthchart.core.growth.GrowthReferences
import com.bashar.growthchart.core.growth.Measure
import com.bashar.growthchart.data.MeasurementEntity
import com.bashar.growthchart.data.PatientEntity
import java.time.format.DateTimeFormatter

val DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")

fun MeasurementEntity.value(measure: Measure): Double? = if (measure == Measure.HEIGHT) heightCm else weightKg

class BuiltChart(val data: ChartData, val outsideRange: Int)

object ChartBuilder {

    fun build(
        patient: PatientEntity,
        measurements: List<MeasurementEntity>,
        referenceId: String,
        measure: Measure,
        connect: Boolean,
    ): BuiltChart? {
        val ref = GrowthReferences.get(referenceId)
        val mRef = ref.measure(measure) ?: return null
        val withValue = measurements.filter { it.value(measure) != null && !it.deleted }
        val latestId = withValue.maxWithOrNull(compareBy<MeasurementEntity>({ it.dateEpochDay }, { it.createdAt }))?.id
        var outside = 0
        val points = withValue.mapNotNull { m ->
            val age = patient.ageOn(m.date)
            if (!mRef.covers(age.months)) {
                outside++
                null
            } else ChartPoint(
                measurementId = m.id,
                ageMonths = age.months, // exact, unrounded
                value = m.value(measure)!!,
                dateText = m.date.format(DATE_FORMAT),
                ageText = age.format(),
                latest = m.id == latestId,
            )
        }
        val label = listOfNotNull(patient.name.takeIf { it.isNotBlank() }, patient.fileNumber.takeIf { it.isNotBlank() }?.let { "File $it" })
            .joinToString(" · ")
        return BuiltChart(ChartData(ref, mRef, patient.sexEnum, points, connect, patient.mphCm, label), outside)
    }

    /** Chart that best fits the patient's most recent measurement within a reference family. */
    fun defaultReference(patient: PatientEntity, measurements: List<MeasurementEntity>, family: GrowthReferences.Family): String {
        val latest = measurements.maxByOrNull { it.dateEpochDay }
        val ageMonths = latest?.let { patient.ageOn(it.date).months } ?: patient.ageOn(java.time.LocalDate.now()).months
        return GrowthReferences.defaultFor(family, ageMonths)
    }

    /** Centile/z-score of one measurement using the default chart of the family for that age. */
    fun assess(patient: PatientEntity, m: MeasurementEntity, measure: Measure, family: GrowthReferences.Family): Pair<GrowthAssessment, String>? {
        val v = m.value(measure) ?: return null
        val age = patient.ageOn(m.date).months
        if (age < 0) return null
        val ref = GrowthReferences.get(GrowthReferences.defaultFor(family, age))
        val a = ref.measure(measure)?.assess(patient.sexEnum, age, v) ?: return null
        return a to ref.shortTitle
    }

    fun formatAssessment(a: GrowthAssessment): String {
        val p = a.percentile
        val pText = when {
            p < 0.1 -> "<P0.1"
            p > 99.9 -> ">P99.9"
            p < 1 || p > 99 -> "P" + String.format("%.1f", p)
            else -> "P" + kotlin.math.round(p).toInt().coerceIn(1, 99)
        }
        return "$pText (z ${String.format("%+.2f", a.z)})"
    }
}
