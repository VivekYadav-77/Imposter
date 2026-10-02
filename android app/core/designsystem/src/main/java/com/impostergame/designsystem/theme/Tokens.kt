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
    val xSmall = RoundedCornerShape(8.dp)
    val small = RoundedCornerShape(10.dp)
    val card = RoundedCornerShape(14.dp)
    val task = RoundedCornerShape(16.dp)
    val medium = RoundedCornerShape(18.dp)
    val dialog = RoundedCornerShape(22.dp)
    val panel = RoundedCornerShape(24.dp)
    val large = RoundedCornerShape(30.dp)
    val pill = RoundedCornerShape(50)
}

object GameElevation {
    val resting = 0.dp
    val raised = 3.dp
    val card = 10.dp
    val soft = 18.dp
    val overlay = 18.dp
}

/** Mobile CSS measurements from the website reference. */
object WebsiteLayout {
    val mobileGutter = 20.dp
    val headerHorizontal = 18.dp
    val headerVertical = 14.dp
    val themeControl = 46.dp
    val heroTop = 56.dp
    val heroBottom = 90.dp
    val journeyTop = 90.dp
    val journeyBottom = 110.dp
    val journeyCardWidth = 278.dp
    val journeyCardBodyHeight = 210.dp
    val bandVertical = 82.dp
    val phaseSwatchHeight = 96.dp
    val privacyMargin = 90.dp
    val privacyPadding = 28.dp
    val footerBottom = 56.dp

    // Frozen mobile game-command-center measurements.
    val gamePageBottom = 92.dp
    val phaseBarMinHeight = 70.dp
    val phaseBarHorizontal = 12.dp
    val phaseBarVertical = 8.dp
    val phaseControl = 44.dp
    val gameContentGutter = 10.dp
    val lobbyContentGutter = 14.dp
    val lobbyRosterRowHeight = 78.dp
    val taskCardMinHeight = 104.dp
    val taskCardRadius = 16.dp
    val taskNumber = 36.dp
    val taskProofWidth = 76.dp
    val mobileActionHeight = 70.dp
    val mobileActionRadius = 18.dp
    val dialogMobileRadius = 22.dp
    val votingOptionRadius = 18.dp
}

object WebsiteTypeScale {
    fun mobileHero(widthDp: Float): Float = (widthDp * 0.18f).coerceIn(59.2f, 89.6f)

    fun mobileSection(widthDp: Float): Float = (widthDp * 0.15f).coerceIn(52.8f, 80f)
}

object GameMotion {
    const val InstantMillis = 0
    const val QuickMillis = 120
    const val StandardMillis = 200
    const val EmphasisMillis = 480
    const val ProgressMillis = 420
    const val CompletionMillis = 440
    const val RevealMillis = 560
    const val StaggerMillis = 45
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
