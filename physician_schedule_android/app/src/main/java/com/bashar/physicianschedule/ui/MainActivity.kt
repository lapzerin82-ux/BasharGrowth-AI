package com.bashar.physicianschedule.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bashar.physicianschedule.AppContainer
import com.bashar.physicianschedule.R
import com.bashar.physicianschedule.container
import com.bashar.physicianschedule.data.AppSettings
import com.bashar.physicianschedule.notify.ReminderScheduler
import com.bashar.physicianschedule.ui.common.appViewModel
import com.bashar.physicianschedule.ui.screens.BackupScreen
import com.bashar.physicianschedule.ui.screens.CalendarScreen
import com.bashar.physicianschedule.ui.screens.ConflictsScreen
import com.bashar.physicianschedule.ui.screens.DayScreen
import com.bashar.physicianschedule.ui.screens.EventDetailsScreen
import com.bashar.physicianschedule.ui.screens.EventFormScreen
import com.bashar.physicianschedule.ui.screens.SearchScreen
import com.bashar.physicianschedule.ui.screens.SeriesScreen
import com.bashar.physicianschedule.ui.screens.SettingsScreen
import com.bashar.physicianschedule.ui.screens.SummaryScreen
import com.bashar.physicianschedule.ui.screens.UpcomingScreen
import com.bashar.physicianschedule.ui.theme.PhysicianTheme
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import java.time.LocalDate
import java.time.YearMonth

class MainActivity : AppCompatActivity() {
    private val pendingKey = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        pendingKey.value = intent?.getStringExtra(ReminderScheduler.EXTRA_KEY)
        setContent {
            val settings by container.settings.settings.collectAsStateWithLifecycle()
            PhysicianTheme(settings.theme) {
                AppRoot(settings, pendingKey.value) { pendingKey.value = null }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(ReminderScheduler.EXTRA_KEY)?.let { pendingKey.value = it }
    }
}

/** App-wide settings and a snackbar every screen can post to. */
val LocalSettings = staticCompositionLocalOf { AppSettings() }
val LocalSnackbar = staticCompositionLocalOf { SnackbarHostState() }

object Routes {
    const val CALENDAR = "calendar"
    const val UPCOMING = "upcoming"
    const val CONFLICTS = "conflicts"
    const val SETTINGS = "settings"
    const val SEARCH = "search"
    const val SERIES = "series"
    const val BACKUP = "backup"

