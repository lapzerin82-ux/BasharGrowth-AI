package com.bashar.growthchart.core.growth

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.pow

enum class Sex(val code: String, val label: String) {
    MALE("M", "Male"),
    FEMALE("F", "Female");

    companion object {
        fun fromCode(code: String): Sex = entries.firstOrNull { it.code == code } ?: MALE
    }
}

enum class Measure(val key: String) {
    HEIGHT("height"),
    WEIGHT("weight"),
}

/** One row of an LMS table (Cole & Green 1992). */
data class Lms(val l: Double, val m: Double, val s: Double) {

    /** Measurement value corresponding to a given z-score. */
    fun valueAt(z: Double): Double =
        if (abs(l) < 1e-9) m * exp(s * z) else m * (1.0 + l * s * z).pow(1.0 / l)

    /** Standard LMS z-score for a measurement value. */
    fun zScore(x: Double): Double =
        if (abs(l) < 1e-9) ln(x / m) / s else ((x / m).pow(l) - 1.0) / (l * s)
}

/**
 * LMS parameters tabulated by age (months). Values between tabulated ages are
 * obtained by linear interpolation of L, M and S, as done by the CDC SAS/R
 * programs and the WHO anthro software (WHO tables are daily, so interpolation
 * there is between consecutive days).
 */
class LmsTable(private val ages: DoubleArray, private val l: DoubleArray, private val m: DoubleArray, private val s: DoubleArray) {

    init {
        require(ages.isNotEmpty() && ages.size == l.size && ages.size == m.size && ages.size == s.size)
        for (i in 1 until ages.size) require(ages[i] > ages[i - 1]) { "ages must be strictly increasing" }
    }

    val minAge: Double get() = ages.first()
    val maxAge: Double get() = ages.last()

    fun at(ageMonths: Double): Lms? {
        if (ageMonths.isNaN() || ageMonths < ages.first() - 1e-9 || ageMonths > ages.last() + 1e-9) return null
        var lo = 0
        var hi = ages.size - 1
        if (ageMonths <= ages[lo]) return Lms(l[lo], m[lo], s[lo])
        if (ageMonths >= ages[hi]) return Lms(l[hi], m[hi], s[hi])
        while (hi - lo > 1) {
            val mid = (lo + hi) ushr 1
            if (ages[mid] <= ageMonths) lo = mid else hi = mid
        }
        val f = (ageMonths - ages[lo]) / (ages[hi] - ages[lo])
        return Lms(
            l[lo] + (l[hi] - l[lo]) * f,
            m[lo] + (m[hi] - m[lo]) * f,
            s[lo] + (s[hi] - s[lo]) * f,
        )
    }

    companion object {
        fun fromRows(rows: List<List<Double>>): LmsTable = LmsTable(
            DoubleArray(rows.size) { rows[it][0] },
            DoubleArray(rows.size) { rows[it][1] },
            DoubleArray(rows.size) { rows[it][2] },
            DoubleArray(rows.size) { rows[it][3] },
        )
    }
}

data class GrowthAssessment(val z: Double, val percentile: Double)

class MeasureReference(
    val measure: Measure,
    val label: String,
    val axisLabel: String,
    val unit: String,
    val method: String,
    /** Age range of the printed chart, in months. */
    val ageMin: Double,
    val ageMax: Double,
    private val tables: Map<Sex, LmsTable>,
    private val whoRestrictedTails: Boolean,
) {
    fun table(sex: Sex): LmsTable = tables.getValue(sex)

    fun covers(ageMonths: Double): Boolean = ageMonths >= ageMin - 1e-9 && ageMonths <= ageMax + 1e-9

    fun lms(sex: Sex, ageMonths: Double): Lms? = if (covers(ageMonths)) table(sex).at(ageMonths) else null

    /** Value of the given percentile curve (e.g. 3, 50, 97) at an exact age, or null if outside the chart. */
    fun centileValue(sex: Sex, ageMonths: Double, centile: Double): Double? =
        lms(sex, ageMonths)?.valueAt(Normal.inverseCdf(centile / 100.0))

    fun zValue(sex: Sex, ageMonths: Double, z: Double): Double? = lms(sex, ageMonths)?.valueAt(z)

    fun assess(sex: Sex, ageMonths: Double, value: Double): GrowthAssessment? {
        if (value <= 0.0 || value.isNaN()) return null
        val p = lms(sex, ageMonths) ?: return null
        var z = p.zScore(value)
        if (whoRestrictedTails && abs(z) > 3.0) {
            // WHO restricted application of the LMS method beyond +/-3 SD (weight-based indicators),
            // WHO Child Growth Standards: Methods and development (2006), chapter 7.
            z = if (z > 3.0) {
                val sd3 = p.valueAt(3.0); val sd2 = p.valueAt(2.0)
                3.0 + (value - sd3) / (sd3 - sd2)
            } else {
                val sd3 = p.valueAt(-3.0); val sd2 = p.valueAt(-2.0)
                -3.0 + (value - sd3) / (sd2 - sd3)
            }
        }
        return GrowthAssessment(z, Normal.cdf(z) * 100.0)
    }
}

class GrowthReference(
    val id: String,
    val title: String,
    val shortTitle: String,
    val organisation: String,
    val source: String,
    val version: String,
    val family: String,
    val centiles: List<Double>,
    val measures: Map<Measure, MeasureReference>,
) {
    fun measure(m: Measure): MeasureReference? = measures[m]

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun parse(text: String): GrowthReference {
            val f = json.decodeFromString(ReferenceFile.serializer(), text)
            val measures = Measure.entries.mapNotNull { m ->
                val mf = f.measures[m.key] ?: return@mapNotNull null
                m to MeasureReference(
                    measure = m,
                    label = mf.label,
                    axisLabel = mf.axisLabel,
                    unit = mf.unit,
                    method = mf.method,
                    ageMin = mf.ageMin,
                    ageMax = mf.ageMax,
                    tables = mapOf(Sex.MALE to LmsTable.fromRows(mf.male), Sex.FEMALE to LmsTable.fromRows(mf.female)),
                    whoRestrictedTails = f.family == "WHO" && m == Measure.WEIGHT,
                )
            }.toMap()
            return GrowthReference(f.id, f.title, f.shortTitle, f.organisation, f.source, f.version, f.family, f.centiles, measures)
        }
    }
}

@Serializable
internal data class ReferenceFile(
    val id: String,
    val title: String,
    val shortTitle: String,
    val organisation: String,
    val source: String,
    val version: String,
    val family: String,
    val centiles: List<Double>,
    val measures: Map<String, MeasureFile>,
)

@Serializable
internal data class MeasureFile(
    val label: String,
    val axisLabel: String,
    val unit: String,
    val method: String,
    val ageMin: Double,
    val ageMax: Double,
    val male: List<List<Double>>,
    val female: List<List<Double>>,
)
