package com.bashar.growthchart.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import com.bashar.growthchart.chart.DATE_FORMAT
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle

private val INPUT_FORMATS = listOf("d/M/uuuu", "d-M-uuuu", "d.M.uuuu").map {
    DateTimeFormatter.ofPattern(it).withResolverStyle(ResolverStyle.STRICT)
}

fun parseDate(text: String): LocalDate? {
    val t = text.trim()
    for (f in INPUT_FORMATS) runCatching { return LocalDate.parse(t, f) }
    return null
}

/** Accepts "121.7" and "121,7". */
fun parseNumber(text: String): Double? = text.trim().replace(',', '.').toDoubleOrNull()

private const val DAY_MS = 86_400_000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    error: String? = null,
    helper: String? = null,
) {
    var showPicker by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = { Text("dd/mm/yyyy") },
        singleLine = true,
        isError = error != null,
        supportingText = (error ?: helper)?.let { { Text(it) } },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Next),
        trailingIcon = {
            IconButton(onClick = { showPicker = true }) { Icon(Icons.Default.DateRange, contentDescription = "Pick date") }
        },
        modifier = modifier.fillMaxWidth(),
    )
    if (showPicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = (parseDate(value) ?: LocalDate.now()).toEpochDay() * DAY_MS,
        )
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onValueChange(LocalDate.ofEpochDay(Math.floorDiv(it, DAY_MS)).format(DATE_FORMAT)) }
                    showPicker = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showPicker = false }) { Text("Cancel") } },
        ) { DatePicker(state = state) }
    }
}

@Composable
fun NumberField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    suffix: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    helper: String? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { v -> if (v.length <= 8 && v.all { it.isDigit() || it == '.' || it == ',' }) onValueChange(v) },
        label = { Text(label) },
        singleLine = true,
        suffix = { Text(suffix) },
        isError = error != null,
        supportingText = (error ?: helper)?.let { { Text(it) } },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Next),
        modifier = modifier.fillMaxWidth(),
    )
}