    fun add(date: LocalDate? = null, duplicateOf: String? = null) = buildString {
        append("add")
        val q = listOfNotNull(date?.let { "date=$it" }, duplicateOf?.let { "dup=" + Uri.encode(it) })
        if (q.isNotEmpty()) append("?").append(q.joinToString("&"))
    }
    fun edit(key: String) = "edit?key=" + Uri.encode(key)
    fun details(key: String) = "details?key=" + Uri.encode(key)
    fun day(date: LocalDate) = "day?date=$date"
    fun summary(month: YearMonth) = "summary?month=$month"
}

class RootViewModel(c: AppContainer) : ViewModel() {
    /** Unresolved conflicts from the start of this month through the next 12 months. */
    val conflictCount: StateFlow<Int> = LocalDate.now().withDayOfMonth(1).let { start ->
        c.repository.observeConflicts(start, start.plusMonths(12)).map { it.size }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)
}

@Composable
fun AppRoot(settings: AppSettings, pendingKey: String?, onPendingHandled: () -> Unit) {
    val nav = rememberNavController()
    val snackbar = remember { SnackbarHostState() }
    val root = appViewModel { RootViewModel(it) }
    val conflicts by root.conflictCount.collectAsStateWithLifecycle()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route?.substringBefore("?")

    LaunchedEffect(pendingKey) {
        if (pendingKey != null) {
            nav.navigate(Routes.details(pendingKey))
            onPendingHandled()
        }
    }

    CompositionLocalProvider(LocalSettings provides settings, LocalSnackbar provides snackbar) {
        Scaffold(
            // Screens draw their own top bars; only the bottom bar's space is reserved here.
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                if (route in setOf(Routes.CALENDAR, Routes.UPCOMING, Routes.CONFLICTS, Routes.SETTINGS)) {
                    BottomBar(nav, route, conflicts)
                }
            },
        ) { padding ->
            NavHost(nav, startDestination = Routes.CALENDAR, modifier = Modifier.padding(padding).consumeWindowInsets(padding)) {
                composable(Routes.CALENDAR) { CalendarScreen(nav, conflicts) }
                composable(Routes.UPCOMING) { UpcomingScreen(nav) }
                composable(Routes.CONFLICTS) { ConflictsScreen(nav) }
                composable(Routes.SETTINGS) { SettingsScreen(nav) }
                composable(Routes.SEARCH) { SearchScreen(nav) }
                composable(Routes.SERIES) { SeriesScreen(nav) }
                composable(Routes.BACKUP) { BackupScreen(nav) }
                composable(
                    "add?date={date}&dup={dup}",
                    arguments = listOf(optionalArg("date"), optionalArg("dup")),
                ) { e ->
                    EventFormScreen(nav, editKey = null, initialDate = e.arguments?.getString("date")?.let(LocalDate::parse), duplicateOf = e.arguments?.getString("dup"))
                }
                composable("edit?key={key}", arguments = listOf(optionalArg("key"))) { e ->
                    EventFormScreen(nav, editKey = e.arguments?.getString("key"), initialDate = null, duplicateOf = null)
                }
                composable("details?key={key}", arguments = listOf(optionalArg("key"))) { e ->
                    EventDetailsScreen(nav, e.arguments?.getString("key").orEmpty())
                }
                composable("day?date={date}", arguments = listOf(optionalArg("date"))) { e ->
                    DayScreen(nav, e.arguments?.getString("date")?.let(LocalDate::parse) ?: LocalDate.now())
                }
                composable("summary?month={month}", arguments = listOf(optionalArg("month"))) { e ->
                    SummaryScreen(nav, e.arguments?.getString("month")?.let(YearMonth::parse) ?: YearMonth.now())
                }
            }
        }
    }
}

private fun optionalArg(name: String) = navArgument(name) { type = NavType.StringType; nullable = true; defaultValue = null }

@Composable
private fun BottomBar(nav: NavHostController, route: String?, conflicts: Int) {
    fun go(target: String) {
        nav.navigate(target) {
            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }
    NavigationBar {
        NavigationBarItem(
            selected = route == Routes.CALENDAR, onClick = { go(Routes.CALENDAR) },
            icon = {
                BadgedBox(badge = { if (conflicts > 0) Badge() }) { Icon(Icons.Filled.CalendarMonth, null) }
            },
            label = { Text(stringResource(R.string.nav_calendar)) },
        )
        NavigationBarItem(
            selected = route == Routes.UPCOMING, onClick = { go(Routes.UPCOMING) },
            icon = { Icon(Icons.AutoMirrored.Filled.ViewList, null) },
            label = { Text(stringResource(R.string.nav_upcoming)) },
        )
        NavigationBarItem(
            selected = false, onClick = { nav.navigate(Routes.add()) },
            icon = { Icon(Icons.Filled.AddCircle, null) },
            label = { Text(stringResource(R.string.nav_add)) },
        )
        NavigationBarItem(
            selected = route == Routes.CONFLICTS, onClick = { go(Routes.CONFLICTS) },
            icon = {
                BadgedBox(badge = { if (conflicts > 0) Badge { Text(conflicts.coerceAtMost(99).toString()) } }) { Icon(Icons.Filled.Warning, null) }
            },
            label = { Text(stringResource(R.string.nav_conflicts)) },
        )
        NavigationBarItem(
            selected = route == Routes.SETTINGS, onClick = { go(Routes.SETTINGS) },
            icon = { Icon(Icons.Filled.Settings, null) },
            label = { Text(stringResource(R.string.nav_settings)) },
        )
    }
}
