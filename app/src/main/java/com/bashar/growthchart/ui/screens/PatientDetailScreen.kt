package com.bashar.growthchart.ui.screens

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bashar.growthchart.ActiveSession
import com.bashar.growthchart.AppContainer
import com.bashar.growthchart.chart.ChartBuilder
import com.bashar.growthchart.chart.DATE_FORMAT
import com.bashar.growthchart.chart.GrowthChartRenderer
import com.bashar.growthchart.core.growth.Measure
import com.bashar.growthchart.core.growth.MidParentalHeight
import com.bashar.growthchart.data.MeasurementEntity
import com.bashar.growthchart.data.PatientEntity
import com.bashar.growthchart.pdf.PdfExporter
import com.bashar.growthchart.ui.components.AppTopBar
import com.bashar.growthchart.ui.components.ChartIcon
import com.bashar.growthchart.ui.components.DocumentIcon
import com.bashar.growthchart.ui.components.InfoRow
import com.bashar.growthchart.ui.components.SectionCard
import com.bashar.growthchart.ui.components.exportDir
import com.bashar.growthchart.ui.components.safeFileName
import com.bashar.growthchart.ui.components.shareFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.time.LocalDate

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PatientDetailScreen(
    container: AppContainer,
    active: ActiveSession,
    patientId: String,
    autoPdf: Boolean,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onAddMeasurement: () -> Unit,
    onEditMeasurement: (String) -> Unit,
    onChart: (Measure) -> Unit,
    onDeleted: () -> Unit,
) {
    val patient by remember(patientId) { active.repo.observePatient(patientId) }.collectAsState(initial = null)
    val measurements by remember(patientId) { active.repo.observeMeasurements(patientId) }.collectAsState(initial = emptyList())
    val settings by container.settings.values.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirmDelete by remember { mutableStateOf(false) }
    var pdfDialog by rememberSaveable { mutableStateOf(autoPdf) }
    var exporting by remember { mutableStateOf(false) }

    val p = patient
    val fileBase = p?.let { "GrowthReport_${safeFileName(it.fileNumber.ifBlank { it.name })}_${LocalDate.now()}" } ?: "GrowthReport"

    suspend fun writePdf(out: java.io.OutputStream) {
        val pt = active.repo.patient(patientId) ?: return
        val ms = active.repo.measurementsFor(patientId)
        PdfExporter.export(out, pt, ms, settings.family, settings.connectLines, active.email)
    }

    val saveLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        if (uri != null) scope.launch {
            exporting = true
            val ok = withContext(Dispatchers.IO) {
                runCatching { context.contentResolver.openOutputStream(uri)!!.use { writePdf(it) } }.isSuccess
            }
            exporting = false
            Toast.makeText(context, if (ok) "PDF saved" else "Could not save PDF", Toast.LENGTH_SHORT).show()
        }
    }

    fun sharePdf() = scope.launch {
        exporting = true
        val file = withContext(Dispatchers.IO) {
            runCatching { File(exportDir(context), "$fileBase.pdf").also { f -> f.outputStream().use { writePdf(it) } } }.getOrNull()
        }
        exporting = false
        if (file != null) shareFile(context, file, "application/pdf", "Growth report") else Toast.makeText(context, "Could not create PDF", Toast.LENGTH_SHORT).show()
    }

    Scaffold(
        topBar = {
            AppTopBar(p?.name ?: "Patient", onBack) {
                IconButton(onClick = onEdit, enabled = p != null) { Icon(Icons.Default.Edit, "Edit patient") }
                IconButton(onClick = { pdfDialog = true }, enabled = p != null) { Icon(DocumentIcon, "Export PDF") }
                IconButton(onClick = { confirmDelete = true }, enabled = p != null) { Icon(Icons.Default.Delete, "Delete patient") }
            }
        },
    ) { pad ->
        if (p == null) return@Scaffold
        Column(
            Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val w = Modifier.widthIn(max = 720.dp)
            SectionCard("Patient information", w) {
                InfoRow("Name", p.name)
                InfoRow("Sex", p.sexEnum.label)
                InfoRow("File number", p.fileNumber)
                InfoRow("Date of birth", p.dob.format(DATE_FORMAT))
                InfoRow("Current age", p.ageOn(LocalDate.now()).format())
                p.fatherHeightCm?.let { InfoRow("Father's height", "${GrowthChartRenderer.fmt2(it)} cm") }
                p.motherHeightCm?.let { InfoRow("Mother's height", "${GrowthChartRenderer.fmt2(it)} cm") }
                InfoRow("Mid-parental height", p.mphCm?.let { mph ->
                    val r = MidParentalHeight.targetRange(mph)
                    "${GrowthChartRenderer.fmt(mph)} cm (target ${GrowthChartRenderer.fmt(r.start)}–${GrowthChartRenderer.fmt(r.endInclusive)} cm)" + if (p.mphManual) ", manual" else ""
                } ?: "not recorded")
                if (p.notes.isNotBlank()) InfoRow("Notes", p.notes)
            }

            FlowRow(w.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onAddMeasurement) { Icon(Icons.Default.Add, null); Text(" Add measurement") }
                FilledTonalButton(onClick = { onChart(Measure.HEIGHT) }) { Icon(ChartIcon, null); Text(" Height chart") }
                FilledTonalButton(onClick = { onChart(Measure.WEIGHT) }) { Icon(ChartIcon, null); Text(" Weight chart") }
                OutlinedButton(onClick = { pdfDialog = true }) { Icon(DocumentIcon, null); Text(" Export PDF") }
            }

            SectionCard("Measurements (${measurements.size})", w) {
                if (measurements.isEmpty()) Text("No measurements yet.")
                else {
                    Text(
                        "Percentiles: ${settings.family.label}. Tap a row to edit.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    measurements.sortedByDescending { it.dateEpochDay }.forEach { m -> MeasurementRow(p, m, settings.family) { onEditMeasurement(m.id) } }
                }
            }
        }
    }

    if (confirmDelete && p != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete ${p.name}?") },
            text = { Text("The patient and all ${measurements.size} measurements will be permanently deleted from this device (and from the cloud if sync is enabled). This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    scope.launch { active.repo.deletePatient(patientId); onDeleted() }
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }

    if (pdfDialog && p != null) {
        AlertDialog(
            onDismissRequest = { pdfDialog = false },
            title = { Text("Export patient report (PDF)") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Includes patient information, notes, the measurement table and the height- and weight-for-age charts with every red × marker.")
                    if (exporting) CircularProgressIndicator(Modifier.size(24.dp))
                }
            },
            confirmButton = {
                TextButton(onClick = { pdfDialog = false; saveLauncher.launch("$fileBase.pdf") }) { Text("Save to device") }
            },
            dismissButton = {
                TextButton(onClick = { pdfDialog = false; sharePdf() }) { Text("Share / print") }
            },
        )
    }
    if (exporting) {
        LaunchedEffect(Unit) { Toast.makeText(context, "Creating PDF…", Toast.LENGTH_SHORT).show() }
    }
}

@Composable
private fun MeasurementRow(p: PatientEntity, m: MeasurementEntity, family: com.bashar.growthchart.core.growth.GrowthReferences.Family, onClick: () -> Unit) {
    val age = p.ageOn(m.date)
    val h = ChartBuilder.assess(p, m, Measure.HEIGHT, family)
    val wt = ChartBuilder.assess(p, m, Measure.WEIGHT, family)
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            Column(Modifier.weight(1f)) {
                Text(m.date.format(DATE_FORMAT), fontWeight = FontWeight.SemiBold)
                Text(age.format(), style = MaterialTheme.typography.bodySmall)
            }
            Column(Modifier.weight(1.2f)) {
                Text(m.heightCm?.let { "${GrowthChartRenderer.fmt2(it)} cm" } ?: "–")
                h?.let { Text(ChartBuilder.formatAssessment(it.first), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary) }
            }
            Column(Modifier.weight(1.2f)) {
                Text(m.weightKg?.let { "${GrowthChartRenderer.fmt2(it)} kg" } ?: "–")
                wt?.let { Text(ChartBuilder.formatAssessment(it.first), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary) }
            }
        }
        if (m.notes.isNotBlank()) Text(m.notes, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        HorizontalDivider()
    }
}
