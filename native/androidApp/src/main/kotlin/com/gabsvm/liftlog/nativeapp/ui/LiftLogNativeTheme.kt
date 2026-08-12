package com.gabsvm.liftlog.nativeapp.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LiftLogDarkColors = darkColorScheme(
    primary = Color(0xFFC6FF00),
    onPrimary = Color(0xFF172100),
    primaryContainer = Color(0xFF304600),
    onPrimaryContainer = Color(0xFFE2FF9E),
    secondary = Color(0xFFB9CBAA),
    onSecondary = Color(0xFF25351D),
    secondaryContainer = Color(0xFF3B4B32),
    onSecondaryContainer = Color(0xFFD5E7C5),
    background = Color(0xFF0B0D0C),
    onBackground = Color(0xFFE4E8E2),
    surface = Color(0xFF0B0D0C),
    onSurface = Color(0xFFE4E8E2),
    surfaceVariant = Color(0xFF41473E),
    onSurfaceVariant = Color(0xFFC2C8BE),
    surfaceContainerLowest = Color(0xFF070908),
    surfaceContainerLow = Color(0xFF111411),
    surfaceContainer = Color(0xFF151816),
    surfaceContainerHigh = Color(0xFF1B1F1C),
    surfaceContainerHighest = Color(0xFF252A26),
    outline = Color(0xFF8C9388),
    outlineVariant = Color(0xFF41483F),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
)

private val LiftLogLightColors = lightColorScheme(
    primary = Color(0xFF4A6800),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDDF7A0),
    onPrimaryContainer = Color(0xFF182600),
    secondary = Color(0xFF526044),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD6E8C7),
    onSecondaryContainer = Color(0xFF101E08),
    background = Color(0xFFF5F7F3),
    onBackground = Color(0xFF191D19),
    surface = Color(0xFFF9FBF7),
    onSurface = Color(0xFF191D19),
    surfaceVariant = Color(0xFFE1E5DD),
    onSurfaceVariant = Color(0xFF42483F),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFF1F4EE),
    surfaceContainer = Color(0xFFEBEFE8),
    surfaceContainerHigh = Color(0xFFE5E9E2),
    surfaceContainerHighest = Color(0xFFDFE3DC),
    outline = Color(0xFF73796F),
    outlineVariant = Color(0xFFC2C8BD),
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
)

@Composable
fun LiftLogNativeTheme(content: @Composable () -> Unit) {
    val darkTheme = isSystemInDarkTheme()
    val colors = if (darkTheme) LiftLogDarkColors else LiftLogLightColors

    MaterialTheme(
        colorScheme = colors,
        content = content,
    )
}
