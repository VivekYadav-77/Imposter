package com.impostergame.designsystem.adaptive

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.theme.GameSpacing

enum class GameWindowWidth {
    Compact,
    Medium,
    Expanded,
}

enum class GameWindowHeight {
    Compact,
    Regular,
}

@Immutable
data class GameWindowClass(
    val width: GameWindowWidth,
    val height: GameWindowHeight,
) {
    val usesTwoPanes: Boolean
        get() =
            width == GameWindowWidth.Expanded ||
                (width == GameWindowWidth.Medium && height == GameWindowHeight.Compact)

    companion object {
        fun calculate(width: Dp, height: Dp): GameWindowClass =
            GameWindowClass(
                width =
                    when {
                        width >= 840.dp -> GameWindowWidth.Expanded
                        width >= 600.dp -> GameWindowWidth.Medium
                        else -> GameWindowWidth.Compact
                    },
                height =
                    if (height < 480.dp) GameWindowHeight.Compact else GameWindowHeight.Regular,
            )
    }
}

@Composable
fun AdaptiveGameScaffold(
    modifier: Modifier = Modifier,
    topBar: @Composable () -> Unit,
    primaryPane: @Composable () -> Unit,
    supportingPane: @Composable () -> Unit,
    bottomAction: @Composable () -> Unit,
    occludingVerticalHingeWidth: Dp = 0.dp,
    onWindowClass: (GameWindowClass) -> Unit = {},
) {
    Surface(modifier = modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
            val windowClass = GameWindowClass.calculate(maxWidth, maxHeight)
            LaunchedEffect(windowClass) { onWindowClass(windowClass) }

            Column(modifier = Modifier.fillMaxSize()) {
                topBar()
                HorizontalDivider()
                if (windowClass.usesTwoPanes) {
                    TwoPaneLayout(
                        modifier = Modifier.weight(1f),
                        hingeWidth = occludingVerticalHingeWidth,
                        primaryPane = primaryPane,
                        supportingPane = supportingPane,
                    )
                } else {
                    Box(
                        modifier = Modifier.weight(1f).fillMaxWidth().padding(GameSpacing.md),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Box(modifier = Modifier.widthIn(max = 680.dp)) { primaryPane() }
                    }
                }
                Surface(
                    modifier = Modifier.fillMaxWidth().imePadding(),
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 8.dp,
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(GameSpacing.md),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(modifier = Modifier.widthIn(max = 680.dp).fillMaxWidth()) {
                            bottomAction()
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TwoPaneLayout(
    modifier: Modifier,
    hingeWidth: Dp,
    primaryPane: @Composable () -> Unit,
    supportingPane: @Composable () -> Unit,
) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Box(
            modifier = Modifier.weight(1.15f).fillMaxSize().padding(GameSpacing.lg),
            contentAlignment = Alignment.TopCenter,
        ) {
            Box(modifier = Modifier.widthIn(max = 680.dp)) { primaryPane() }
        }
        if (hingeWidth > 0.dp) {
            Spacer(modifier = Modifier.width(hingeWidth))
        } else {
            VerticalDivider()
        }
        Box(
            modifier = Modifier.weight(0.85f).fillMaxSize().padding(GameSpacing.lg),
            contentAlignment = Alignment.TopCenter,
        ) {
            Box(modifier = Modifier.widthIn(max = 520.dp)) { supportingPane() }
        }
    }
}

@Composable
fun ExpandedSupportingRail(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Surface(
        modifier = modifier.widthIn(min = 280.dp, max = 420.dp).fillMaxSize(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 2.dp,
    ) {
        Column(modifier = Modifier.padding(GameSpacing.lg)) { content() }
    }
}
