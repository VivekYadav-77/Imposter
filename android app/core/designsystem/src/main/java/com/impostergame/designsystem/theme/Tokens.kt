package com.impostergame.designsystem.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object GameSpacing {
    val xxs = 4.dp
    val xs = 8.dp
    val sm = 12.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp
    val xxl = 48.dp
}

object GameShapes {
    val small = RoundedCornerShape(10.dp)
    val medium = RoundedCornerShape(18.dp)
    val large = RoundedCornerShape(30.dp)
    val pill = RoundedCornerShape(50)
}

object GameElevation {
    val resting = 0.dp
    val raised = 3.dp
    val overlay = 8.dp
}

object GameMotion {
    const val InstantMillis = 0
    const val QuickMillis = 120
    const val StandardMillis = 200
    const val EmphasisMillis = 480
    val EmphasisEasing = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)
}

object GameTouchTarget {
    val minimum = 48.dp
}

@Immutable
data class GameSemanticColors(
    val success: Color,
    val onSuccess: Color,
    val successContainer: Color,
    val onSuccessContainer: Color,
    val warning: Color,
    val onWarning: Color,
    val warningContainer: Color,
    val onWarningContainer: Color,
    val danger: Color,
    val onDanger: Color,
    val focus: Color,
    val scrim: Color,
)

@Immutable
data class GameBrandColors(
    val canvasSoft: Color,
    val surfaceRaised: Color,
    val surfaceHighest: Color,
    val textTertiary: Color,
    val borderStrong: Color,
    val accentStrong: Color,
    val privateCanvas: Color,
    val privateSurface: Color,
    val privateText: Color,
    val lobby: Color,
    val tasks: Color,
    val meeting: Color,
    val voting: Color,
    val results: Color,
    val ready: Color,
    val pending: Color,
)

@Immutable
data class GameAccessibilityPreferences(
    val reduceMotion: Boolean = false,
    val soundEnabled: Boolean = true,
    val hapticsEnabled: Boolean = true,
    val highContrast: Boolean = false,
)

val LocalGameSemanticColors =
    staticCompositionLocalOf<GameSemanticColors> {
        error("Game semantic colors are available only inside ImposterGameTheme")
    }

val LocalGameBrandColors =
    staticCompositionLocalOf<GameBrandColors> {
        error("Game brand colors are available only inside ImposterGameTheme")
    }

val LocalGameAccessibilityPreferences = staticCompositionLocalOf {
    GameAccessibilityPreferences()
}
