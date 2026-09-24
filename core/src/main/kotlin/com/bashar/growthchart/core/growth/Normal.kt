package com.bashar.growthchart.core.growth

import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.sqrt

/** Standard normal distribution helpers. */
object Normal {

    /** Cumulative distribution function (erfc via Chebyshev expansion, Numerical Recipes 3rd ed.). */
    fun cdf(z: Double): Double {
        if (z.isNaN()) return Double.NaN
        return 0.5 * erfc(-z / sqrt(2.0))
    }

    private fun erfc(x: Double): Double {
        // Chebyshev coefficients from Numerical Recipes 3rd ed. (Erf::erfccheb).
        val z = abs(x)
        val t = 2.0 / (2.0 + z)
        val ty = 4.0 * t - 2.0
        var d = 0.0
        var dd = 0.0
        for (j in COF.size - 1 downTo 1) {
            val tmp = d
            d = ty * d - dd + COF[j]
            dd = tmp
        }
        val res = t * exp(-z * z + 0.5 * (COF[0] + ty * d) - dd)
        return if (x >= 0.0) res else 2.0 - res
    }

    private val COF = doubleArrayOf(
        -1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3,
        -9.46595344482036e-4, 3.66839497852761e-4, 4.2523324806907e-5, -2.0278578112534e-5,
        -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
        6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10,
        9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13,
        -1.12708e-13, 3.81e-16, 7.106e-15, -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17,
    )

    /** Inverse CDF (Acklam's algorithm refined by one Halley step; |error| < 1e-12). */
    fun inverseCdf(p: Double): Double {
        require(p > 0.0 && p < 1.0) { "p must be in (0,1)" }
        val a = doubleArrayOf(-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00)
        val b = doubleArrayOf(-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01)
        val c = doubleArrayOf(-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00)
        val d = doubleArrayOf(7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00)
        val pLow = 0.02425
        val x: Double = when {
            p < pLow -> {
                val q = sqrt(-2 * ln(p))
                (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
            }
            p <= 1 - pLow -> {
                val q = p - 0.5
                val r = q * q
                (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
                    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
            }
            else -> {
                val q = sqrt(-2 * ln(1 - p))
                -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
            }
        }
        val e = cdf(x) - p
        val u = e * sqrt(2 * Math.PI) * exp(x * x / 2)
        return x - u / (1 + x * u / 2)
    }
}
