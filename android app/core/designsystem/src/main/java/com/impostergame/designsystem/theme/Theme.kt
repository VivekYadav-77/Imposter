package com.impostergame.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val GameTypography =
    Typography(
        displayLarge =
            TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Black,
                fontSize = 48.sp,
                lineHeight = 52.sp,
            ),
        displayMedium =
            TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Black,
                fontSize = 40.sp,
                lineHeight = 44.sp,
            ),
        headlineLarge =
            TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Bold,
                fontSize = 32.sp,
                lineHeight = 38.sp,
            ),
        titleLarge =
            TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 22.sp,
                lineHeight = 28.sp,
            ),
        bodyLarge =
            TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Normal,
                fontSize = 18.sp,
                lineHeight = 26.sp,
            ),
        bodyMedium =
            TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Normal,
                fontSize = 16.sp,
                lineHeight = 24.sp,
            ),
        labelLarge =
            TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                lineHeight = 20.sp,
            ),
    )

@Composable
fun ImposterGameTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    accessibilityPreferences: GameAccessibilityPreferences = GameAccessibilityPreferences(),
    content: @Composable () -> Unit,
) {
    val scheme =
        when {
            accessibilityPreferences.highContrast && darkTheme -> HighContrastDarkColorScheme
            accessibilityPreferences.highContrast -> HighContrastLightColorScheme
            darkTheme -> DarkColorScheme
            else -> LightColorScheme
        }
    val semanticColors = if (darkTheme) DarkSemanticColors else LightSemanticColors
    val brandColors = if (darkTheme) DarkBrandColors else LightBrandColors

    CompositionLocalProvider(
        LocalGameSemanticColors provides semanticColors,
        LocalGameBrandColors provides brandColors,
        LocalGameAccessibilityPreferences provides accessibilityPreferences,
    ) {
        MaterialTheme(
            colorScheme = scheme,
            typography = GameTypography,
            shapes =
                MaterialTheme.shapes.copy(
                    small = GameShapes.small,
                    medium = GameShapes.medium,
                    large = GameShapes.large,
                ),
            content = content,
        )
    }
}

val MaterialTheme.gameColors: GameBrandColors
    @Composable get() = LocalGameBrandColors.current
