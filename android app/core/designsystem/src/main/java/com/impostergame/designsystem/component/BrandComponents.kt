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
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
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
        content()
    }
}

@Composable
fun BrandMark(
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.gameColors.accentStrong,
    size: Dp = 34.dp,
) {
    Canvas(modifier.size(size)) {
        val stroke = this.size.minDimension * 0.085f
        drawArc(
            color = accent,
            startAngle = 200f,
            sweepAngle = 140f,
            useCenter = false,
            topLeft = Offset(stroke, this.size.height * 0.22f),
            size = Size(this.size.width - stroke * 2f, this.size.height * 0.56f),
            style = Stroke(stroke, cap = StrokeCap.Round),
        )
        drawCircle(accent, radius = this.size.minDimension * 0.14f, center = center)
        drawCircle(
            color = accent.copy(alpha = 0.35f),
            radius = this.size.minDimension * 0.27f,
            center = center,
            style = Stroke(stroke * 0.55f),
        )
    }
}

@Composable
fun BrandHeader(
    modifier: Modifier = Modifier,
    trailing: (@Composable RowScope.() -> Unit)? = null,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
    ) {
        BrandMark()
        Column(Modifier.weight(1f)) {
            Text(
                "IMPOSTER",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Black,
                letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified,
            )
            Text(
                "LIVE SOCIAL DEDUCTION",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
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
        color =
            if (emphasized) MaterialTheme.gameColors.surfaceHighest
            else MaterialTheme.gameColors.surfaceRaised,
        border =
            BorderStroke(
                if (emphasized) 2.dp else 1.dp,
                accent.copy(alpha = if (emphasized) 0.72f else 0.24f),
            ),
        tonalElevation = if (emphasized) 3.dp else 1.dp,
        shadowElevation = if (emphasized) 3.dp else 0.dp,
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
