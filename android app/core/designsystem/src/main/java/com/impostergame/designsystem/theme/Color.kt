package com.impostergame.designsystem.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

private val Space950 = Color(0xFF090B10)
private val Space900 = Color(0xFF11141C)
private val Space800 = Color(0xFF202532)
private val Space200 = Color(0xFFDDE2F0)
private val Space100 = Color(0xFFF0F2F8)
private val Space050 = Color(0xFFFAFAFD)

private val Electric400 = Color(0xFF8FA8FF)
private val Electric600 = Color(0xFF4C64D8)
private val Electric800 = Color(0xFF263781)
private val Cyan400 = Color(0xFF57D5E8)
private val Cyan800 = Color(0xFF075D6B)
private val Success400 = Color(0xFF69D59B)
private val Warning400 = Color(0xFFFFC857)
private val Warning900 = Color(0xFF5B3A00)
private val Danger400 = Color(0xFFFF8A8A)
private val Danger700 = Color(0xFFB32632)
private val Danger900 = Color(0xFF60141C)

internal val DarkColorScheme =
    darkColorScheme(
        primary = Electric400,
        onPrimary = Color(0xFF101B4F),
        primaryContainer = Electric800,
        onPrimaryContainer = Color(0xFFDDE3FF),
        secondary = Cyan400,
        onSecondary = Color(0xFF00363E),
        secondaryContainer = Cyan800,
        onSecondaryContainer = Color(0xFFA8EDFA),
        error = Danger400,
        onError = Color(0xFF53000A),
        errorContainer = Danger900,
        onErrorContainer = Color(0xFFFFDADA),
        background = Space950,
        onBackground = Space100,
        surface = Space900,
        onSurface = Space100,
        surfaceVariant = Space800,
        onSurfaceVariant = Space200,
        outline = Color(0xFF9096A6),
        outlineVariant = Color(0xFF454B59),
        scrim = Color(0xCC000000),
    )

internal val LightColorScheme =
    lightColorScheme(
        primary = Electric600,
        onPrimary = Color.White,
        primaryContainer = Color(0xFFDDE3FF),
        onPrimaryContainer = Color(0xFF101B4F),
        secondary = Color(0xFF176B7A),
        onSecondary = Color.White,
        secondaryContainer = Color(0xFFAFEDF6),
        onSecondaryContainer = Color(0xFF00363E),
        error = Danger700,
        onError = Color.White,
        errorContainer = Color(0xFFFFDADA),
        onErrorContainer = Color(0xFF410007),
        background = Space050,
        onBackground = Color(0xFF191B21),
        surface = Color.White,
        onSurface = Color(0xFF191B21),
        surfaceVariant = Color(0xFFE2E4EC),
        onSurfaceVariant = Color(0xFF45464F),
        outline = Color(0xFF73747D),
        outlineVariant = Color(0xFFC4C6CF),
        scrim = Color(0x99000000),
    )

internal val DarkSemanticColors =
    GameSemanticColors(
        success = Success400,
        onSuccess = Color(0xFF003921),
        successContainer = Color(0xFF0B462B),
        onSuccessContainer = Color(0xFFA3F2C5),
        warning = Warning400,
        onWarning = Warning900,
        warningContainer = Color(0xFF513A08),
        onWarningContainer = Color(0xFFFFE0A3),
        danger = Danger400,
        onDanger = Color(0xFF53000A),
        focus = Color(0xFFFFD166),
        scrim = Color(0xD9000000),
    )

internal val LightSemanticColors =
    GameSemanticColors(
        success = Color(0xFF166B45),
        onSuccess = Color.White,
        successContainer = Color(0xFFC4F6D7),
        onSuccessContainer = Color(0xFF063820),
        warning = Color(0xFF7A5100),
        onWarning = Color.White,
        warningContainer = Color(0xFFFFE2A8),
        onWarningContainer = Color(0xFF3D2900),
        danger = Danger700,
        onDanger = Color.White,
        focus = Color(0xFF2945B8),
        scrim = Color(0xB3000000),
    )

internal val HighContrastDarkColorScheme =
    DarkColorScheme.copy(
        background = Color.Black,
        surface = Color.Black,
        onBackground = Color.White,
        onSurface = Color.White,
        outline = Color.White,
        outlineVariant = Color(0xFFBFC5D2),
    )

internal val HighContrastLightColorScheme =
    LightColorScheme.copy(
        background = Color.White,
        surface = Color.White,
        onBackground = Color.Black,
        onSurface = Color.Black,
        outline = Color.Black,
        outlineVariant = Color(0xFF3D3F46),
    )
