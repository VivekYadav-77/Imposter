package com.impostergame.designsystem.avatar

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.impostergame.designsystem.R
import com.impostergame.designsystem.theme.LocalGameSemanticColors

enum class PlayerStatus(val descriptionResource: Int, val badgeResource: Int) {
    Disconnected(R.string.player_status_disconnected, R.string.player_badge_disconnected),
    Dead(R.string.player_status_dead, R.string.player_badge_dead),
    Ejected(R.string.player_status_ejected, R.string.player_badge_ejected),
    Host(R.string.player_status_host, R.string.player_badge_host),
    Self(R.string.player_status_self, R.string.player_badge_self),
}

@Composable
fun PlayerAvatar(
    transportId: String,
    size: Dp,
    contentDescription: String,
    modifier: Modifier = Modifier,
    status: PlayerStatus? = null,
    selected: Boolean = false,
    decorative: Boolean = false,
) {
    val slot = PlayerColors.fromTransportId(transportId)
    val colorName = stringResource(slot.nameResource)
    val statusDescription = status?.let { stringResource(it.descriptionResource) }
    val selectionDescription =
        if (selected) stringResource(R.string.player_status_selected) else null
    val fullDescription =
        listOfNotNull(
                stringResource(R.string.player_avatar_description, contentDescription, colorName),
                statusDescription,
                selectionDescription,
            )
            .joinToString(separator = ", ")
    val avatarColor =
        if (MaterialTheme.colorScheme.background.luminance() < 0.5f) slot.dark else slot.light
    val outline =
        if (selected) LocalGameSemanticColors.current.focus else MaterialTheme.colorScheme.outline

    val semanticsModifier =
        if (decorative) {
            Modifier.clearAndSetSemantics {}
        } else {
            Modifier.semantics(mergeDescendants = true) {
                this.contentDescription = fullDescription
                if (selected) this.selected = true
            }
        }

    Box(
        modifier =
            modifier
                .size(size)
                .then(semanticsModifier)
                .background(MaterialTheme.colorScheme.surfaceVariant, CircleShape)
                .border(if (selected) 3.dp else 1.dp, outline, CircleShape)
                .padding(size * 0.12f),
        contentAlignment = Alignment.Center,
    ) {
        OperativeArt(
            id = transportId,
            color = avatarColor,
            detailColor = MaterialTheme.colorScheme.background,
            modifier =
                Modifier.fillMaxSize()
                    .alpha(if (status == PlayerStatus.Disconnected) 0.55f else 1f),
        )
        if (status != null) {
            PlayerStatusBadge(
                status = status,
                modifier = Modifier.align(Alignment.BottomEnd),
            )
        }
    }
}

/** Decorative, code-native identity watermark used behind room and gameplay content. */
@Composable
fun PlayerWatermark(
    transportId: String,
    modifier: Modifier = Modifier,
    size: Dp = 240.dp,
) {
    val slot = PlayerColors.fromTransportId(transportId)
    val color =
        if (MaterialTheme.colorScheme.background.luminance() < 0.5f) slot.dark else slot.light
    Box(modifier = modifier.clipToBounds(), contentAlignment = Alignment.TopEnd) {
        OperativeArt(id = transportId, color = color, modifier = Modifier.size(size).alpha(0.055f))
    }
}

private data class OperativeGeometry(
    val fills: List<String>,
    val details: List<String> = emptyList(),
    val detailCircles: List<Triple<Float, Float, Float>> = emptyList(),
)

