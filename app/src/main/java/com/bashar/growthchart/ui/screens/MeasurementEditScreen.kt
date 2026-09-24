package com.bashar.growthchart.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bashar.growthchart.ActiveSession
import com.bashar.growthchart.AppContainer
import com.bashar.growthchart.chart.ChartBuilder
import com.bashar.growthchart.chart.DATE_FORMAT
import com.bashar.growthchart.chart.GrowthChartRenderer
import com.bashar.growthchart.core.growth.GrowthReferences
import com.bashar.growthchart.core.growth.Measure
import com.bashar.growthchart.ui.components.AppTopBar
import com.bashar.growthchart.ui.components.DateField
import com.bashar.growthchart.ui.components.InfoRow
import com.bashar.growthchart.ui.components.NumberField
import com.bashar.growthchart.ui.components.SectionCard
import com.bashar.growthchart.ui.components.parseDate
import com.bashar.growthchart.ui.components.parseNumber
import kotlinx.coroutines.launch
import java.time.LocalDate

@Composable
fun MeasurementEditScreen(
    container: AppContainer,
    active: ActiveSession,
    patientId: String,
    measurementId: String?,
    onBack: () -> Unit,
    onSaved: () -> Unit,
    onOpenChart: () -> Unit,
) {
    val repo = active.repo
    val scope = rememberCoroutineScope()
    val patient by remember(patientId) { repo.observePatient(patientId) }.collectAsState(initial = null)
    val settings by container.settings.values.collectAsState()
    val isNew = measurementId == null

    var loaded by rememberSaveable { mutableStateOf(isNew) }
    var date by rememberSaveable { mutableStateOf(LocalDate.now().format(DATE_FORMAT)) }
    var height by rememberSaveable { mutableStateOf("") }
    var weight by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var showErrors by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(measurementId) {
        if (!loaded && measurementId != null) {
            repo.measurement(measurementId)?.let { m ->
                date = m.date.format(DATE_FORMAT)
                height = m.heightCm?.let { GrowthChartRenderer.fmt2(it) } ?: ""
                weight = m.weightKg?.let { GrowthChartRenderer.fmt2(it) } ?: ""
                notes = m.notes
            }
            loaded = true
        }
    }

    val p = patient
    val today = LocalDate.now()
    val d = parseDate(date)
    val errDate = when {
        d == null -> "Use dd/mm/yyyy"
        p != null && d.isBefore(p.dob) -> "Before date of birth (${p.dob.format(DATE_FORMAT)})"
        d.isAfter(today) -> "In the future"
        else -> null
    }
    val errHeight = rangeError(height, 30.0, 230.0, "cm")
    val errWeight = rangeError(weight, 0.3, 250.0, "kg")
    val errEmpty = if (height.isBlank() && weight.isBlank()) "Enter height and/or weight" else null
    val valid = errDate == null && errHeight == null && errWeight == null && errEmpty == null

    fun save(thenChart: Boolean) {
        showErrors = true
        if (!valid || saving || p == null) return
        saving = true
        scope.launch {
            repo.saveMeasurement(measurementId, patientId, d!!.toEpochDay(), parseNumber(height), parseNumber(weight), notes)
            saving = false
            if (thenChart) onOpenChart() else onSaved()
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(if (isNew) "Add Measurement" else "Edit Measurement", onBack) {
                if (!isNew) IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Default.Delete, "Delete measurement") }
            }
        },
    ) { pad ->
        if (p == null) return@Scaffold
        Column(
            Modifier.fillMaxSize().padding(pad).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val w = Modifier.widthIn(max = 640.dp)
            SectionCard(p.name, w) {
                InfoRow("File number", p.fileNumber)
                InfoRow("Sex", p.sexEnum.label)
                InfoRow("Date of birth", p.dob.format(DATE_FORMAT))
            }
            SectionCard("Measurement", w) {
                DateField("Measurement date", date, { date = it }, error = errDate?.takeIf { showErrors || date.length >= 8 })
                if (d != null && errDate == null) {
                    val age = p.ageOn(d)
                    Text(
                        "Exact age: ${age.format()}  ·  ${age.days} days  ·  ${String.format("%.3f", age.years)} years",
                        fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.primary,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField("Height / length", height, { height = it }, "cm", Modifier.weight(1f), error = errHeight)
                    NumberField("Weight", weight, { weight = it }, "kg", Modifier.weight(1f), error = errWeight)
                }
                if (showErrors && errEmpty != null) Text(errEmpty, color = MaterialTheme.colorScheme.error)
                OutlinedTextField(notes, { notes = it }, label = { Text("Notes (optional)") }, modifier = Modifier.fillMaxWidth())

                // live centile preview
                if (d != null && errDate == null) {
                    val age = p.ageOn(d).months
                    val refId = GrowthReferences.defaultFor(settings.family, age)
                    val ref = GrowthReferences.get(refId)
                    listOf(Measure.HEIGHT to parseNumber(height), Measure.WEIGHT to parseNumber(weight)).forEach { (m, v) ->
                        val a = v?.let { ref.measure(m)?.assess(p.sexEnum, age, it) }
                        if (a != null) Text(
                            "${ref.measure(m)!!.label}: ${ChartBuilder.formatAssessment(a)} · ${ref.shortTitle}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
            Button(onClick = { save(false) }, enabled = loaded && !saving, modifier = w.fillMaxWidth()) { Text("Save measurement") }
            OutlinedButton(onClick = { save(true) }, enabled = loaded && !saving, modifier = w.fillMaxWidth()) { Text("Save and view chart") }
        }
    }

    if (confirmDelete && measurementId != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete this measurement?") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    scope.launch { repo.deleteMeasurement(measurementId); onSaved() }
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}
