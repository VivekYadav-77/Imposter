package com.impostergame.designsystem.component

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

enum class GameGlyphKind {
    Status,
    Evidence,
    Meeting,
    Check,
    Timer,
    Sound,
    Muted,
    Theme,
}

/** Small coherent line-icon family for game actions; decorative semantics belong to the button. */
@Composable
fun GameGlyph(
    kind: GameGlyphKind,
    modifier: Modifier = Modifier,
    tint: Color = LocalContentColor.current,
    size: Dp = 22.dp,
) {
    val cutoutColor = MaterialTheme.colorScheme.surface
    Canvas(modifier.size(size)) {
        val unit = this.size.minDimension
        val stroke = unit * 0.085f
        val line = Stroke(width = stroke, cap = StrokeCap.Round)
        when (kind) {
            GameGlyphKind.Status -> {
                drawCircle(tint, unit * 0.36f, center, style = line)
                drawCircle(tint, unit * 0.08f, center)
                drawLine(
                    tint,
                    Offset(unit * 0.5f, unit * 0.5f),
                    Offset(unit * 0.72f, unit * 0.31f),
                    stroke,
                    StrokeCap.Round,
                )
            }
            GameGlyphKind.Evidence -> {
                drawRoundRect(
                    color = tint,
                    topLeft = Offset(unit * 0.12f, unit * 0.2f),
                    size = androidx.compose.ui.geometry.Size(unit * 0.76f, unit * 0.62f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(unit * 0.1f),
                    style = line,
                )
                drawCircle(tint, unit * 0.09f, Offset(unit * 0.66f, unit * 0.39f))
                val path =
                    Path().apply {
                        moveTo(unit * 0.2f, unit * 0.72f)
                        lineTo(unit * 0.4f, unit * 0.5f)
                        lineTo(unit * 0.54f, unit * 0.64f)
                        lineTo(unit * 0.66f, unit * 0.54f)
                        lineTo(unit * 0.8f, unit * 0.7f)
                    }
                drawPath(path, tint, style = line)
            }
            GameGlyphKind.Meeting -> {
                drawCircle(tint, unit * 0.36f, center, style = line)
                drawLine(
                    tint,
                    Offset(unit * 0.5f, unit * 0.29f),
                    Offset(unit * 0.5f, unit * 0.56f),
                    stroke,
                    StrokeCap.Round,
                )
                drawCircle(tint, unit * 0.045f, Offset(unit * 0.5f, unit * 0.7f))
            }
            GameGlyphKind.Check -> {
                drawLine(
                    tint,
                    Offset(unit * 0.18f, unit * 0.52f),
                    Offset(unit * 0.4f, unit * 0.74f),
                    stroke,
                    StrokeCap.Round,
                )
                drawLine(
                    tint,
                    Offset(unit * 0.4f, unit * 0.74f),
                    Offset(unit * 0.83f, unit * 0.27f),
                    stroke,
                    StrokeCap.Round,
                )
            }
            GameGlyphKind.Timer -> {
                drawArc(
                    tint,
                    startAngle = -70f,
                    sweepAngle = 320f,
                    useCenter = false,
                    topLeft = Offset(unit * 0.15f, unit * 0.2f),
                    size = androidx.compose.ui.geometry.Size(unit * 0.7f, unit * 0.7f),
                    style = line,
                )
                drawLine(
                    tint,
                    Offset(unit * 0.5f, unit * 0.5f),
                    Offset(unit * 0.69f, unit * 0.36f),
                    stroke,
                    StrokeCap.Round,
                )
                drawLine(
                    tint,
                    Offset(unit * 0.4f, unit * 0.08f),
                    Offset(unit * 0.6f, unit * 0.08f),
                    stroke,
                    StrokeCap.Round,
                )
            }
            GameGlyphKind.Sound,
            GameGlyphKind.Muted -> {
                val speaker =
                    Path().apply {
                        moveTo(unit * 0.16f, unit * 0.42f)
                        lineTo(unit * 0.34f, unit * 0.42f)
                        lineTo(unit * 0.52f, unit * 0.25f)
                        lineTo(unit * 0.52f, unit * 0.75f)
                        lineTo(unit * 0.34f, unit * 0.58f)
                        lineTo(unit * 0.16f, unit * 0.58f)
                        close()
                    }
                drawPath(speaker, tint, style = line)
                if (kind == GameGlyphKind.Muted) {
                    drawLine(
                        tint,
                        Offset(unit * 0.65f, unit * 0.38f),
                        Offset(unit * 0.86f, unit * 0.62f),
                        stroke,
                        StrokeCap.Round,
                    )
                    drawLine(
                        tint,
                        Offset(unit * 0.86f, unit * 0.38f),
                        Offset(unit * 0.65f, unit * 0.62f),
                        stroke,
                        StrokeCap.Round,
                    )
                } else {
                    drawArc(
                        tint,
                        -58f,
                        116f,
                        false,
                        Offset(unit * 0.48f, unit * 0.28f),
                        androidx.compose.ui.geometry.Size(unit * 0.3f, unit * 0.44f),
                        style = line,
                    )
                    drawArc(
                        tint,
                        -52f,
                        104f,
                        false,
                        Offset(unit * 0.47f, unit * 0.17f),
                        androidx.compose.ui.geometry.Size(unit * 0.48f, unit * 0.66f),
                        style = line,
                    )
                }
            }
            GameGlyphKind.Theme -> {
                drawCircle(tint, unit * 0.34f, center, style = line)
                drawCircle(cutoutColor, unit * 0.3f, Offset(unit * 0.63f, unit * 0.37f))
            }
        }
    }
}
