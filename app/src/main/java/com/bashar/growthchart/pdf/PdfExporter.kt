package com.bashar.growthchart.pdf

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import com.bashar.growthchart.chart.ChartBuilder
import com.bashar.growthchart.chart.DATE_FORMAT
import com.bashar.growthchart.chart.GrowthChartRenderer
import com.bashar.growthchart.core.chart.ChartMath
import com.bashar.growthchart.core.growth.GrowthReferences
import com.bashar.growthchart.core.growth.Measure
import com.bashar.growthchart.core.growth.MidParentalHeight
import com.bashar.growthchart.data.MeasurementEntity
import com.bashar.growthchart.data.PatientEntity
import java.io.OutputStream
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Builds a printable patient report: demographics, MPH, notes, a table of all
 * measurements, then full-page height-for-age and weight-for-age charts drawn with
 * the same renderer as the screen (vector graphics, so they print sharply).
 */
object PdfExporter {
    private const val A4_W = 595
    private const val A4_H = 842
    private const val M = 40f

    fun export(
        out: OutputStream,
        patient: PatientEntity,
        measurements: List<MeasurementEntity>,
        family: GrowthReferences.Family,
        connect: Boolean,
        clinician: String,
    ) {
        val doc = PdfDocument()
        var pageNo = 0
        fun newPage(w: Int, h: Int): PdfDocument.Page = doc.startPage(PdfDocument.PageInfo.Builder(w, h, ++pageNo).create())

        val h1 = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 18f; typeface = Typeface.DEFAULT_BOLD; color = Color.rgb(11, 85, 99) }
        val h2 = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 12.5f; typeface = Typeface.DEFAULT_BOLD; color = Color.rgb(11, 85, 99) }
        val body = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 10f; color = Color.BLACK }
        val bold = Paint(body).apply { typeface = Typeface.DEFAULT_BOLD }
        val small = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 8f; color = Color.DKGRAY }
        val line = Paint().apply { color = Color.rgb(200, 205, 210); strokeWidth = 0.6f }

        var page = newPage(A4_W, A4_H)
        var c: Canvas = page.canvas
        var y = M + 10f

        fun footer(canvas: Canvas) {
            canvas.drawText(
                "Generated ${LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))} by $clinician · Pediatric Growth Chart · page $pageNo",
                M, A4_H - 20f, small,
            )
        }

        fun ensure(space: Float) {
            if (y + space > A4_H - 40f) {
                footer(c)
                doc.finishPage(page)
                page = newPage(A4_W, A4_H)
                c = page.canvas
                y = M + 10f
            }
        }

        c.drawText("Pediatric Growth Report", M, y, h1); y += 26f

        // ---- patient information
        c.drawText("Patient information", M, y, h2); y += 16f
        val today = LocalDate.now()
        val info = listOf(
            "Name" to patient.name,
            "Sex" to patient.sexEnum.label,
            "File number" to patient.fileNumber,
            "Date of birth" to patient.dob.format(DATE_FORMAT),
            "Current age" to patient.ageOn(today).format() + " (on ${today.format(DATE_FORMAT)})",
            "Father's height" to (patient.fatherHeightCm?.let { "${GrowthChartRenderer.fmt(it)} cm" } ?: "-"),
            "Mother's height" to (patient.motherHeightCm?.let { "${GrowthChartRenderer.fmt(it)} cm" } ?: "-"),
            "Mid-parental height" to (patient.mphCm?.let { mph ->
                val r = MidParentalHeight.targetRange(mph)
                "${GrowthChartRenderer.fmt(mph)} cm (target range ${GrowthChartRenderer.fmt(r.start)}–${GrowthChartRenderer.fmt(r.endInclusive)} cm)" +
                    if (patient.mphManual) " — entered manually" else ""
            } ?: "-"),
        )
        for ((k, v) in info) {
            c.drawText(k, M, y, bold)
            c.drawText(v, M + 120f, y, body)
            y += 14f
        }
        y += 6f
        c.drawText("Clinical notes", M, y, h2); y += 15f
        val noteLines = wrap(patient.notes.ifBlank { "-" }, body, A4_W - 2 * M)
        for (l in noteLines) { ensure(14f); c.drawText(l, M, y, body); y += 13f }
        y += 8f

        // ---- measurement table
        ensure(40f)
        c.drawText("Growth measurements", M, y, h2); y += 16f
        val cols = floatArrayOf(M, M + 70f, M + 160f, M + 220f, M + 340f, M + 395f)
        val headers = listOf("Date", "Age", "Height (cm)", "Height centile", "Weight (kg)", "Weight centile")
        fun header() {
            headers.forEachIndexed { i, h -> c.drawText(h, cols[i], y, bold) }
            y += 5f; c.drawLine(M, y, A4_W - M, y, line); y += 12f
        }
        header()
        val sorted = measurements.sortedBy { it.dateEpochDay }
        val refsUsed = LinkedHashSet<String>()
        for (m in sorted) {
            if (y + 26f > A4_H - 40f) { ensure(1000f); header() }
            val age = patient.ageOn(m.date)
            val ha = ChartBuilder.assess(patient, m, Measure.HEIGHT, family)
            val wa = ChartBuilder.assess(patient, m, Measure.WEIGHT, family)
            ha?.second?.let { refsUsed.add(it) }; wa?.second?.let { refsUsed.add(it) }
            val cells = listOf(
                m.date.format(DATE_FORMAT),
                age.format(),
                m.heightCm?.let { GrowthChartRenderer.fmt2(it) } ?: "-",
                ha?.let { ChartBuilder.formatAssessment(it.first) } ?: "-",
                m.weightKg?.let { GrowthChartRenderer.fmt2(it) } ?: "-",
                wa?.let { ChartBuilder.formatAssessment(it.first) } ?: "-",
            )
            cells.forEachIndexed { i, t -> c.drawText(t, cols[i], y, body) }
            y += 13f
            if (m.notes.isNotBlank()) {
                for (l in wrap("Note: " + m.notes, small, A4_W - 2 * M - 70f)) { c.drawText(l, cols[1], y, small); y += 10f }
            }
            c.drawLine(M, y - 9f, A4_W - M, y - 9f, line.apply { alpha = 90 })
            line.alpha = 255
        }
        if (sorted.isEmpty()) { c.drawText("No measurements recorded.", M, y, body); y += 14f }
        y += 8f
        ensure(30f)
        for (l in wrap(
            "Centiles/z-scores calculated with the LMS method using ${family.label}; references used: ${refsUsed.joinToString(", ").ifEmpty { "-" }}. " +
                "Age is exact chronological age (days / 30.4375 months). For clinical decision support only.",
            small, A4_W - 2 * M,
        )) { c.drawText(l, M, y, small); y += 10f }
        footer(c)
        doc.finishPage(page)

        // ---- charts: one landscape page per chart that contains measurements
        val renderer = GrowthChartRenderer(1f)
        val chartIds = if (family == GrowthReferences.Family.CDC) listOf(GrowthReferences.CDC_INFANT, GrowthReferences.CDC_CHILD)
        else listOf(GrowthReferences.WHO_2006, GrowthReferences.WHO_2007)
        val defaultId = ChartBuilder.defaultReference(patient, measurements, family)
        for (measure in listOf(Measure.HEIGHT, Measure.WEIGHT)) {
            val charts = chartIds.mapNotNull { id -> ChartBuilder.build(patient, measurements, id, measure, connect)?.let { id to it } }
            val toDraw = charts.filter { it.second.data.points.isNotEmpty() }.ifEmpty { charts.filter { it.first == defaultId } }
            for ((_, built) in toDraw) {
                val w = 842; val h = 595
                val pg = newPage(w, h)
                val bounds = ChartMath.fullBounds(built.data.measure, built.data.sex, built.data.points.map { it.value })
                pg.canvas.save()
                pg.canvas.translate(20f, 16f)
                renderer.draw(pg.canvas, w - 40f, h - 44f, built.data, bounds)
                pg.canvas.restore()
                pg.canvas.drawText(
                    "Red × = measurement (circled = latest). Plotted at exact chronological age. Source: ${built.data.reference.source}",
                    24f, h - 14f, Paint(small).apply { textSize = 6.5f },
                )
                doc.finishPage(pg)
            }
        }

        doc.writeTo(out)
        doc.close()
    }

    private fun wrap(text: String, paint: Paint, width: Float): List<String> {
        val out = ArrayList<String>()
        for (para in text.split("\n")) {
            var cur = ""
            for (word in para.split(" ")) {
                val t = if (cur.isEmpty()) word else "$cur $word"
                if (paint.measureText(t) > width && cur.isNotEmpty()) { out.add(cur); cur = word } else cur = t
            }
            out.add(cur)
        }
        return out
    }
}
