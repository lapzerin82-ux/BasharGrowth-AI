package com.bashar.growthchart.chart

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import com.bashar.growthchart.core.chart.ChartMath
import com.bashar.growthchart.core.chart.Viewport
import com.bashar.growthchart.core.growth.AgeCalculator
import com.bashar.growthchart.core.growth.GrowthReference
import com.bashar.growthchart.core.growth.GrowthReferences
import com.bashar.growthchart.core.growth.Measure
import com.bashar.growthchart.core.growth.MeasureReference
import com.bashar.growthchart.core.growth.MidParentalHeight
import com.bashar.growthchart.core.growth.Sex
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** One patient measurement placed on a chart. x = exact age in months (unrounded). */
data class ChartPoint(
    val measurementId: String,
    val ageMonths: Double,
    val value: Double,
    val dateText: String,
    val ageText: String,
    val latest: Boolean,
)

class ChartData(
    val reference: GrowthReference,
    val measure: MeasureReference,
    val sex: Sex,
    val points: List<ChartPoint>,
    val connect: Boolean,
    val mphCm: Double?,
    val patientLabel: String,
) {
    val title: String
        get() {
            val who = if (sex == Sex.MALE) "Boys" else "Girls"
            val range = if (measure.ageMax <= 36.0) "birth to 36 months" else {
                val lo = formatAgeRange(measure.ageMin)
                val hi = formatAgeRange(measure.ageMax)
                "$lo to $hi"
            }
            return "${measure.label}: $who, $range"
        }

    private fun formatAgeRange(m: Double): String =
        if (m == 0.0) "birth" else if (m % 12.0 == 0.0) "${(m / 12).toInt()} years" else "${m.toInt()} months"
}

/**
 * Draws a growth chart onto an android.graphics.Canvas. The same renderer is used for the
 * interactive on-screen chart and for PDF export, so both are identical.
 *
 * All positions are computed mathematically: centile curves from the LMS tables and
 * each red cross at (exact age, measured value). Nothing is scaled from bitmaps, so the
 * chart remains sharp at every zoom level.
 *
 * [unit] = pixels per dp (screen density), or 1f for PDF points.
 */
class GrowthChartRenderer(private val unit: Float) {

    private fun dp(v: Float) = v * unit

    private val marginLeft get() = dp(50f)
    private val marginRight get() = dp(34f)
    private val marginTop get() = dp(46f)
    private val marginBottom get() = dp(40f)

    fun plotRect(width: Float, height: Float) =
        RectF(marginLeft, marginTop, width - marginRight, height - marginBottom)

    fun xToPx(x: Double, vp: Viewport, r: RectF) = (r.left + (x - vp.xMin) / vp.width * r.width()).toFloat()
    fun yToPx(y: Double, vp: Viewport, r: RectF) = (r.bottom - (y - vp.yMin) / vp.height * r.height()).toFloat()
    fun pxToX(px: Float, vp: Viewport, r: RectF) = vp.xMin + (px - r.left) / r.width() * vp.width
    fun pxToY(py: Float, vp: Viewport, r: RectF) = vp.yMin + (r.bottom - py) / r.height() * vp.height

    private fun colors(sex: Sex) = if (sex == Sex.MALE) {
        Palette(accent = Color.rgb(21, 88, 160), curve = Color.rgb(28, 70, 120), band = Color.argb(20, 21, 88, 160))
    } else {
        Palette(accent = Color.rgb(176, 42, 104), curve = Color.rgb(120, 32, 78), band = Color.argb(20, 176, 42, 104))
    }

    private data class Palette(val accent: Int, val curve: Int, val band: Int)

    private val markerRed = Color.rgb(220, 20, 30)
    private val latestRed = Color.rgb(160, 0, 10)

