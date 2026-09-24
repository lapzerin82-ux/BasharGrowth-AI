package com.bashar.growthchart.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.bashar.growthchart.ActiveSession
import com.bashar.growthchart.AppContainer
import com.bashar.growthchart.SyncState
import com.bashar.growthchart.data.PatientEntity
import com.bashar.growthchart.ui.PickMode
import com.bashar.growthchart.ui.components.AppTopBar
import com.bashar.growthchart.ui.components.ChartIcon
import com.bashar.growthchart.ui.components.DocumentIcon
import java.text.DateFormat
import java.time.LocalDate
import java.util.Date

private data class HomeAction(val label: String, val icon: ImageVector, val onClick: () -> Unit)

@Composable
fun HomeScreen(
    container: AppContainer,
    active: ActiveSession,
    onNewPatient: () -> Unit,
    onPick: (PickMode) -> Unit,
    onOpenPatient: (String) -> Unit,
    onBackup: () -> Unit,
    onRestore: () -> Unit,
    onSettings: () -> Unit,
) {
    val recent by remember(active) { active.repo.observeRecent(6) }.collectAsState(initial = emptyList())
    val count by remember(active) { active.repo.observePatientCount() }.collectAsState(initial = 0)
    val sync by container.syncState.collectAsState()
    var confirmLogout by remember { mutableStateOf(false) }

    val actions = listOf(
        HomeAction("New Patient", Icons.Default.Add, onNewPatient),
        HomeAction("Search Patient", Icons.Default.Search) { onPick(PickMode.SEARCH) },
        HomeAction("Patient List", Icons.AutoMirrored.Filled.List) { onPick(PickMode.BROWSE) },
        HomeAction("Add Measurement", Icons.Default.Edit) { onPick(PickMode.MEASURE) },
        HomeAction("Growth Charts", ChartIcon) { onPick(PickMode.CHART) },
        HomeAction("Export PDF", DocumentIcon) { onPick(PickMode.PDF) },
        HomeAction("Backup", Icons.Default.Lock, onBackup),
        HomeAction("Restore", Icons.Default.Refresh, onRestore),
        HomeAction("Settings", Icons.Default.Settings, onSettings),
        HomeAction("Logout", Icons.AutoMirrored.Filled.ExitToApp) { confirmLogout = true },
    )

    Scaffold(topBar = { AppTopBar("Pediatric Growth Chart") }) { pad ->
        LazyVerticalGrid(
            columns = GridCells.Adaptive(150.dp),
            modifier = Modifier.fillMaxSize().padding(pad),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column {
                    Text("Signed in as ${active.email}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    Text(
                        "$count patient${if (count == 1) "" else "s"} · " + syncText(sync, active),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(actions) { a ->
                Card(
                    modifier = Modifier.fillMaxWidth().height(96.dp).clickable(onClick = a.onClick),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                ) {
                    Column(
                        Modifier.fillMaxSize().padding(8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(a.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
                        Text(a.label, textAlign = TextAlign.Center, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                }
            }
            if (recent.isNotEmpty()) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Text("Recently updated", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
                }
                items(recent, span = { GridItemSpan(maxLineSpan) }) { p -> PatientRow(p) { onOpenPatient(p.id) } }
            }
        }
    }

    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text("Log out?") },
            text = { Text("Your records stay encrypted on this device and will be available when you sign in again.") },
            confirmButton = { TextButton(onClick = { confirmLogout = false; container.logout() }) { Text("Log out") } },
            dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("Cancel") } },
        )
    }
}

fun syncText(s: SyncState, active: ActiveSession): String = when (s) {
    SyncState.LocalOnly -> "stored on this device (local mode)"
    SyncState.Idle -> "cloud sync ready"
    SyncState.Running -> "syncing…"
    is SyncState.Done -> "synced " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(s.at)) +
        if (s.report.undecryptable > 0) " (${s.report.undecryptable} unreadable cloud records)" else ""
    SyncState.Offline -> "offline – changes will sync when connected"
    is SyncState.Error -> "sync problem: ${s.message}"
}

@Composable
fun PatientRow(p: PatientEntity, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.fillMaxWidth().padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(p.name, style = MaterialTheme.typography.titleMedium)
                Text(
                    "File ${p.fileNumber} · ${p.sexEnum.label} · DOB ${p.dob.format(com.bashar.growthchart.chart.DATE_FORMAT)}",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(p.ageOn(LocalDate.now()).formatShort(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
        }
        HorizontalDivider()
    }
}
