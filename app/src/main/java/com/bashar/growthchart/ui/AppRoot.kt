package com.bashar.growthchart.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bashar.growthchart.ActiveSession
import com.bashar.growthchart.AppContainer
import com.bashar.growthchart.core.growth.Measure
import com.bashar.growthchart.ui.screens.BackupScreen
import com.bashar.growthchart.ui.screens.ChartScreen
import com.bashar.growthchart.ui.screens.HomeScreen
import com.bashar.growthchart.ui.screens.LoginScreen
import com.bashar.growthchart.ui.screens.MeasurementEditScreen
import com.bashar.growthchart.ui.screens.PatientDetailScreen
import com.bashar.growthchart.ui.screens.PatientEditScreen
import com.bashar.growthchart.ui.screens.PatientListScreen
import com.bashar.growthchart.ui.screens.SettingsScreen

/** What to do after choosing a patient from the list opened from the home screen. */
enum class PickMode { BROWSE, SEARCH, MEASURE, CHART, PDF }

@Composable
fun AppRoot(container: AppContainer) {
    val restoring by container.restoring.collectAsState()
    val session by container.session.collectAsState()
    when {
        restoring -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        session == null -> LoginScreen(container)
        else -> key(session) { MainNav(container, session!!) }
    }
}

@Composable
private fun MainNav(container: AppContainer, active: ActiveSession) {
    val nav = rememberNavController()
    val back: () -> Unit = { nav.popBackStack() }
    NavHost(navController = nav, startDestination = "home") {
        composable("home") {
            HomeScreen(
                container = container,
                active = active,
                onNewPatient = { nav.navigate("editpatient?id=") },
                onPick = { mode -> nav.navigate("patients/${mode.name}") },
                onOpenPatient = { id -> nav.navigate("patient/$id") },
                onBackup = { nav.navigate("backup/false") },
                onRestore = { nav.navigate("backup/true") },
                onSettings = { nav.navigate("settings") },
            )
        }
        composable("patients/{mode}", arguments = listOf(navArgument("mode") { type = NavType.StringType })) { entry ->
            val mode = PickMode.valueOf(entry.arguments?.getString("mode") ?: "BROWSE")
            PatientListScreen(
                active = active,
                mode = mode,
                onBack = back,
                onNewPatient = { nav.navigate("editpatient?id=") },
                onPicked = { id ->
                    when (mode) {
                        PickMode.BROWSE, PickMode.SEARCH -> nav.navigate("patient/$id")
                        PickMode.MEASURE -> nav.navigate("measurement?patientId=$id&id=")
                        PickMode.CHART -> nav.navigate("chart/$id/HEIGHT")
                        PickMode.PDF -> nav.navigate("patient/$id?pdf=true")
                    }
                },
            )
        }
        composable(
            "editpatient?id={id}",
            arguments = listOf(navArgument("id") { type = NavType.StringType; defaultValue = "" }),
        ) { entry ->
            val id = entry.arguments?.getString("id").orEmpty().ifEmpty { null }
            PatientEditScreen(
                active = active,
                patientId = id,
                onBack = back,
                onSaved = { savedId ->
                    if (id == null) {
                        nav.navigate("patient/$savedId") { popUpTo("editpatient?id={id}") { inclusive = true } }
                    } else nav.popBackStack()
                },
                onOpenExisting = { existing ->
                    nav.navigate("patient/$existing") { popUpTo("editpatient?id={id}") { inclusive = true } }
                },
            )
        }
        composable(
            "patient/{id}?pdf={pdf}",
            arguments = listOf(
                navArgument("id") { type = NavType.StringType },
                navArgument("pdf") { type = NavType.BoolType; defaultValue = false },
            ),
        ) { entry ->
            val id = entry.arguments?.getString("id")!!
            PatientDetailScreen(
                container = container,
                active = active,
                patientId = id,
                autoPdf = entry.arguments?.getBoolean("pdf") ?: false,
                onBack = back,
                onEdit = { nav.navigate("editpatient?id=$id") },
                onAddMeasurement = { nav.navigate("measurement?patientId=$id&id=") },
                onEditMeasurement = { mid -> nav.navigate("measurement?patientId=$id&id=$mid") },
                onChart = { measure -> nav.navigate("chart/$id/${measure.name}") },
                onDeleted = { nav.popBackStack("home", inclusive = false) },
            )
        }
        composable(
            "measurement?patientId={patientId}&id={id}",
            arguments = listOf(
                navArgument("patientId") { type = NavType.StringType; defaultValue = "" },
                navArgument("id") { type = NavType.StringType; defaultValue = "" },
            ),
        ) { entry ->
            val pid = entry.arguments?.getString("patientId").orEmpty()
            val mid = entry.arguments?.getString("id").orEmpty().ifEmpty { null }
            MeasurementEditScreen(
                container = container,
                active = active,
                patientId = pid,
                measurementId = mid,
                onBack = back,
                onSaved = { nav.popBackStack() },
                onOpenChart = { nav.navigate("chart/$pid/HEIGHT") { popUpTo("measurement?patientId={patientId}&id={id}") { inclusive = true } } },
            )
        }
        composable(
            "chart/{id}/{measure}",
            arguments = listOf(navArgument("id") { type = NavType.StringType }, navArgument("measure") { type = NavType.StringType }),
        ) { entry ->
            ChartScreen(
                container = container,
                active = active,
                patientId = entry.arguments?.getString("id")!!,
                initialMeasure = Measure.valueOf(entry.arguments?.getString("measure") ?: "HEIGHT"),
                onBack = back,
                onAddMeasurement = { pid -> nav.navigate("measurement?patientId=$pid&id=") },
            )
        }
        composable("backup/{restore}", arguments = listOf(navArgument("restore") { type = NavType.BoolType })) { entry ->
            BackupScreen(container, active, restoreFirst = entry.arguments?.getBoolean("restore") ?: false, onBack = back)
        }
        composable("settings") { SettingsScreen(container, active, onBack = back) }
    }
}