/** Exact 64×64 website operative geometry. Transport IDs remain unchanged. */
@Composable
private fun OperativeArt(
    id: String,
    color: Color,
    modifier: Modifier = Modifier,
    detailColor: Color = MaterialTheme.colorScheme.background,
) {
    val geometry = remember(id) { operativeGeometry(id) }
    val fillPaths = remember(geometry) { geometry.fills.map(::path) }
    val detailPaths = remember(geometry) { geometry.details.map(::path) }
    Canvas(modifier) {
        val scale = size.minDimension / 64f
        drawCircle(
            color.copy(alpha = 0.12f),
            radius = 27f * scale,
            center = Offset(32f * scale, 32f * scale),
        )
        fillPaths.forEach { source ->
            val transformed = Path().apply { addPath(source, Offset.Zero) }
            drawContext.canvas.save()
            drawContext.canvas.scale(scale, scale)
            drawPath(transformed, color)
            drawContext.canvas.restore()
        }
        detailPaths.forEach { source ->
            drawContext.canvas.save()
            drawContext.canvas.scale(scale, scale)
            drawPath(
                source,
                detailColor,
                style = Stroke(width = 2.2f, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
            drawContext.canvas.restore()
        }
        geometry.detailCircles.forEach { (x, y, radius) ->
            drawCircle(
                color = detailColor,
                radius = radius * scale,
                center = Offset(x * scale, y * scale),
                style = Stroke(width = 2.2f * scale),
            )
        }
    }
}

private fun path(data: String): Path = PathParser().parsePathString(data).toPath()

private fun operativeGeometry(id: String): OperativeGeometry =
    when (id) {
        "fox" ->
            OperativeGeometry(
                fills =
                    listOf("M16 14l11 8-8 13zM48 14L37 22l8 13z", "M19 27l13-9 13 9-4 19-9 7-9-7z"),
                details = listOf("M24 33l5 2m11-2-5 2m-6 8h6"),
            )
        "owl" ->
            OperativeGeometry(
                fills = listOf("M17 22l7-9 8 7 8-7 7 9-2 21-13 10-13-10z"),
                details = listOf("M29 42l3-5 3 5"),
                detailCircles = listOf(Triple(25f, 32f, 6f), Triple(39f, 32f, 6f)),
            )
        "wolf" ->
            OperativeGeometry(
                fills = listOf("M16 17l12 7 4-9 4 9 12-7-5 28-11 8-11-8z"),
                details = listOf("M24 33l5 2m11-2-5 2m-6 9h6"),
            )
        "raven" ->
            OperativeGeometry(
                fills =
                    listOf("M14 35c9-17 22-20 36-9-8 1-12 4-15 9l15 5-15 4-7 10c-8-4-13-10-14-19z"),
                details = listOf("M28 31h2"),
            )
        "moth" ->
            OperativeGeometry(
                fills =
                    listOf(
                        "M30 27C22 14 10 15 13 31c2 9 10 13 17 8zm4 0c8-13 20-12 17 4-2 9-10 13-17 8z",
                        "M29 25h6l2 22-5 7-5-7z",
                    ),
                details = listOf("M30 24l-5-8m9 8 5-8"),
            )
        "cobra" ->
            OperativeGeometry(
                fills = listOf("M19 30c0-12 7-18 13-18s13 6 13 18l-7 18-6 6-6-6z"),
                details = listOf("M25 30h4m6 0h4m-10 10l3 3 3-3"),
            )
        "stag" ->
            OperativeGeometry(
                fills = listOf("M21 25l11-6 11 6-3 20-8 9-8-9z"),
                details =
                    listOf("M24 25L16 14m8 7-1-10m17 14 8-11m-8 7 1-10", "M26 33h3m6 0h3m-9 10h6"),
            )
        "hare" ->
            OperativeGeometry(
                fills =
                    listOf(
                        "M21 27c-5-14-1-21 5-18l5 18m12 0c5-14 1-21-5-18l-5 18",
                        "M19 31c2-10 24-10 26 0l-5 17-8 6-8-6z",
                    ),
                details = listOf("M25 36h3m8 0h3m-10 8h6"),
            )
        "panther" ->
            OperativeGeometry(
                fills = listOf("M16 23l9-9 7 8 7-8 9 9-5 24-11 7-11-7z"),
                details = listOf("M23 33l7 2m11-2-7 2", "M29 44h6"),
            )
        "shark" ->
            OperativeGeometry(
                fills =
                    listOf(
                        "M11 37c8-15 23-19 39-9l5-7-1 17 1 11-7-6c-15 9-29 3-37-6z",
                        "M29 25l7-13 4 16z",
                    ),
                details = listOf("M22 34h2m4 7c6 2 11 1 15-2"),
            )
        "bull" ->
            OperativeGeometry(
                fills =
                    listOf(
                        "M20 24c-8 0-11-5-10-12 5 6 9 5 15 5m19 7c8 0 11-5 10-12-5 6-9 5-15 5",
                        "M19 23l13-7 13 7-4 24-9 7-9-7z",
                    ),
                details = listOf("M25 33h4m6 0h4m-10 10h6"),
            )
        "gecko" ->
            OperativeGeometry(
                fills = listOf("M15 31c5-15 29-19 36-4-3 17-13 26-28 25-8-5-11-12-8-21z"),
                details = listOf("M27 42c5 3 10 2 13-1"),
                detailCircles = listOf(Triple(25f, 31f, 5f), Triple(40f, 28f, 5f)),
            )
        "beetle" ->
            OperativeGeometry(
                fills = listOf("M24 21c1-8 15-8 16 0l7 9-3 18-12 7-12-7-3-18z"),
                details = listOf("M32 22v31M19 31h26", "M25 18l-5-7m19 7 5-7"),
            )
        "spider" ->
            OperativeGeometry(
                fills = listOf("M25 26c0-9 14-9 14 0l5 13c2 9-22 9-20 0z"),
                details =
                    listOf("M25 29L13 21m12 15-14-2m15 9-12 7m25-21 12-8M39 36l14-2m-15 9 12 7"),
                detailCircles = listOf(Triple(29f, 27f, 1f), Triple(35f, 27f, 1f)),
            )
        "bat" ->
            OperativeGeometry(
                fills = listOf("M31 27L20 14l-2 9-9-2 9 24 13 9zm2 0 11-13 2 9 9-2-9 24-13 9z"),
                details = listOf("M27 35h3m7 0h-3"),
            )
        "raccoon" ->
            OperativeGeometry(
                fills = listOf("M17 24l9-10 6 7 6-7 9 10-5 24-10 6-10-6z"),
                details = listOf("M20 31l10-3-3 10zm24 0-10-3 3 10z", "M29 44h6"),
            )
        "lynx" ->
            OperativeGeometry(
                fills = listOf("M18 25l1-15 9 11m18 4-1-15-9 11", "M18 25l14-7 14 7-5 23-9 6-9-6z"),
                details = listOf("M24 33l6 2m10-2-6 2m-5 9h6"),
            )
        "falcon" ->
            OperativeGeometry(
                fills = listOf("M16 34c7-18 22-23 37-13l-13 8 9 5-13 4-3 16c-10-3-16-10-17-20z"),
                details = listOf("M29 28h3"),
            )
        else ->
            OperativeGeometry(
                fills = listOf("M16 32a16 16 0 1 0 32 0 16 16 0 1 0-32 0"),
                details = listOf("M25 32h14"),
            )
    }

@Composable
private fun PlayerStatusBadge(status: PlayerStatus, modifier: Modifier = Modifier) {
    val isDanger = status == PlayerStatus.Dead || status == PlayerStatus.Ejected
    val background =
        if (isDanger) MaterialTheme.colorScheme.error
        else MaterialTheme.colorScheme.primaryContainer
    val foreground =
        if (isDanger) MaterialTheme.colorScheme.onError
        else MaterialTheme.colorScheme.onPrimaryContainer

    Box(
        modifier = modifier.size(22.dp).background(background, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = stringResource(status.badgeResource),
            color = foreground,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
        )
    }
}