    fun draw(canvas: Canvas, width: Float, height: Float, data: ChartData, vp: Viewport) {
        val r = plotRect(width, height)
        val pal = colors(data.sex)
        val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        canvas.drawColor(Color.WHITE)

        // ---- title
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = pal.accent; textSize = dp(13f); typeface = Typeface.DEFAULT_BOLD
        }
        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.DKGRAY; textSize = dp(9f) }
        canvas.drawText(data.title, r.left, dp(16f), titlePaint)
        canvas.drawText(
            "${data.reference.title} · ${data.reference.version}" + if (data.patientLabel.isNotEmpty()) "   |   ${data.patientLabel}" else "",
            r.left, dp(29f), subPaint,
        )
        drawLegend(canvas, r, data, subPaint)

        // ---- plot background + grid
        fill.color = Color.rgb(255, 255, 252)
        canvas.drawRect(r, fill)

        val yearsAxis = data.measure.ageMax > 36.0 && vp.width > 18.0
        val xMajor = if (yearsAxis) max(12.0, floor(ChartMath.niceStep(vp.width / 12.0, 10) ) * 12.0) else ChartMath.ageStepMonths(vp.width)
        val xMinor = when {
            yearsAxis && xMajor <= 12.0 -> 3.0
            yearsAxis -> 12.0
            xMajor >= 3.0 -> 1.0
            else -> xMajor / 2
        }
        val yMajor = ChartMath.niceStep(vp.height, 12)
        val yMinor = if (yMajor >= 5.0 && (yMajor / 5.0) / vp.height * r.height() > dp(4f)) yMajor / 5.0 else yMajor / 2.0

        val minorPaint = Paint().apply { color = Color.rgb(228, 232, 236); strokeWidth = dp(0.5f) }
        val majorPaint = Paint().apply { color = Color.rgb(190, 198, 206); strokeWidth = dp(0.8f) }

        canvas.save()
        canvas.clipRect(r)
        for (x in ChartMath.ticks(vp.xMin, vp.xMax, xMinor)) {
            val px = xToPx(x, vp, r); canvas.drawLine(px, r.top, px, r.bottom, minorPaint)
        }
        for (y in ChartMath.ticks(vp.yMin, vp.yMax, yMinor)) {
            val py = yToPx(y, vp, r); canvas.drawLine(r.left, py, r.right, py, minorPaint)
        }
        for (x in ChartMath.ticks(vp.xMin, vp.xMax, xMajor)) {
            val px = xToPx(x, vp, r); canvas.drawLine(px, r.top, px, r.bottom, majorPaint)
        }
        for (y in ChartMath.ticks(vp.yMin, vp.yMax, yMajor)) {
            val py = yToPx(y, vp, r); canvas.drawLine(r.left, py, r.right, py, majorPaint)
        }

        // ---- centile curves (computed from LMS at every few pixels)
        val labelYs = ArrayList<Pair<Double, Float>>()
        val segments = curveSegments(data)
        val visibleXMax = min(vp.xMax, data.measure.ageMax)
        for (c in data.reference.centiles) {
            val isMedian = c == 50.0
            val isOuter = c == data.reference.centiles.first() || c == data.reference.centiles.last()
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                color = pal.curve
                strokeWidth = dp(if (isMedian) 1.8f else if (isOuter) 1.3f else 1.0f)
                strokeJoin = Paint.Join.ROUND
            }
            for ((a0, a1) in segments) {
                val start = max(a0, vp.xMin)
                val end = min(a1, vp.xMax)
                if (end <= start) continue
                val path = Path()
                val n = max(2, ((xToPx(end, vp, r) - xToPx(start, vp, r)) / dp(2f)).roundToInt())
                var first = true
                for (i in 0..n) {
                    val age = start + (end - start) * i / n
                    val v = data.measure.centileValue(data.sex, age, c) ?: continue
                    val px = xToPx(age, vp, r); val py = yToPx(v, vp, r)
                    if (first) { path.moveTo(px, py); first = false } else path.lineTo(px, py)
                }
                canvas.drawPath(path, paint)
            }
            if (visibleXMax > vp.xMin) {
                data.measure.centileValue(data.sex, visibleXMax, c)?.let { labelYs.add(c to yToPx(it, vp, r)) }
            }
        }

        // ---- mid-parental height and target range (adult end of the stature chart)
        if (data.measure.measure == Measure.HEIGHT && data.mphCm != null && data.measure.ageMax >= 216.0) {
            drawMph(canvas, r, vp, data.mphCm, data.measure.ageMax)
        }

        // ---- patient trajectory and red crosses
        val pts = data.points.sortedBy { it.ageMonths }
        if (data.connect && pts.size > 1) {
            val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; color = Color.argb(200, 200, 20, 30); strokeWidth = dp(1.4f)
            }
            val path = Path()
            pts.forEachIndexed { i, p ->
                val px = xToPx(p.ageMonths, vp, r); val py = yToPx(p.value, vp, r)
                if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
            }
            canvas.drawPath(path, line)
        }
        for (p in pts) drawCross(canvas, xToPx(p.ageMonths, vp, r), yToPx(p.value, vp, r), p.latest)
        canvas.restore()

        // ---- frame, centile labels, axes
        val frame = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = Color.rgb(80, 90, 100); strokeWidth = dp(1f) }
        canvas.drawRect(r, frame)

        val cl = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.curve; textSize = dp(9.5f); typeface = Typeface.DEFAULT_BOLD }
        var lastY = Float.MAX_VALUE
        labelYs.sortedByDescending { it.second }.forEach { (c, y0) ->
            if (y0 < r.top - dp(2f) || y0 > r.bottom + dp(2f)) return@forEach
            val y = min(y0 + dp(3.5f), lastY - dp(10f))
            canvas.drawText(c.fmtCentile(), r.right + dp(3f), y, cl)
            lastY = y
        }

        val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(40, 40, 40); textSize = dp(10f); textAlign = Paint.Align.CENTER }
        for (x in ChartMath.ticks(vp.xMin, vp.xMax, xMajor)) {
            val label = if (yearsAxis) fmt(x / 12.0) else fmt(x)
            canvas.drawText(label, xToPx(x, vp, r), r.bottom + dp(13f), tick)
        }
        tick.textAlign = Paint.Align.RIGHT
        for (y in ChartMath.ticks(vp.yMin, vp.yMax, yMajor)) {
            canvas.drawText(fmt(y), r.left - dp(4f), yToPx(y, vp, r) + dp(3.5f), tick)
        }
        val axis = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(40, 40, 40); textSize = dp(10.5f); typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }
        canvas.drawText(if (yearsAxis) "Age (years)" else "Age (months)", r.centerX(), r.bottom + dp(29f), axis)
        canvas.save()
        canvas.rotate(-90f, dp(12f), r.centerY())
        canvas.drawText(data.measure.axisLabel, dp(12f), r.centerY() + dp(4f), axis)
        canvas.restore()
    }

    /** WHO 0-5 y: recumbent length to 24 months, standing height after — drawn as two separate curves. */
    private fun curveSegments(data: ChartData): List<Pair<Double, Double>> {
        val m = data.measure
        if (data.reference.id == GrowthReferences.WHO_2006 && m.measure == Measure.HEIGHT) {
            return listOf(m.ageMin to 730.0 / AgeCalculator.DAYS_PER_MONTH, 731.0 / AgeCalculator.DAYS_PER_MONTH to m.ageMax)
        }
        return listOf(m.ageMin to m.ageMax)
    }

    private fun drawMph(canvas: Canvas, r: RectF, vp: Viewport, mph: Double, ageMax: Double) {
        val x = xToPx(ageMax, vp, r) - dp(10f)
        if (x < r.left || x > r.right) return
        val range = MidParentalHeight.targetRange(mph)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(0, 120, 90); strokeWidth = dp(2f) }
        val yTop = yToPx(range.endInclusive, vp, r)
        val yBot = yToPx(range.start, vp, r)
        val yMid = yToPx(mph, vp, r)
        canvas.drawLine(x, yTop, x, yBot, p)
        canvas.drawLine(x - dp(4f), yTop, x + dp(4f), yTop, p)
        canvas.drawLine(x - dp(4f), yBot, x + dp(4f), yBot, p)
        canvas.drawCircle(x, yMid, dp(3.5f), p)
        val t = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(0, 110, 80); textSize = dp(9f); textAlign = Paint.Align.RIGHT; typeface = Typeface.DEFAULT_BOLD }
        canvas.drawText("MPH ${fmt(mph)}", x - dp(6f), yMid + dp(3f), t)
    }

    private fun drawCross(canvas: Canvas, x: Float, y: Float, latest: Boolean) {
        val half = dp(if (latest) 6.5f else 5f)
        val halo = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; strokeWidth = dp(if (latest) 5f else 4f); strokeCap = Paint.Cap.ROUND }
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (latest) latestRed else markerRed; strokeWidth = dp(if (latest) 2.6f else 2f); strokeCap = Paint.Cap.ROUND
        }
        canvas.drawLine(x - half, y - half, x + half, y + half, halo)
        canvas.drawLine(x - half, y + half, x + half, y - half, halo)
        canvas.drawLine(x - half, y - half, x + half, y + half, p)
        canvas.drawLine(x - half, y + half, x + half, y - half, p)
        if (latest) {
            val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; color = latestRed; strokeWidth = dp(1.2f)
                pathEffect = DashPathEffect(floatArrayOf(dp(2f), dp(1.5f)), 0f)
            }
            canvas.drawCircle(x, y, half + dp(4f), ring)
        }
    }

    private fun drawLegend(canvas: Canvas, r: RectF, data: ChartData, text: Paint) {
        val y = dp(41f)
        var x = r.left + dp(5f)
        drawCross(canvas, x, y - dp(3f), false)
        canvas.drawText("measurement", x + dp(9f), y, text)
        x += dp(80f)
        drawCross(canvas, x, y - dp(3f), true)
        canvas.drawText("latest", x + dp(13f), y, text)
        x += dp(46f)
        canvas.drawText("Centiles: " + data.reference.centiles.joinToString(", ") { it.fmtCentile() }, x, y, text)
    }

    /** Nearest plotted point within [radiusDp] of a touch, or null. */
    fun hitTest(px: Float, py: Float, width: Float, height: Float, data: ChartData, vp: Viewport, radiusDp: Float = 24f): ChartPoint? {
        val r = plotRect(width, height)
        return data.points
            .map { it to hypot(xToPx(it.ageMonths, vp, r) - px, yToPx(it.value, vp, r) - py) }
            .filter { it.second <= dp(radiusDp) }
            .minByOrNull { it.second }?.first
    }

    companion object {
        /** Up to 2 decimals, trailing zeros removed (measurements are shown exactly as entered). */
        fun fmt2(v: Double): String = java.math.BigDecimal(v).setScale(2, java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()

        fun fmt(v: Double): String {
            val r = (v * 10).roundToInt() / 10.0
            return if (abs(r - r.roundToInt()) < 1e-9) r.roundToInt().toString() else r.toString()
        }
    }
}

private fun Double.fmtCentile(): String = if (this % 1.0 == 0.0) this.toInt().toString() else this.toString()
