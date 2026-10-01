package com.impostergame.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.impostergame.designsystem.avatar.PlayerWatermark
import com.impostergame.designsystem.theme.GameElevation
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.gameColors

/**
 * Atmospheric game canvas shared by public screens. Content remains fully readable in both themes.
 */
@Composable
fun SignalBackground(
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.gameColors.accentStrong,
    watermarkPlayerColorId: String? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    val background = MaterialTheme.colorScheme.background
    val soft = MaterialTheme.gameColors.canvasSoft
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(background, soft.copy(alpha = 0.88f), background)
                    )
                )
    ) {
        Canvas(Modifier.fillMaxSize()) {
            drawCircle(
                brush = Brush.radialGradient(listOf(accent.copy(alpha = 0.13f), Color.Transparent)),
                radius = size.minDimension * 0.64f,
                center = Offset(size.width * 0.9f, size.height * 0.04f),
            )
            drawCircle(
                color = accent.copy(alpha = 0.09f),
                radius = size.minDimension * 0.31f,
                center = Offset(size.width * 0.08f, size.height * 0.76f),
                style = Stroke(width = 2.dp.toPx()),
            )
            drawLine(
                color = accent.copy(alpha = 0.07f),
                start = Offset(0f, size.height * 0.18f),
                end = Offset(size.width, size.height * 0.02f),
                strokeWidth = 1.dp.toPx(),
            )
        }
        watermarkPlayerColorId?.let { id ->
            PlayerWatermark(
                transportId = id,
                modifier = Modifier.align(Alignment.TopEnd).fillMaxSize(),
            )
        }
        content()
    }
}

@Composable
fun BrandMark(
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.gameColors.accentStrong,
    size: Dp = 34.dp,
) {
    val orbit =
        PathParser()
            .parsePathString(
                "M3.5 20c0-9.1 7.4-16.5 16.5-16.5S36.5 10.9 36.5 20 29.1 36.5 20 36.5 3.5 29.1 3.5 20Z"
            )
            .toPath()
    val visor =
        PathParser()
            .parsePathString("M9.5 20s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S9.5 20 9.5 20Z")
            .toPath()
    val signal = PathParser().parsePathString("M28.5 8.5 32 5").toPath()
    Canvas(modifier.size(size)) {
        val scale = this.size.minDimension / 40f
        withTransform({ scale(scale, scale, pivot = Offset.Zero) }) {
            drawPath(orbit, accent.copy(alpha = 0.42f), style = Stroke(1.5f))
            drawPath(visor, accent, style = Stroke(1.8f, cap = StrokeCap.Round))
            drawCircle(accent, radius = 2.6f, center = Offset(20f, 20f))
            drawPath(signal, accent, style = Stroke(2.4f, cap = StrokeCap.Round))
        }
    }
}

@Composable
fun BrandHeader(
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    trailing: (@Composable RowScope.() -> Unit)? = null,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
    ) {
        BrandMark(size = 36.dp)
        Text(
            text =
                buildAnnotatedString {
                    append("IMPOSTER")
                    if (!compact) {
                        withStyle(
                            SpanStyle(
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 10.14.sp,
                            )
                        ) {
                            append(" GAME")
                        }
                    }
                },
            modifier = Modifier.weight(1f),
            style =
                MaterialTheme.typography.labelLarge.copy(
                    fontSize = 14.08.sp,
                    lineHeight = 14.08.sp,
                    letterSpacing = 1.55.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
            maxLines = 1,
        )
        trailing?.invoke(this)
    }
}

@Composable
fun GameEyebrow(
    text: String,
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.gameColors.accentStrong,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Spacer(Modifier.size(7.dp).background(accent, CircleShape))
        Text(
            text.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Black,
            color = accent,
            letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified,
        )
    }
}

@Composable
fun SignalCard(
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.gameColors.accentStrong,
    emphasized: Boolean = false,
    content: @Composable () -> Unit,
) {
    Surface(
        modifier = modifier,
        shape = GameShapes.medium,
        // Cards use the website-equivalent paper/surface role in both themes. The raised and
        // highest roles are reserved for nested controls and pressed states; using them here made
        // light-theme cards look muddy and inverted the intended surface hierarchy.
        color = MaterialTheme.colorScheme.surface,
        border =
            BorderStroke(
                if (emphasized) 2.dp else 1.dp,
                accent.copy(alpha = if (emphasized) 0.72f else 0.24f),
            ),
        tonalElevation = GameElevation.resting,
        shadowElevation = if (emphasized) GameElevation.soft else GameElevation.card,
    ) {
        Box(Modifier.border(0.dp, Color.Transparent, GameShapes.medium)) { content() }
    }
}

@Composable
fun SignalChip(
    text: String,
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.gameColors.accentStrong,
) {
    Surface(
        modifier = modifier,
        shape = GameShapes.pill,
        color = accent.copy(alpha = 0.12f),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.32f)),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = GameSpacing.sm, vertical = GameSpacing.xs),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun MetricTile(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.gameColors.accentStrong,
) {
    Column(
        modifier = modifier.padding(GameSpacing.md),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.xxs),
    ) {
        Text(
            value,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Black,
            color = accent,
        )
        Text(
            label.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
