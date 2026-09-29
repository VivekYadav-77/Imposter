package com.impostergame.designsystem.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

internal val BrandDarkCanvas = Color(0xFF0D0F0E)
internal val BrandDarkCanvasSoft = Color(0xFF141714)
internal val BrandDarkSurface = Color(0xFF171A17)
internal val BrandDarkSurfaceRaised = Color(0xFF20241F)
internal val BrandDarkSurfaceHighest = Color(0xFF2A2F29)
internal val BrandDarkText = Color(0xFFF5F2E9)
internal val BrandDarkTextSecondary = Color(0xFFC0BCAE)
internal val BrandDarkTextTertiary = Color(0xFF8D8B80)
internal val BrandDarkBorder = Color(0xFF343931)
internal val BrandDarkBorderStrong = Color(0xFF4D5548)
internal val BrandDarkAccent = Color(0xFFEF9C3D)
internal val BrandDarkAccentStrong = Color(0xFFFFB45D)
internal val BrandDarkAccentInk = Color(0xFF211307)

internal val BrandLightCanvas = Color(0xFFF5F2EB)
internal val BrandLightCanvasSoft = Color(0xFFEDE9DF)
internal val BrandLightSurface = Color(0xFFFFFDF8)
internal val BrandLightSurfaceRaised = Color(0xFFEEE9DF)
internal val BrandLightSurfaceHighest = Color(0xFFE2DDD2)
internal val BrandLightText = Color(0xFF1D211E)
internal val BrandLightTextSecondary = Color(0xFF5F625B)
internal val BrandLightTextTertiary = Color(0xFF777A72)
internal val BrandLightBorder = Color(0xFFD5D0C5)
internal val BrandLightBorderStrong = Color(0xFFAEA99E)
internal val BrandLightAccent = Color(0xFFAE550B)
internal val BrandLightAccentStrong = Color(0xFF8F4207)
internal val BrandLightAccentInk = Color(0xFFFFFAF1)

private val DangerDark = Color(0xFFFF6555)
private val DangerLight = Color(0xFFB73229)
private val SuccessDark = Color(0xFF39C77F)
private val SuccessLight = Color(0xFF14794E)
private val WarningDark = Color(0xFFF0B63F)
private val WarningLight = Color(0xFF9A5B00)

internal val DarkColorScheme =
    darkColorScheme(
        primary = BrandDarkAccent,
        onPrimary = BrandDarkAccentInk,
        primaryContainer = Color(0xFF4A2E13),
        onPrimaryContainer = Color(0xFFFFDDB7),
        secondary = Color(0xFFB48B55),
        onSecondary = Color(0xFF2B1B09),
        secondaryContainer = BrandDarkSurfaceHighest,
        onSecondaryContainer = BrandDarkText,
        tertiary = Color(0xFF27B8C8),
        onTertiary = Color(0xFF001F23),
        tertiaryContainer = Color(0xFF123438),
        onTertiaryContainer = Color(0xFFB3F4FB),
        error = DangerDark,
        onError = Color(0xFF310300),
        errorContainer = Color(0xFF351914),
        onErrorContainer = Color(0xFFFFDAD4),
        background = BrandDarkCanvas,
        onBackground = BrandDarkText,
        surface = BrandDarkSurface,
        onSurface = BrandDarkText,
        surfaceVariant = BrandDarkSurfaceRaised,
        onSurfaceVariant = BrandDarkTextSecondary,
        outline = BrandDarkBorderStrong,
        outlineVariant = BrandDarkBorder,
        scrim = Color(0xD9040605),
    )

