package com.bashar.growthchart.core.growth

/**
 * Sex-adjusted mid-parental (target) height (Tanner et al. 1970):
 *   boys  = (father + mother + 13) / 2
 *   girls = (father + mother - 13) / 2
 * Target range = MPH +/- 8.5 cm (approximately +/- 2 SD).
 */
object MidParentalHeight {
    const val SEX_ADJUSTMENT_CM = 13.0
    const val TARGET_RANGE_CM = 8.5

    fun calculate(sex: Sex, fatherCm: Double, motherCm: Double): Double = when (sex) {
        Sex.MALE -> (fatherCm + motherCm + SEX_ADJUSTMENT_CM) / 2.0
        Sex.FEMALE -> (fatherCm + motherCm - SEX_ADJUSTMENT_CM) / 2.0
    }

    fun targetRange(mphCm: Double): ClosedFloatingPointRange<Double> =
        (mphCm - TARGET_RANGE_CM)..(mphCm + TARGET_RANGE_CM)
}
