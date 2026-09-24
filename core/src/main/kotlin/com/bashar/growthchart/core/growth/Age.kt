package com.bashar.growthchart.core.growth

import java.time.LocalDate
import java.time.Period
import java.time.temporal.ChronoUnit

/**
 * Exact chronological age.
 *
 * Plotting uses the exact number of days between date of birth and the
 * measurement date, converted to months with the conventional
 * 30.4375 days/month (= 365.25 / 12), which is the convention used by both
 * the WHO and CDC reference tables. No rounding is applied.
 */
data class ExactAge(val days: Long, val period: Period) {
    val months: Double get() = days / AgeCalculator.DAYS_PER_MONTH
    val years: Double get() = days / AgeCalculator.DAYS_PER_YEAR

    /** e.g. "8 y 6 m 9 d". */
    fun format(): String {
        if (days < 0) return "before birth"
        val y = period.years
        val m = period.months
        val d = period.days
        return when {
            y > 0 -> "$y y $m m $d d"
            m > 0 -> "$m m $d d"
            else -> "$d d"
        }
    }

    /** e.g. "8 y 6 m" (used in compact tables). */
    fun formatShort(): String = if (days < 0) "-" else if (period.years > 0) "${period.years} y ${period.months} m" else "${period.months} m ${period.days} d"
}

object AgeCalculator {
    const val DAYS_PER_YEAR = 365.25
    const val DAYS_PER_MONTH = DAYS_PER_YEAR / 12.0

    fun exactAge(dob: LocalDate, date: LocalDate): ExactAge =
        ExactAge(ChronoUnit.DAYS.between(dob, date), Period.between(dob, date))
}
