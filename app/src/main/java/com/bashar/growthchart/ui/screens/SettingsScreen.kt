package com.bashar.growthchart.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bashar.growthchart.ActiveSession
import com.bashar.growthchart.AppContainer
import com.bashar.growthchart.BuildConfig
import com.bashar.growthchart.core.growth.GrowthReferences
import com.bashar.growthchart.sync.CloudService
import com.bashar.growthchart.ui.components.AppTopBar
import com.bashar.growthchart.ui.components.SectionCard
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(container: AppContainer, active: ActiveSession, onBack: () -> Unit) {
    val settings by container.settings.values.collectAsState()
    val sync by container.syncState.collectAsState()
    val scope = rememberCoroutineScope()
    var cloudDialog by remember { mutableStateOf(false) }
    var cloudVersion by remember { mutableStateOf(0) }

    Scaffold(topBar = { AppTopBar("Settings", onBack) }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val w = Modifier.widthIn(max = 720.dp)
            SectionCard("Default growth reference", w) {
                GrowthReferences.Family.entries.forEach { f ->
                    Row(
                        Modifier.fillMaxWidth().selectable(selected = settings.family == f, onClick = { container.settings.setFamily(f) }),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = settings.family == f, onClick = { container.settings.setFamily(f) })
                        Text(f.label)
                    }
                }
                Text(
                    "Used to choose the chart automatically from the child's age and to calculate centiles. Any chart can still be selected on the chart screen.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SectionCard("Display & privacy", w) {
                ToggleRow("Connect measurements with a line (trajectory)", settings.connectLines) { container.settings.setConnectLines(it) }
                ToggleRow("Block screenshots and hide app content in recent apps", settings.secureScreen) { container.settings.setSecureScreen(it) }
            }

            SectionCard("Account & cloud sync", w) {
                key(cloudVersion) {
                    Text("Signed in as ${active.email}", fontWeight = FontWeight.Medium)
                    Text("Status: " + syncText(sync, active))
                    val configured = container.cloud.isConfigured
                    Text(
                        when {
                            !configured -> "Cloud sync is not configured. Records are stored only on this device (encrypted). Use Backup/Restore to move them, or set up a free Firebase project to sync between your devices."
                            active.sync == null -> "Cloud is configured. Log out and sign in again while online to connect this account to the cloud."
                            else -> "Records are end-to-end encrypted with a key protected by your password before upload."
                        },
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (active.sync != null) Button(onClick = { scope.launch { container.syncNow() } }) { Text("Sync now") }
                        if (!container.cloud.isBuiltIn) OutlinedButton(onClick = { cloudDialog = true }) { Text(if (configured) "Change cloud setup" else "Set up cloud sync") }
                    }
                }
            }

            SectionCard("Growth references (bundled, offline)", w) {
                GrowthReferences.all().forEachIndexed { i, r ->
                    if (i > 0) HorizontalDivider()
                    Text(r.title, fontWeight = FontWeight.SemiBold)
                    Text("Version: ${r.version}", style = MaterialTheme.typography.bodySmall)
                    Text("Centiles: ${r.centiles.joinToString(", ") { it.toInt().toString() }}", style = MaterialTheme.typography.bodySmall)
                    Text("Source: ${r.source}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    "Curves are generated from the official LMS parameters (Cole's LMS method); patient points are placed at the exact age computed from date of birth and measurement date.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            SectionCard("About", w) {
                Text("Pediatric Growth Chart ${BuildConfig.VERSION_NAME}")
                Text(
                    "Clinical decision support only. Verify measurements and interpret results in the clinical context.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }

    if (cloudDialog) {
        CloudSetupDialog(
            onDismiss = { cloudDialog = false },
            onSave = { cfg ->
                container.cloud.setConfig(cfg)
                cloudDialog = false
                cloudVersion++
            },
            canRemove = container.cloud.isConfigured,
        )
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
fun CloudSetupDialog(onDismiss: () -> Unit, onSave: (com.bashar.growthchart.sync.CloudConfig?) -> Unit, canRemove: Boolean) {
    val context = LocalContext.current
    var text by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Cloud sync setup") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    "Paste the content of google-services.json from your Firebase project (Authentication: Email/Password enabled; Cloud Firestore created with the rules from the README). Use the same file on every device.",
                    style = MaterialTheme.typography.bodySmall,
                )
                OutlinedTextField(
                    value = text, onValueChange = { text = it; error = null },
                    label = { Text("google-services.json") },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (canRemove) TextButton(onClick = { onSave(null) }) { Text("Remove cloud configuration") }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                runCatching { CloudService.parseGoogleServicesJson(text, context.packageName.removeSuffix(".debug")) }
                    .onSuccess { onSave(it) }
                    .onFailure { error = "This does not look like a valid google-services.json file." }
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
