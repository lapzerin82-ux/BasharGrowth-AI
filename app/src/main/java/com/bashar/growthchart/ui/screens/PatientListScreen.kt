package com.bashar.growthchart.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import com.bashar.growthchart.ActiveSession
import com.bashar.growthchart.ui.PickMode
import com.bashar.growthchart.ui.components.AppTopBar

@Composable
fun PatientListScreen(
    active: ActiveSession,
    mode: PickMode,
    onBack: () -> Unit,
    onNewPatient: () -> Unit,
    onPicked: (String) -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    val patients by remember(query) { active.repo.observePatients(query) }.collectAsState(initial = null)
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (mode != PickMode.BROWSE) runCatching { focus.requestFocus() } }

    val title = when (mode) {
        PickMode.BROWSE -> "Patient List"
        PickMode.SEARCH -> "Search Patient"
        PickMode.MEASURE -> "Add Measurement: choose patient"
        PickMode.CHART -> "Growth Charts: choose patient"
        PickMode.PDF -> "Export PDF: choose patient"
    }

    Scaffold(
        topBar = { AppTopBar(title, onBack) },
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = onNewPatient, icon = { Icon(Icons.Default.Add, null) }, text = { Text("New patient") })
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 16.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search by name or file number") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                trailingIcon = { if (query.isNotEmpty()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Clear, "Clear") } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).focusRequester(focus),
            )
            val list = patients
            when {
                list == null -> {}
                list.isEmpty() && query.isBlank() -> Text(
                    "No patients yet. Tap \"New patient\" to register the first one.",
                    style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 24.dp),
                )
                list.isEmpty() -> Text("No patient matches \"$query\".", modifier = Modifier.padding(top = 24.dp))
                else -> LazyColumn(Modifier.fillMaxSize()) {
                    items(list, key = { it.id }) { p -> PatientRow(p) { onPicked(p.id) } }
                }
            }
        }
    }
}
