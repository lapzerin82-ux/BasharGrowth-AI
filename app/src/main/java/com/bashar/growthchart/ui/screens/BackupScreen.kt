package com.bashar.growthchart.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.bashar.growthchart.ActiveSession
import com.bashar.growthchart.AppContainer
import com.bashar.growthchart.backup.BackupManager
import com.bashar.growthchart.core.backup.BackupCodec
import com.bashar.growthchart.core.model.BackupContents
import com.bashar.growthchart.ui.components.AppTopBar
import com.bashar.growthchart.ui.components.SectionCard
import com.bashar.growthchart.ui.components.textSlot
import com.bashar.growthchart.ui.components.exportDir
import com.bashar.growthchart.ui.components.shareFile
import kotlinx.coroutines.launch
import java.io.File
import java.text.DateFormat
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Date

@Composable
fun BackupScreen(container: AppContainer, active: ActiveSession, restoreFirst: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pw by remember { mutableStateOf("") }
    var pw2 by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var pendingBytes by remember { mutableStateOf<ByteArray?>(null) }

    // restore state
    var restoreBytes by remember { mutableStateOf<ByteArray?>(null) }
    var restorePw by remember { mutableStateOf("") }
    var decoded by remember { mutableStateOf<BackupContents?>(null) }
    var replace by remember { mutableStateOf(false) }
    var restoreError by remember { mutableStateOf<String?>(null) }

    val fileName = "GrowthChart_backup_${LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmm"))}.${BackupManager.EXTENSION}"
    val pwError = when {
        pw.isEmpty() -> null
        pw.length < 8 -> "At least 8 characters"
        pw2.isNotEmpty() && pw != pw2 -> "Passwords do not match"
        else -> null
    }
    val pwOk = pw.length >= 8 && pw == pw2

    val saveLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(BackupManager.MIME)) { uri: Uri? ->
        val bytes = pendingBytes
        if (uri != null && bytes != null) scope.launch {
            message = runCatching { BackupManager.writeTo(context, uri, bytes) }
                .fold({ "Backup saved (${bytes.size / 1024 + 1} KB)." }, { "Could not save: ${it.message}" })
        }
        pendingBytes = null
    }
    val openLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) scope.launch {
            restoreError = null
            restoreBytes = runCatching { BackupManager.read(context, uri) }.getOrElse { restoreError = "Cannot read file: ${it.message}"; null }
            restorePw = ""
            decoded = null
        }
    }

    suspend fun build(): ByteArray? {
        busy = true
        return try {
            BackupManager.createBytes(active.repo, active.email, pw.toCharArray()).first
        } catch (e: Exception) {
            message = "Backup failed: ${e.message}"; null
        } finally { busy = false }
    }

    Scaffold(topBar = { AppTopBar(if (restoreFirst) "Restore" else "Backup", onBack) }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val w = Modifier.widthIn(max = 640.dp)
            val backupCard: @Composable () -> Unit = {
                SectionCard("Back up all patients", w) {
                    Text("Creates one encrypted file (AES-256) with every patient, measurement and note. Choose a backup password — it is needed to restore the file on any device and cannot be recovered.")
                    OutlinedTextField(pw, { pw = it }, label = { Text("Backup password") }, singleLine = true,
                        visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        isError = pwError != null, supportingText = textSlot(pwError), modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(pw2, { pw2 = it }, label = { Text("Repeat password") }, singleLine = true,
                        visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(enabled = pwOk && !busy, onClick = {
                            scope.launch { build()?.let { pendingBytes = it; saveLauncher.launch(fileName) } }
                        }) { Text("Save to device") }
                        OutlinedButton(enabled = pwOk && !busy, onClick = {
                            scope.launch {
                                build()?.let { bytes ->
                                    val f = File(exportDir(context), fileName)
                                    BackupManager.writeTo(f, bytes)
                                    shareFile(context, f, BackupManager.MIME, "Growth chart backup")
                                }
                            }
                        }) { Text("Share…") }
                    }
                    if (busy) CircularProgressIndicator(Modifier.size(24.dp))
                    Text(
                        "Tip: share the file to your e-mail, Google Drive or another phone, then open Restore on the other device.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            val restoreCard: @Composable () -> Unit = {
                SectionCard("Restore from a backup file", w) {
                    Text("Select a .${BackupManager.EXTENSION} file created by this app (on this or another device).")
                    Button(onClick = { openLauncher.launch(arrayOf("*/*")) }) { Text("Choose backup file") }
                    restoreError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    if (restoreBytes != null && decoded == null) {
                        OutlinedTextField(restorePw, { restorePw = it }, label = { Text("Backup password") }, singleLine = true,
                            visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
                        Button(enabled = restorePw.isNotEmpty() && !busy, onClick = {
                            scope.launch {
                                busy = true
                                try {
                                    decoded = BackupManager.decode(restoreBytes!!, restorePw.toCharArray())
                                    restoreError = null
                                } catch (e: BackupCodec.WrongPasswordException) {
                                    restoreError = "Incorrect password (or the file is damaged)."
                                } catch (e: Exception) {
                                    restoreError = e.message ?: "Invalid backup file"
                                } finally { busy = false }
                            }
                        }) { Text("Unlock backup") }
                    }
                    decoded?.let { d ->
                        Text(
                            "Backup of ${d.account ?: "unknown account"}, created ${DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(d.createdAt))}: " +
                                "${d.patients.size} patients, ${d.measurements.size} measurements.",
                        )
                        Row(Modifier.fillMaxWidth().selectable(selected = !replace, onClick = { replace = false }), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = !replace, onClick = { replace = false })
                            Text("Merge: add these records, keep existing ones (newest edit wins)")
                        }
                        Row(Modifier.fillMaxWidth().selectable(selected = replace, onClick = { replace = true }), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = replace, onClick = { replace = true })
                            Text("Replace: make this device identical to the backup (other records are deleted)")
                        }
                        Button(enabled = !busy, onClick = {
                            scope.launch {
                                busy = true
                                val r = BackupManager.restore(active.repo, d, replace)
                                busy = false
                                message = "Restored ${r.patients} patients and ${r.measurements} measurements" +
                                    (if (r.skipped > 0) " (${r.skipped} older copies skipped)." else ".")
                                decoded = null; restoreBytes = null; restorePw = ""
                            }
                        }) { Text("Restore now") }
                    }
                }
            }
            if (restoreFirst) { restoreCard(); backupCard() } else { backupCard(); restoreCard() }
        }
    }

    message?.let {
        AlertDialog(
            onDismissRequest = { message = null },
            text = { Text(it) },
            confirmButton = { TextButton(onClick = { message = null }) { Text("OK") } },
        )
    }
}
