package com.bashar.physicianschedule.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.bashar.physicianschedule.data.ThemeMode

// Clinical, low-saturation palette: deep teal for actions, warm red kept for conflicts.
private val Light = lightColorScheme(
    primary = Color(0xFF0E6E62),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCDE9E3),
    onPrimaryContainer = Color(0xFF00201B),
    secondary = Color(0xFF4E625E),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFDDE6E3),
    onSecondaryContainer = Color(0xFF16302C),
    background = Color(0xFFF4F6F6),
    onBackground = Color(0xFF16302C),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF16302C),
    surfaceVariant = Color(0xFFE6ECEA),
    onSurfaceVariant = Color(0xFF4E625E),
    surfaceContainer = Color(0xFFF0F3F2),
    surfaceContainerHigh = Color(0xFFE9EEEC),
    outline = Color(0xFF7D8F8B),
    outlineVariant = Color(0xFFD3DCD9),
    error = Color(0xFFB8392F),
    onError = Color.White,
    errorContainer = Color(0xFFF9DEDA),
    onErrorContainer = Color(0xFF410001),
)

private val Dark = darkColorScheme(
    primary = Color(0xFF6DD3C2),
    onPrimary = Color(0xFF00372F),
    primaryContainer = Color(0xFF0B5147),
    onPrimaryContainer = Color(0xFFCDE9E3),
    secondary = Color(0xFFB3C8C3),
    onSecondary = Color(0xFF1E3531),
    secondaryContainer = Color(0xFF344B47),
    onSecondaryContainer = Color(0xFFD0E4DF),
    background = Color(0xFF101716),
    onBackground = Color(0xFFE2EBE8),
    surface = Color(0xFF151D1C),
    onSurface = Color(0xFFE2EBE8),
    surfaceVariant = Color(0xFF26312F),
    onSurfaceVariant = Color(0xFFB3C3BF),
    surfaceContainer = Color(0xFF1B2422),
    surfaceContainerHigh = Color(0xFF232E2C),
    outline = Color(0xFF7F918D),
    outlineVariant = Color(0xFF34423F),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF8C1D18),
    onErrorContainer = Color(0xFFFFDAD6),
)

@Immutable
data class ExtraColors(val warning: Color, val success: Color, val isDark: Boolean)

val LocalExtraColors = staticCompositionLocalOf { ExtraColors(Color(0xFFB8392F), Color(0xFF2E7D32), false) }

@Composable
fun PhysicianTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val extra = if (dark) ExtraColors(Color(0xFFFFB4AB), Color(0xFF8BD39A), true) else ExtraColors(Color(0xFFB8392F), Color(0xFF2E7D32), false)
    androidx.compose.runtime.CompositionLocalProvider(LocalExtraColors provides extra) {
        MaterialTheme(colorScheme = if (dark) Dark else Light, content = content)
    }
}
