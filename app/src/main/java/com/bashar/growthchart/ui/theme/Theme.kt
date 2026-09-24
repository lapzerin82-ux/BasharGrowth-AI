package com.bashar.growthchart.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF0B5563),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCDEBF0),
    onPrimaryContainer = Color(0xFF00252B),
    secondary = Color(0xFF4A6368),
    secondaryContainer = Color(0xFFDDE8EA),
    onSecondaryContainer = Color(0xFF051F23),
    tertiary = Color(0xFFB3261E),
    background = Color(0xFFF7FAFB),
    surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFE3EAEC),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF82D2DF),
    onPrimary = Color(0xFF00363D),
    primaryContainer = Color(0xFF004F58),
    onPrimaryContainer = Color(0xFFCDEBF0),
    secondary = Color(0xFFB1CBD0),
    secondaryContainer = Color(0xFF334B50),
    tertiary = Color(0xFFFFB4AB),
)

@Composable
fun GrowthTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors, content = content)
}
