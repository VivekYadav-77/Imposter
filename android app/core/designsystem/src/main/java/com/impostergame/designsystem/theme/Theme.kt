package com.impostergame.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.impostergame.designsystem.R

val PublicSans =
    FontFamily(
        publicSansFont(FontWeight.Normal, 400),
        publicSansFont(FontWeight.Medium, 500),
        publicSansFont(FontWeight.SemiBold, 600),
        publicSansFont(FontWeight.Bold, 700),
        publicSansFont(FontWeight.ExtraBold, 800),
        publicSansFont(FontWeight.Black, 900),
    )

@OptIn(ExperimentalTextApi::class)
private fun publicSansFont(weight: FontWeight, variableWeight: Int) =
    Font(
        R.font.public_sans_variable,
        weight = weight,
        variationSettings = FontVariation.Settings(FontVariation.weight(variableWeight)),
    )

val BarlowCondensed =
    FontFamily(
        Font(R.font.barlow_condensed_400, weight = FontWeight.Normal),
        Font(R.font.barlow_condensed_600, weight = FontWeight.SemiBold),
        Font(R.font.barlow_condensed_700, weight = FontWeight.Bold),
        Font(R.font.barlow_condensed_800, weight = FontWeight.ExtraBold),
    )

/** Website typography translated at 1 CSS px = 1sp. */
val GameTypography =
    Typography(
        displayLarge =
            TextStyle(
                fontFamily = BarlowCondensed,
                fontWeight = FontWeight.Normal,
                fontSize = 72.sp,
                lineHeight = 63.sp,
                letterSpacing = (-3.24).sp,
            ),
        displayMedium =
            TextStyle(
                fontFamily = BarlowCondensed,
                fontWeight = FontWeight.SemiBold,
                fontSize = 58.sp,
                lineHeight = 53.sp,
                letterSpacing = (-1.45).sp,
            ),
        displaySmall =
            TextStyle(
                fontFamily = BarlowCondensed,
                fontWeight = FontWeight.Bold,
                fontSize = 44.sp,
                lineHeight = 44.sp,
                letterSpacing = 1.8.sp,
            ),
        headlineLarge =
            TextStyle(
                fontFamily = BarlowCondensed,
                fontWeight = FontWeight.SemiBold,
                fontSize = 40.sp,
                lineHeight = 40.sp,
                letterSpacing = (-1).sp,
            ),
        headlineMedium =
            TextStyle(
                fontFamily = BarlowCondensed,
                fontWeight = FontWeight.SemiBold,
                fontSize = 32.sp,
                lineHeight = 34.sp,
                letterSpacing = (-0.8).sp,
            ),
        headlineSmall =
            TextStyle(
                fontFamily = BarlowCondensed,
                fontWeight = FontWeight.SemiBold,
                fontSize = 26.sp,
                lineHeight = 29.sp,
                letterSpacing = (-0.65).sp,
            ),
        titleLarge =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.SemiBold,
                fontSize = 22.sp,
                lineHeight = 28.sp,
            ),
        titleMedium =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                lineHeight = 24.sp,
            ),
        titleSmall =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                lineHeight = 20.sp,
            ),
        bodyLarge =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.Normal,
                fontSize = 17.sp,
                lineHeight = 26.sp,
            ),
        bodyMedium =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.Normal,
                fontSize = 16.sp,
                lineHeight = 25.sp,
            ),
        bodySmall =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.Normal,
                fontSize = 14.sp,
                lineHeight = 21.sp,
            ),
        labelLarge =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                lineHeight = 20.sp,
            ),
        labelMedium =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                lineHeight = 18.sp,
            ),
        labelSmall =
            TextStyle(
                fontFamily = PublicSans,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 11.52.sp,
                lineHeight = 16.sp,
                letterSpacing = 1.96.sp,
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
