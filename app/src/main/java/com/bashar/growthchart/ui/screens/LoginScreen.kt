package com.bashar.growthchart.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.bashar.growthchart.AppContainer
import com.bashar.growthchart.ui.components.ChartIcon
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(container: AppContainer) {
    val scope = rememberCoroutineScope()
    var email by rememberSaveable { mutableStateOf(container.accounts.lastEmail ?: "") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var registering by rememberSaveable { mutableStateOf(false) }
    var showPassword by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var cloudVersion by remember { mutableStateOf(0) }
    var cloudDialog by remember { mutableStateOf(false) }
    val cloud = remember(cloudVersion) { container.cloud.isConfigured }

    fun submit() {
        error = null
        if (registering && password != confirm) { error = "Passwords do not match."; return }
        busy = true
        scope.launch {
            try {
                val s = if (registering) container.accounts.register(email, password) else container.accounts.signIn(email, password)
                container.start(s)
            } catch (e: Exception) {
                error = e.message ?: "Sign-in failed"
            } finally {
                busy = false
            }
        }
    }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            Modifier.systemBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.height(24.dp))
            Icon(ChartIcon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(64.dp))
            Text("Pediatric Growth Chart", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text(
                if (registering) "Create a clinician account" else "Clinician sign-in",
                style = MaterialTheme.typography.titleMedium,
            )
            Column(Modifier.widthIn(max = 480.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = email, onValueChange = { email = it }, label = { Text("Email / username") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = password, onValueChange = { password = it }, label = { Text("Password") }, singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = { TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "Hide" else "Show") } },
                    modifier = Modifier.fillMaxWidth(),
                )
                if (registering) {
                    OutlinedTextField(
                        value = confirm, onValueChange = { confirm = it }, label = { Text("Confirm password") }, singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        supportingText = { Text("At least 8 characters. It also protects your cloud data; keep it safe.") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                Button(onClick = { submit() }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Text(if (registering) "Create account" else "Sign in")
                }
                OutlinedButton(onClick = { registering = !registering; error = null }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                    Text(if (registering) "I already have an account" else "Create account")
                }
            }
            Spacer(Modifier.height(8.dp))
            Icon(Icons.Default.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
            Text(
                if (cloud) "Cloud sync is enabled: your records are end-to-end encrypted and available on every device where you sign in. The app also works offline."
                else "Local mode: records are stored encrypted on this device only. Use Backup/Restore to move them to another device, or configure cloud sync in Settings after signing in.",
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.widthIn(max = 480.dp),
            )
            if (!container.cloud.isBuiltIn) {
                TextButton(onClick = { cloudDialog = true }) { Text(if (cloud) "Change cloud sync setup" else "Set up cloud sync (optional)") }
            }
        }
    }
    if (cloudDialog) {
        CloudSetupDialog(
            onDismiss = { cloudDialog = false },
            onSave = { cfg -> container.cloud.setConfig(cfg); cloudDialog = false; cloudVersion++ },
            canRemove = cloud,
        )
    }
}
