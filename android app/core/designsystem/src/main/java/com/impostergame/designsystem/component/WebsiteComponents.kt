package com.impostergame.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.GameTouchTarget
import com.impostergame.designsystem.theme.gameColors

enum class WebsiteIconKind {
    Arrow,
    Eye,
    Lobby,
    Tasks,
    Meeting,
    Verdict,
    Room,
    Sun,
    Moon,
}

/** Flat website card: exact border/surface output with no Material tonal color mutation. */
@Composable
fun WebsiteCard(
    modifier: Modifier = Modifier,
    accent: Color? = null,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier,
        shape = GameShapes.card,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
        border =
            BorderStroke(
                1.dp,
                accent?.copy(alpha = .48f) ?: MaterialTheme.colorScheme.outlineVariant,
            ),
    ) {
        Column(content = content)
    }
}

@Composable
fun WebsiteSectionHeading(
    eyebrow: String,
    title: String,
    modifier: Modifier = Modifier,
    count: String? = null,
    accent: Color = MaterialTheme.colorScheme.primary,
) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                eyebrow.uppercase(),
                color = accent,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Black,
            )
            Text(
                title,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Black,
            )
        }
        count?.let {
            Text(
                it,
                modifier =
                    Modifier.background(accent.copy(alpha = .12f), GameShapes.pill)
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                color = accent,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Black,
            )
        }
    }
}

/** Dedicated website ballot row. It intentionally omits operative/color labels. */
@Composable
fun WebsiteBallotRow(
    nickname: String,
    playerColorId: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isSkip: Boolean = false,
    trailingText: String = if (selected) "Selected" else "Tap to select",
) {
    val accent = MaterialTheme.gameColors.voting
    Surface(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 72.dp)
                .clickable(enabled = enabled, role = Role.RadioButton, onClick = onClick)
                .semantics { this.selected = selected },
        shape = GameShapes.medium,
        color = if (selected) accent.copy(alpha = .12f) else MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
        border =
            BorderStroke(
                if (selected) 2.dp else 1.dp,
                if (selected) accent else MaterialTheme.colorScheme.outlineVariant,
            ),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (isSkip) {
                Box(
                    Modifier.size(48.dp).background(accent.copy(alpha = .12f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "—",
                        color = accent,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Black,
                    )
                }
            } else {
                PlayerAvatar(playerColorId, 48.dp, nickname, decorative = true, selected = selected)
            }
            Text(
                nickname,
                Modifier.weight(1f),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                trailingText,
                color = if (selected) accent else MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

/** Full-width mobile modal matching the website overlay rather than Material AlertDialog chrome. */
@Composable
fun WebsiteDialog(
    title: String,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
    actions: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit,
) {
    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = modifier.fillMaxWidth().padding(horizontal = 14.dp).widthIn(max = 520.dp),
            shape = GameShapes.dialog,
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 0.dp,
            shadowElevation = 18.dp,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
            Column(
                Modifier.fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Black,
                )
                content()
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    content = actions,
                )
            }
        }
    }
}