internal val LightColorScheme =
    lightColorScheme(
        primary = BrandLightAccent,
        onPrimary = BrandLightAccentInk,
        primaryContainer = Color(0xFFF4DEC5),
        onPrimaryContainer = Color(0xFF3B1B03),
        secondary = Color(0xFF7A5A30),
        onSecondary = Color.White,
        secondaryContainer = BrandLightSurfaceRaised,
        onSecondaryContainer = BrandLightText,
        tertiary = Color(0xFF087F91),
        onTertiary = Color.White,
        tertiaryContainer = Color(0xFFDCEBEF),
        onTertiaryContainer = Color(0xFF07383F),
        error = DangerLight,
        onError = Color.White,
        errorContainer = Color(0xFFF4DFD9),
        onErrorContainer = Color(0xFF63150D),
        background = BrandLightCanvas,
        onBackground = BrandLightText,
        surface = BrandLightSurface,
        onSurface = BrandLightText,
        surfaceVariant = BrandLightSurfaceRaised,
        onSurfaceVariant = BrandLightTextSecondary,
        outline = BrandLightBorderStrong,
        outlineVariant = BrandLightBorder,
        scrim = Color(0xB3191D1A),
    )

internal val DarkSemanticColors =
    GameSemanticColors(
        success = SuccessDark,
        onSuccess = Color(0xFF052615),
        successContainer = Color(0xFF183122),
        onSuccessContainer = Color(0xFFB7F5CE),
        warning = WarningDark,
        onWarning = Color(0xFF2D2104),
        warningContainer = Color(0xFF342A12),
        onWarningContainer = Color(0xFFFFE5A1),
        danger = DangerDark,
        onDanger = Color(0xFF310300),
        focus = Color(0xFFF3AA52),
        scrim = Color(0xD9040605),
    )

internal val LightSemanticColors =
    GameSemanticColors(
        success = SuccessLight,
        onSuccess = Color.White,
        successContainer = Color(0xFFDEEEE2),
        onSuccessContainer = Color(0xFF174E2C),
        warning = WarningLight,
        onWarning = Color.White,
        warningContainer = Color(0xFFF0E8CB),
        onWarningContainer = Color(0xFF574303),
        danger = DangerLight,
        onDanger = Color.White,
        focus = Color(0xFF9C4D08),
        scrim = Color(0xB3191D1A),
    )

internal val DarkBrandColors =
    GameBrandColors(
        canvasSoft = BrandDarkCanvasSoft,
        surfaceRaised = BrandDarkSurfaceRaised,
        surfaceHighest = BrandDarkSurfaceHighest,
        textTertiary = BrandDarkTextTertiary,
        borderStrong = BrandDarkBorderStrong,
        accentStrong = BrandDarkAccentStrong,
        privateCanvas = Color(0xFF0B0C0B),
        privateSurface = Color(0xFF171411),
        privateText = Color(0xFFF5EEE4),
        lobby = Color(0xFF27B8C8),
        tasks = Color(0xFFF0B63F),
        meeting = Color(0xFFFF6A5D),
        voting = Color(0xFF8C7CFF),
        results = Color(0xFF36C889),
        ready = SuccessDark,
        pending = WarningDark,
    )

internal val LightBrandColors =
    GameBrandColors(
        canvasSoft = BrandLightCanvasSoft,
        surfaceRaised = BrandLightSurfaceRaised,
        surfaceHighest = BrandLightSurfaceHighest,
        textTertiary = BrandLightTextTertiary,
        borderStrong = BrandLightBorderStrong,
        accentStrong = BrandLightAccentStrong,
        privateCanvas = Color(0xFF0B0C0B),
        privateSurface = Color(0xFF171411),
        privateText = Color(0xFFF5EEE4),
        lobby = Color(0xFF087F91),
        tasks = Color(0xFFA86100),
        meeting = Color(0xFFBF3D35),
        voting = Color(0xFF5B4BC4),
        results = Color(0xFF14794E),
        ready = SuccessLight,
        pending = WarningLight,
    )

internal val HighContrastDarkColorScheme =
    DarkColorScheme.copy(
        background = Color.Black,
        surface = Color.Black,
        onBackground = Color.White,
        onSurface = Color.White,
        onSurfaceVariant = Color.White,
        outline = Color.White,
        outlineVariant = Color(0xFFD8D8D8),
    )

internal val HighContrastLightColorScheme =
    LightColorScheme.copy(
        background = Color.White,
        surface = Color.White,
        onBackground = Color.Black,
        onSurface = Color.Black,
        onSurfaceVariant = Color.Black,
        outline = Color.Black,
        outlineVariant = Color(0xFF353535),
    )
