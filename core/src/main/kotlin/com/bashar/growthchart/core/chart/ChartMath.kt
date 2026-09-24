package com.bashar.growthchart.core.chart

import com.bashar.growthchart.core.growth.MeasureReference
import com.bashar.growthchart.core.growth.Sex
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/** Visible data window. x = age in months, y = measurement value. */
data class Viewport(val xMin: Double, val xMax: Double, val yMin: Double, val yMax: Double) {
    val width: Double get() = xMax - xMin
    val height: Double get() = yMax - yMin

    /**
     * Zoom about a focal point (data coordinates). factor > 1 zooms in.
     * The result is clamped to [bounds] and never smaller than 1/[maxZoom] of it.
     */
    fun zoom(factor: Double, focusX: Double, focusY: Double, bounds: Viewport, maxZoom: Double = 12.0): Viewport {
        val newW = (width / factor).coerceIn(bounds.width / maxZoom, bounds.width)
        val newH = (height / factor).coerceIn(bounds.height / maxZoom, bounds.height)
        val fx = (focusX - xMin) / width
        val fy = (focusY - yMin) / height
        val x0 = focusX - fx * newW
        val y0 = focusY - fy * newH
        return Viewport(x0, x0 + newW, y0, y0 + newH).clampedTo(bounds)
    }

    fun pan(dx: Double, dy: Double, bounds: Viewport): Viewport =
        Viewport(xMin + dx, xMax + dx, yMin + dy, yMax + dy).clampedTo(bounds)

    fun clampedTo(b: Viewport): Viewport {
        val w = min(width, b.width)
        val h = min(height, b.height)
        val x0 = xMin.coerceIn(b.xMin, b.xMax - w)
        val y0 = yMin.coerceIn(b.yMin, b.yMax - h)
        return Viewport(x0, x0 + w, y0, y0 + h)
    }
}

object ChartMath {

    /** A "nice" tick spacing (1, 2, 5 x 10^n) giving roughly [target] intervals over [span]. */
    fun niceStep(span: Double, target: Int): Double {
        if (span <= 0.0) return 1.0
        val raw = span / target
        val mag = 10.0.pow(floor(log10(raw)))
        val norm = raw / mag
        val nice = when {
            norm <= 1.0 -> 1.0
            norm <= 2.0 -> 2.0
            norm <= 2.5 -> 2.5
            norm <= 5.0 -> 5.0
            else -> 10.0
        }
        return nice * mag
    }

    /** Tick positions that are multiples of [step] inside [min, max]. */
    fun ticks(min: Double, max: Double, step: Double): List<Double> {
        val out = ArrayList<Double>()
        var v = ceil(min / step - 1e-9) * step
        while (v <= max + 1e-9) {
            out.add(if (abs(v) < 1e-9) 0.0 else v)
            v += step
        }
        return out
    }

    /** Age tick step in months for an x-span in months. */
    fun ageStepMonths(spanMonths: Double): Double = when {
        spanMonths <= 4 -> 0.5
        spanMonths <= 12 -> 1.0
        spanMonths <= 40 -> 3.0
        spanMonths <= 72 -> 6.0
        spanMonths <= 140 -> 12.0
        else -> 12.0
    }

    /**
     * Full-chart bounds for a measure: the chart's age range and a value range that
     * contains the +/-2.6 SD envelope (beyond the 3rd/97th centiles) and every patient point.
     */
    fun fullBounds(ref: MeasureReference, sex: Sex, patientValues: List<Double>): Viewport {
        var lo = Double.MAX_VALUE
        var hi = -Double.MAX_VALUE
        val steps = 200
        for (i in 0..steps) {
            val age = ref.ageMin + (ref.ageMax - ref.ageMin) * i / steps
            ref.zValue(sex, age, -2.6)?.let { lo = min(lo, it) }
            ref.zValue(sex, age, 2.6)?.let { hi = max(hi, it) }
        }
        patientValues.forEach { lo = min(lo, it); hi = max(hi, it) }
        val step = if (hi - lo > 60) 10.0 else if (hi - lo > 20) 5.0 else 1.0
        lo = floor(lo / step) * step
        hi = ceil(hi / step) * step
        if (ref.unit == "kg") lo = max(0.0, lo)
        return Viewport(ref.ageMin, ref.ageMax, lo, hi)
    }
}