/** The website's 24px, 1.75px round-cap icon family. */
@Composable
fun WebsiteIcon(
    kind: WebsiteIconKind,
    modifier: Modifier = Modifier,
    tint: Color = androidx.compose.material3.LocalContentColor.current,
    size: Dp = 24.dp,
) {
    Canvas(modifier.size(size)) {
        val scale = this.size.minDimension / 24f
        val stroke = Stroke(width = 1.75f, cap = StrokeCap.Round)
        withTransform({ scale(scale, scale, pivot = Offset.Zero) }) {
            fun path(data: String) {
                drawPath(PathParser().parsePathString(data).toPath(), tint, style = stroke)
            }
            when (kind) {
                WebsiteIconKind.Arrow -> path("M5 12h14m-5-5 5 5-5 5")
                WebsiteIconKind.Eye -> {
                    path("M2.8 12s3.3-5.2 9.2-5.2S21.2 12 21.2 12s-3.3 5.2-9.2 5.2S2.8 12 2.8 12Z")
                    drawCircle(tint, 2.35f, Offset(12f, 12f), style = stroke)
                }
                WebsiteIconKind.Lobby -> {
                    drawCircle(tint, 3f, Offset(9f, 9f), style = stroke)
                    drawCircle(tint, 2.4f, Offset(17f, 10f), style = stroke)
                    path("M3.8 19c.4-3.3 2.1-5 5.2-5s4.8 1.7 5.2 5M14 15c3.7-.8 5.8.6 6.2 3.5")
                }
                WebsiteIconKind.Tasks ->
                    path("M5 4h14v16H5zM8 9l1.5 1.5L12 8m1.5 2H16m-8 5 1.5 1.5L12 14m1.5 2H16")
                WebsiteIconKind.Meeting ->
                    path(
                        "M6.5 18.5 4 21l.7-4.2A7 7 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8-4 8-9 8a10 10 0 0 1-5.5-1.5ZM8 12h.01M12 12h.01M16 12h.01"
                    )
                WebsiteIconKind.Verdict -> path("M8 5l8 8m-5-11 6 6M4 18l7-7m-4 10h12m-5-11 3-3")
                WebsiteIconKind.Room -> path("M4 10.5 12 4l8 6.5V20H4ZM9 20v-6h6v6")
                WebsiteIconKind.Sun -> {
                    drawCircle(tint, 3.5f, Offset(12f, 12f), style = stroke)
                    path(
                        "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4m0-13.4-1.4 1.4M6.7 17.3l-1.4 1.4"
                    )
                }
                WebsiteIconKind.Moon -> path("M20 15.5A8.2 8.2 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z")
            }
        }
    }
}

enum class SignalScene {
    Lobby,
    Tasks,
    Meeting,
    Verdict,
}

/** Code-native rendering of the website's 640×460 signal-scene SVG. */
@Composable
fun SignalSceneArt(scene: SignalScene, modifier: Modifier = Modifier) {
    val accent =
        when (scene) {
            SignalScene.Lobby -> MaterialTheme.gameColors.lobby
            SignalScene.Tasks -> MaterialTheme.gameColors.tasks
            SignalScene.Meeting -> MaterialTheme.gameColors.meeting
            SignalScene.Verdict -> MaterialTheme.gameColors.results
        }
    val end = MaterialTheme.colorScheme.background
    val card = MaterialTheme.colorScheme.surface
    val ink = MaterialTheme.colorScheme.onSurface
    val window = MaterialTheme.gameColors.surfaceRaised
    Canvas(
        modifier =
            modifier.fillMaxWidth().aspectRatio(640f / 460f).semantics {
                contentDescription =
                    when (scene) {
                        SignalScene.Lobby -> "Players gathering around a private room signal"
                        SignalScene.Tasks -> "Task evidence moving through a private case file"
                        SignalScene.Meeting -> "Players discussing evidence face to face"
                        SignalScene.Verdict -> "A private ballot resolving into the final verdict"
                    }
            }
    ) {
        val sx = size.width / 640f
        val sy = size.height / 460f
        withTransform({ scale(sx, sy, pivot = Offset.Zero) }) {
            drawRoundRect(
                brush = Brush.linearGradient(listOf(accent, end), Offset.Zero, Offset(640f, 460f)),
                size = Size(640f, 460f),
                cornerRadius = CornerRadius(44f),
            )
            drawCircle(
                Color.White.copy(alpha = 0.18f),
                144f,
                Offset(514f, 92f),
                style = Stroke(1.5f),
            )
            drawCircle(
                Color.White.copy(alpha = 0.18f),
                120f,
                Offset(118f, 402f),
                style = Stroke(1.5f),
            )
            drawPath(
                PathParser().parsePathString("M82 330c110-184 241 58 470-160").toPath(),
                Color.White.copy(alpha = 0.35f),
                style = Stroke(2f),
            )
            drawRoundRect(card, Offset(130f, 88f), Size(380f, 284f), CornerRadius(30f))
            drawRoundRect(
                ink.copy(alpha = 0.78f),
                Offset(168f, 140f),
                Size(178f, 16f),
                CornerRadius(8f),
            )
            drawRoundRect(
                ink.copy(alpha = 0.35f),
                Offset(168f, 174f),
                Size(118f, 12f),
                CornerRadius(6f),
            )
            drawRoundRect(window, Offset(168f, 222f), Size(304f, 104f), CornerRadius(20f))
            drawCircle(ink, 54f, Offset(492f, 336f))
            withTransform({
                translate(left = 468f, top = 312f)
                scale(scaleX = 2f, scaleY = 2f, pivot = Offset.Zero)
            }) {
                val iconStroke = Stroke(1.75f, cap = StrokeCap.Round)
                fun iconPath(data: String) {
                    drawPath(PathParser().parsePathString(data).toPath(), card, style = iconStroke)
                }
                when (scene) {
                    SignalScene.Lobby -> {
                        drawCircle(card, 3f, Offset(9f, 9f), style = iconStroke)
                        drawCircle(card, 2.4f, Offset(17f, 10f), style = iconStroke)
                        iconPath(
                            "M3.8 19c.4-3.3 2.1-5 5.2-5s4.8 1.7 5.2 5M14 15c3.7-.8 5.8.6 6.2 3.5"
                        )
                    }
                    SignalScene.Tasks ->
                        iconPath(
                            "M5 4h14v16H5zM8 9l1.5 1.5L12 8m1.5 2H16m-8 5 1.5 1.5L12 14m1.5 2H16"
                        )
                    SignalScene.Meeting ->
                        iconPath(
                            "M6.5 18.5 4 21l.7-4.2A7 7 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8-4 8-9 8a10 10 0 0 1-5.5-1.5ZM8 12h.01M12 12h.01M16 12h.01"
                        )
                    SignalScene.Verdict ->
                        iconPath("M8 5l8 8m-5-11 6 6M4 18l7-7m-4 10h12m-5-11 3-3")
                }
            }
            drawCircle(ink, 34f, Offset(104f, 176f), style = Stroke(2f))
            drawPath(
                PathParser().parsePathString("M55 274c5-50 21-76 49-76s44 26 49 76").toPath(),
                ink,
            )
            drawCircle(ink, 28f, Offset(548f, 208f), style = Stroke(2f))
            drawPath(
                PathParser().parsePathString("M507 288c4-40 18-60 41-60s37 20 41 60").toPath(),
                ink,
            )
        }
    }
}

