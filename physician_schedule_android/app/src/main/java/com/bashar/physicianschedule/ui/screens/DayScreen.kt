@file:OptIn(ExperimentalMaterial3Api::class)

package com.bashar.physicianschedule.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.bashar.physicianschedule.AppContainer
import com.bashar.physicianschedule.R
import com.bashar.physicianschedule.core.Category
import com.bashar.physicianschedule.core.ConflictDetector
import com.bashar.physicianschedule.core.Occurrence
import com.bashar.physicianschedule.ui.LocalSettings
import com.bashar.physicianschedule.ui.Routes
import com.bashar.physicianschedule.ui.common.DatePatterns
import com.bashar.physicianschedule.ui.common.EmptyState
import com.bashar.physicianschedule.ui.common.EventCard
import com.bashar.physicianschedule.ui.common.appViewModel
import com.bashar.physicianschedule.ui.common.currentLocale
import com.bashar.physicianschedule.ui.common.formatDate
import com.bashar.physicianschedule.ui.common.formatTime
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import java.time.LocalDate

/** A day's events: those starting that day, plus overnight ones continuing from the day before. */
data class DayData(val events: List<Occurrence>, val overlaps: Map<String, List<Occurrence>>)

class DayViewModel(private val c: AppContainer) : ViewModel() {
    val categories: StateFlow<Map<String, Category>> = c.repository.categories.map { l -> l.associateBy { it.id } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    fun day(date: LocalDate): Flow<DayData> = c.repository.observeOccurrences(date.minusDays(1), date).map { occ ->
        val dayStart = date.atStartOfDay()
        val events = occ.filter { it.date == date || it.end > dayStart }
        val overlaps = HashMap<String, MutableList<Occurrence>>()
        ConflictDetector.findConflicts(events).forEach { cf ->
            overlaps.getOrPut(cf.first.key) { mutableListOf() }.add(cf.second)
            overlaps.getOrPut(cf.second.key) { mutableListOf() }.add(cf.first)
        }
        DayData(events, overlaps)
    }
}

@Composable
fun DayScreen(nav: NavController, initialDate: LocalDate) {
    val vm = appViewModel { DayViewModel(it) }
    var date by remember { mutableStateOf(initialDate) }
    val flow = remember(date) { vm.day(date) }
    val data by flow.collectAsStateWithLifecycle(initialValue = null)
    val categories by vm.categories.collectAsStateWithLifecycle()
    val settings = LocalSettings.current
    val locale = currentLocale()

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                title = { Text(formatDate(date, DatePatterns.DAY, locale)) },
                actions = {
                    IconButton(onClick = { date = date.minusDays(1) }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, stringResource(R.string.previous_day)) }
                    IconButton(onClick = { date = date.plusDays(1) }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, stringResource(R.string.next_day)) }
                },
            )
        },
        bottomBar = {
            Button(
                onClick = { nav.navigate(Routes.add(date)) },
                modifier = Modifier.fillMaxWidth().padding(16.dp).height(52.dp),
            ) {
                Icon(Icons.Filled.Add, null)
                Text(stringResource(R.string.add_event), Modifier.padding(start = 8.dp))
            }
        },
    ) { padding ->
        val d = data
        if (d != null && d.events.isEmpty()) {
            EmptyState(Icons.Filled.EventAvailable, stringResource(R.string.no_events), Modifier.padding(padding))
            return@Scaffold
        }
        LazyColumn(
            Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            items(d?.events.orEmpty(), key = { it.key }) { o ->
                // Timeline row: the hour on a rule, then the event card.
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 6.dp)) {
                        val continues = o.date != date
                        Text(
                            if (continues) stringResource(R.string.continues_from_yesterday) else formatTime(o.startTime, settings.use24Hour, locale),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.width(if (continues) 150.dp else 64.dp),
                        )
                        HorizontalDivider(Modifier.weight(1f))
                    }
                    EventCard(
                        o, categories[o.categoryId], settings.use24Hour,
                        onClick = { nav.navigate(Routes.details(o.key)) },
                        conflictWith = d?.overlaps?.get(o.key).orEmpty(),
                    )
                }
            }
        }
    }
}
