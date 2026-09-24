package com.bashar.growthchart.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.materialIcon
import androidx.compose.material.icons.materialPath
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(title: String, onBack: (() -> Unit)? = null, actions: @Composable () -> Unit = {}) {
    TopAppBar(
        title = { Text(title, maxLines = 1) },
        navigationIcon = {
            if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
        },
        actions = { actions() },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.primary,
            titleContentColor = MaterialTheme.colorScheme.onPrimary,
            navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
            actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    )
}

@Composable
fun SectionCard(title: String? = null, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (title != null) Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}

@Composable
fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(130.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
    }
}

/** Material "show_chart" glyph (not part of material-icons-core). */
val ChartIcon: ImageVector by lazy {
    materialIcon(name = "Filled.ShowChart") {
        materialPath {
            moveTo(3.5f, 18.49f); lineTo(9.5f, 12.48f); lineTo(13.5f, 16.48f); lineTo(22f, 6.92f)
            lineTo(20.59f, 5.51f); lineTo(13.5f, 13.48f); lineTo(9.5f, 9.48f); lineTo(2f, 16.99f); close()
        }
    }
}

/** Simple document glyph used for PDF export. */
val DocumentIcon: ImageVector by lazy {
    materialIcon(name = "Filled.Document") {
        materialPath(pathFillType = PathFillType.EvenOdd) {
            moveTo(14f, 2f); lineTo(6f, 2f); curveTo(4.9f, 2f, 4f, 2.9f, 4f, 4f); lineTo(4f, 20f)
            curveTo(4f, 21.1f, 4.9f, 22f, 6f, 22f); lineTo(18f, 22f); curveTo(19.1f, 22f, 20f, 21.1f, 20f, 20f)
            lineTo(20f, 8f); close()
            moveTo(16f, 18f); lineTo(8f, 18f); lineTo(8f, 16f); lineTo(16f, 16f); close()
            moveTo(16f, 14f); lineTo(8f, 14f); lineTo(8f, 12f); lineTo(16f, 12f); close()
            moveTo(13f, 9f); lineTo(13f, 3.5f); lineTo(18.5f, 9f); close()
        }
    }
}
