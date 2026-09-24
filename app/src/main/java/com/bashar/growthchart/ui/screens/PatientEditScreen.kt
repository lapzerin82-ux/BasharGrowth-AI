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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.bashar.growthchart.chart.DATE_FORMAT
import com.bashar.growthchart.chart.GrowthChartRenderer
import com.bashar.growthchart.core.growth.AgeCalculator
import com.bashar.growthchart.core.growth.MidParentalHeight
import com.bashar.growthchart.core.growth.Sex
import com.bashar.growthchart.data.PatientEntity
import com.bashar.growthchart.ui.components.AppTopBar
import com.bashar.growthchart.ui.components.DateField
import com.bashar.growthchart.ui.components.NumberField
import com.bashar.growthchart.ui.components.SectionCard
import com.bashar.growthchart.ui.components.parseDate
import com.bashar.growthchart.ui.components.parseNumber
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate

internal fun rangeError(text: String, min: Double, max: Double, unit: String): String? {
    if (text.isBlank()) return null
    val v = parseNumber(text) ?: return "Not a number"
    return if (v < min || v > max) "Expected ${GrowthChartRenderer.fmt(min)}–${GrowthChartRenderer.fmt(max)} $unit" else null
}

@Composable
fun PatientEditScreen(
    active: ActiveSession,
    patientId: String?,
    onBack: () -> Unit,
    onSaved: (String) -> Unit,
    onOpenExisting: (String) -> Unit,
) {
    val repo = active.repo
    val scope = rememberCoroutineScope()
    val isNew = patientId == null

    var loaded by rememberSaveable { mutableStateOf(isNew) }
    var name by rememberSaveable { mutableStateOf("") }
    var sex by rememberSaveable { mutableStateOf<String?>(null) }
    var fileNo by rememberSaveable { mutableStateOf("") }
    var dob by rememberSaveable { mutableStateOf("") }
    var father by rememberSaveable { mutableStateOf("") }
    var mother by rememberSaveable { mutableStateOf("") }
    var mphManual by rememberSaveable { mutableStateOf(false) }
    var mphText by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    // first measurement (new patients only)
    var mDate by rememberSaveable { mutableStateOf(LocalDate.now().format(DATE_FORMAT)) }
    var height by rememberSaveable { mutableStateOf("") }
    var weight by rememberSaveable { mutableStateOf("") }

    var showErrors by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var duplicate by remember { mutableStateOf<PatientEntity?>(null) }

    LaunchedEffect(patientId) {
        if (!loaded && patientId != null) {
            repo.patient(patientId)?.let { p ->
                name = p.name; sex = p.sex; fileNo = p.fileNumber; dob = p.dob.format(DATE_FORMAT)
                father = p.fatherHeightCm?.let { GrowthChartRenderer.fmt2(it) } ?: ""
                mother = p.motherHeightCm?.let { GrowthChartRenderer.fmt2(it) } ?: ""
                mphManual = p.mphManual
                mphText = if (p.mphManual) p.mphCm?.let { GrowthChartRenderer.fmt2(it) } ?: "" else ""
                notes = p.notes
            }
            loaded = true
        }
    }
    LaunchedEffect(fileNo) {
        delay(300)
        duplicate = repo.findByFileNumber(fileNo)?.takeIf { it.id != patientId }
    }

    val today = LocalDate.now()
    val dobDate = parseDate(dob)
    val mDateParsed = parseDate(mDate)
    val sexEnum = sex?.let { Sex.fromCode(it) }
    val fatherCm = parseNumber(father)
    val motherCm = parseNumber(mother)
    val computedMph = if (sexEnum != null && fatherCm != null && motherCm != null && rangeError(father, 120.0, 230.0, "cm") == null && rangeError(mother, 110.0, 220.0, "cm") == null)
        MidParentalHeight.calculate(sexEnum, fatherCm, motherCm) else null
    val mph = if (mphManual) parseNumber(mphText) else computedMph

    val errName = if (name.isBlank()) "Required" else null
    val errSex = if (sex == null) "Select sex" else null
    val errFile = if (fileNo.isBlank()) "Required" else null
    val errDob = when {
        dob.isBlank() -> "Required"
        dobDate == null -> "Use dd/mm/yyyy"
        dobDate.isAfter(today) -> "Date of birth is in the future"
        dobDate.isBefore(today.minusYears(21)) -> "Charts cover birth to 20 years"
        else -> null
    }
    val errMDate = if (!isNew || (height.isBlank() && weight.isBlank())) null else when {
        mDateParsed == null -> "Use dd/mm/yyyy"
        dobDate != null && mDateParsed.isBefore(dobDate) -> "Before date of birth"
        mDateParsed.isAfter(today) -> "In the future"
        else -> null
    }
    val errHeight = rangeError(height, 30.0, 230.0, "cm")
    val errWeight = rangeError(weight, 0.3, 250.0, "kg")
    val errFather = rangeError(father, 120.0, 230.0, "cm")
    val errMother = rangeError(mother, 110.0, 220.0, "cm")
    val errMph = if (mphManual) rangeError(mphText, 130.0, 210.0, "cm") ?: if (mphText.isBlank()) "Enter MPH or switch off manual entry" else null else null
    val valid = listOf(errName, errSex, errFile, errDob, errMDate, errHeight, errWeight, errFather, errMother, errMph).all { it == null }

    fun save() {
        showErrors = true
        if (!valid || saving) return
        saving = true
        scope.launch {
            val id = repo.savePatient(
                id = patientId,
                name = name,
                sex = sex!!,
                fileNumber = fileNo,
                dobEpochDay = dobDate!!.toEpochDay(),
                fatherHeightCm = fatherCm,
                motherHeightCm = motherCm,
                mphCm = mph,
                mphManual = mphManual,
                notes = notes,
            )
            if (isNew && (height.isNotBlank() || weight.isNotBlank())) {
                repo.saveMeasurement(null, id, mDateParsed!!.toEpochDay(), parseNumber(height), parseNumber(weight), "")
            }
            saving = false
            onSaved(id)
        }
    }

    fun err(e: String?) = if (showErrors) e else null

    Scaffold(topBar = { AppTopBar(if (isNew) "New Patient" else "Edit Patient", onBack) }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val w = Modifier.widthIn(max = 640.dp)
            SectionCard("Patient", w) {
                OutlinedTextField(name, { name = it }, label = { Text("Patient name") }, singleLine = true, isError = err(errName) != null,
                    supportingText = err(errName)?.let { { Text(it) } }, modifier = Modifier.fillMaxWidth())
                Text("Sex", style = MaterialTheme.typography.labelLarge)
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    Sex.entries.forEachIndexed { i, s ->
                        SegmentedButton(
                            selected = sex == s.code, onClick = { sex = s.code },
                            shape = SegmentedButtonDefaults.itemShape(i, Sex.entries.size),
                        ) { Text(s.label) }
                    }
                }
                err(errSex)?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                OutlinedTextField(fileNo, { fileNo = it }, label = { Text("File / medical record number") }, singleLine = true,
                    isError = err(errFile) != null, supportingText = err(errFile)?.let { { Text(it) } }, modifier = Modifier.fillMaxWidth())
                duplicate?.let { d ->
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("File ${d.fileNumber} already belongs to ${d.name} (DOB ${d.dob.format(DATE_FORMAT)}).", Modifier.weight(1f),
                                style = MaterialTheme.typography.bodyMedium)
                            TextButton(onClick = { onOpenExisting(d.id) }) { Text("Open") }
                        }
                    }
                }
                DateField("Date of birth", dob, { dob = it }, error = err(errDob) ?: if (dob.isNotBlank() && errDob != null) errDob else null)
                if (dobDate != null && errDob == null) {
                    Text("Age today: ${AgeCalculator.exactAge(dobDate, today).format()}", style = MaterialTheme.typography.bodySmall)
                }
            }

            if (isNew) {
                SectionCard("First measurement", w) {
                    DateField("Measurement date", mDate, { mDate = it }, error = err(errMDate) ?: if (mDate.isNotBlank() && mDateParsed == null) "Use dd/mm/yyyy" else null)
                    if (dobDate != null && mDateParsed != null && !mDateParsed.isBefore(dobDate)) {
                        val age = AgeCalculator.exactAge(dobDate, mDateParsed)
                        Text(
                            "Exact age at measurement: ${age.format()} (${String.format("%.3f", age.years)} years)",
                            style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NumberField("Height / length", height, { height = it }, "cm", Modifier.weight(1f), error = errHeight)
                        NumberField("Weight", weight, { weight = it }, "kg", Modifier.weight(1f), error = errWeight)
                    }
                    Text("Leave both empty to register the patient without a measurement.", style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            SectionCard("Mid-parental height", w) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField("Father's height", father, { father = it }, "cm", Modifier.weight(1f), error = errFather)
                    NumberField("Mother's height", mother, { mother = it }, "cm", Modifier.weight(1f), error = errMother)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Enter MPH manually", Modifier.weight(1f))
                    Switch(checked = mphManual, onCheckedChange = { mphManual = it })
                }
                if (mphManual) {
                    NumberField("Mid-parental height", mphText, { mphText = it }, "cm", error = err(errMph))
                }
                if (mph != null) {
                    val r = MidParentalHeight.targetRange(mph)
                    Text(
                        "MPH ${GrowthChartRenderer.fmt(mph)} cm · target range ${GrowthChartRenderer.fmt(r.start)}–${GrowthChartRenderer.fmt(r.endInclusive)} cm",
                        fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.primary,
                    )
                }
                Text(
                    "Boys: (father + mother + 13) / 2 · Girls: (father + mother − 13) / 2 · target range ± 8.5 cm (≈ ±2 SD).",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SectionCard("Notes", w) {
                OutlinedTextField(notes, { notes = it }, label = { Text("Clinical notes") }, minLines = 3, modifier = Modifier.fillMaxWidth())
            }

            if (showErrors && !valid) Text("Please correct the highlighted fields.", color = MaterialTheme.colorScheme.error)
            Button(onClick = { save() }, enabled = loaded && !saving, modifier = w.fillMaxWidth()) {
                Text(if (isNew) "Save patient" else "Save changes")
            }
        }
    }
}