@Composable
fun WebsitePhaseGlyph(scene: SignalScene, modifier: Modifier = Modifier) {
    val accent =
        when (scene) {
            SignalScene.Lobby -> MaterialTheme.gameColors.lobby
            SignalScene.Tasks -> MaterialTheme.gameColors.tasks
            SignalScene.Meeting -> MaterialTheme.gameColors.meeting
            SignalScene.Verdict -> MaterialTheme.gameColors.results
        }
    val kind =
        when (scene) {
            SignalScene.Lobby -> WebsiteIconKind.Lobby
            SignalScene.Tasks -> WebsiteIconKind.Tasks
            SignalScene.Meeting -> WebsiteIconKind.Meeting
            SignalScene.Verdict -> WebsiteIconKind.Verdict
        }
    Surface(
        modifier = modifier.size(56.dp),
        shape = CircleShape,
        color = accent,
        border = BorderStroke(5.dp, MaterialTheme.colorScheme.surface),
        shadowElevation = 8.dp,
    ) {
        Box(contentAlignment = Alignment.Center) {
            WebsiteIcon(kind, tint = Color.White, size = 26.dp)
        }
    }
}

@Composable
fun WebsiteTrustItem(text: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.defaultMinSize(minHeight = 32.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Box(
            Modifier.size(15.dp)
                .border(4.dp, MaterialTheme.gameColors.ready.copy(alpha = 0.14f), CircleShape)
        ) {
            Spacer(
                Modifier.align(Alignment.Center)
                    .size(7.dp)
                    .background(MaterialTheme.gameColors.ready, CircleShape)
            )
        }
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun WebsiteLoadingPanel(label: String, modifier: Modifier = Modifier) {
    val accent = MaterialTheme.gameColors.accentStrong
    SignalCard(modifier = modifier.fillMaxWidth(), emphasized = true) {
        Row(
            Modifier.padding(GameSpacing.lg),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(GameSpacing.md),
        ) {
            Canvas(Modifier.size(GameTouchTarget.minimum)) {
                drawCircle(accent.copy(alpha = 0.2f))
                drawArc(
                    accent,
                    startAngle = -90f,
                    sweepAngle = 250f,
                    useCenter = false,
                    style = Stroke(3.dp.toPx(), cap = StrokeCap.Round),
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(GameSpacing.xxs)) {
                GameEyebrow("Checking your seat")
                Text(label, style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
