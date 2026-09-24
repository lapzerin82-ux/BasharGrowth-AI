package com.bashar.growthchart.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.bashar.growthchart.chart.ChartPoint
import com.bashar.growthchart.chart.GrowthChartRenderer
import com.bashar.growthchart.chart.InteractiveChart
import com.bashar.growthchart.core.chart.ChartMath
import com.bashar.growthchart.core.growth.GrowthReferences
import com.bashar.growthchart.core.growth.Measure
import com.bashar.growthchart.ui.components.AppTopBar
import kotlinx.coroutines.launch

@Composable
fun ChartScreen(
    container: AppContainer,
    active: ActiveSession,
    patientId: String,
    initialMeasure: Measure,
    onBack: () -> Unit,
    onAddMeasurement: (String) -> Unit,
) {
    val patient by remember(patientId) { active.repo.observePatient(patientId) }.collectAsState(initial = null)
    val measurements by remember(patientId) { active.repo.observeMeasurements(patientId) }.collectAsState(initial = null)
    val settings by container.settings.values.collectAsState()
    val scope = rememberCoroutineScope()

    var measure by rememberSaveable { mutableStateOf(initialMeasure) }
    var chosenRef by rememberSaveable { mutableStateOf<String?>(null) }
    var connect by rememberSaveable { mutableStateOf(settings.connectLines) }
    var menuOpen by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<ChartPoint?>(null) }

    val p = patient
    val ms = measurements

    Scaffold(
        topBar = {
            AppTopBar(p?.let { "${it.name} · growth chart" } ?: "Growth chart", onBack) {
                IconButton(onClick = { onAddMeasurement(patientId) }) { Icon(Icons.Default.Add, "Add measurement") }
            }
        },
    ) { pad ->
        if (p == null || ms == null) return@Scaffold
        val refId = chosenRef
            ?: p.preferredReference?.takeIf { it in GrowthReferences.ids }
            ?: ChartBuilder.defaultReference(p, ms, settings.family)
        val built = remember(p, ms, refId, measure, connect) { ChartBuilder.build(p, ms, refId, measure, connect) }
        if (built == null) return@Scaffold
        val bounds = remember(built) { ChartMath.fullBounds(built.data.measure, built.data.sex, built.data.points.map { it.value }) }
        var viewport by remember(bounds) { mutableStateOf(bounds) }

        Column(Modifier.fillMaxSize().padding(pad)) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf(Measure.HEIGHT to "Height-for-age", Measure.WEIGHT to "Weight-for-age").forEachIndexed { i, (m, label) ->
                        SegmentedButton(
                            selected = measure == m,
                            onClick = { measure = m; selected = null },
                            shape = SegmentedButtonDefaults.itemShape(i, 2),
                        ) { Text(label) }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box {
                        OutlinedButton(onClick = { menuOpen = true }) {
                            Text(GrowthReferences.get(refId).shortTitle)
                            Icon(Icons.Default.ArrowDropDown, null)
                        }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            GrowthReferences.all().forEach { r ->
                                DropdownMenuItem(
                                    text = { Text(r.title) },
                                    onClick = {
                                        menuOpen = false
                                        selected = null
                                        chosenRef = r.id
                                        scope.launch { active.repo.setPreferredReference(patientId, r.id) }
                                    },
                                )
                            }
                        }
                    }
                    Text("Line", style = MaterialTheme.typography.bodySmall)
                    Switch(checked = connect, onCheckedChange = { connect = it })
                    Box(Modifier.weight(1f))
                    FilledTonalIconButton(onClick = { viewport = viewport.zoom(1.6, (viewport.xMin + viewport.xMax) / 2, (viewport.yMin + viewport.yMax) / 2, bounds) }) { Text("+", fontWeight = FontWeight.Bold) }
                    FilledTonalIconButton(onClick = { viewport = viewport.zoom(1 / 1.6, (viewport.xMin + viewport.xMax) / 2, (viewport.yMin + viewport.yMax) / 2, bounds) }) { Text("−", fontWeight = FontWeight.Bold) }
                    FilledTonalIconButton(onClick = { viewport = bounds }) { Icon(Icons.Default.Refresh, "Reset zoom") }
                }
                if (built.outsideRange > 0) {
                    Text(
                        "${built.outsideRange} measurement(s) fall outside this chart's age range (${GrowthChartRenderer.fmt(built.data.measure.ageMin / 12)}–${GrowthChartRenderer.fmt(built.data.measure.ageMax / 12)} y). Select another chart to see them.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error,
                    )
                }
            }

            InteractiveChart(
                data = built.data,
                bounds = bounds,
                viewport = viewport,
                onViewportChange = { viewport = it },
                onPointTapped = { selected = it },
                modifier = Modifier.fillMaxWidth().weight(1f),
            )

            val sel = selected?.let { s -> built.data.points.firstOrNull { it.measurementId == s.measurementId } }
            if (sel != null) {
                val assessment = built.data.measure.assess(built.data.sex, sel.ageMonths, sel.value)
                val note = ms.firstOrNull { it.id == sel.measurementId }?.notes.orEmpty()
                Card(
                    Modifier.fillMaxWidth().padding(8.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                ) {
                    Row(Modifier.padding(12.dp)) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                (if (sel.latest) "Latest measurement · " else "") + sel.dateText,
                                fontWeight = FontWeight.Bold,
                            )
                            Text("Age ${sel.ageText} (${String.format("%.3f", sel.ageMonths / 12)} y)")
                            Text(
                                "${built.data.measure.label}: ${GrowthChartRenderer.fmt2(sel.value)} ${built.data.measure.unit}" +
                                    (assessment?.let { " · " + ChartBuilder.formatAssessment(it) } ?: ""),
                                fontWeight = FontWeight.Medium,
                            )
                            Text(built.data.reference.shortTitle + " · " + built.data.reference.version, style = MaterialTheme.typography.bodySmall)
                            if (note.isNotBlank()) Text(note, style = MaterialTheme.typography.bodySmall)
                        }
                        IconButton(onClick = { selected = null }) { Icon(Icons.Default.Close, "Close") }
                    }
                }
            } else {
                Text(
                    "Pinch to zoom · drag to pan · double-tap to reset · tap a red × for details",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(8.dp).widthIn(max = 640.dp),
                )
            }
        }
    }
}
