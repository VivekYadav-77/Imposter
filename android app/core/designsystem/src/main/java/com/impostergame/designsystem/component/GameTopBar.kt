package com.impostergame.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.R
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.avatar.PlayerStatus
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.LocalGameAccessibilityPreferences
import com.impostergame.designsystem.theme.LocalGameSemanticColors
import com.impostergame.designsystem.theme.WebsiteLayout
import com.impostergame.designsystem.theme.gameColors

enum class ConnectionState {
    Connected,
    Reconnecting,
    Offline,
}

@Composable
fun GameTopBar(
    phase: String,
    timerText: String,
    timerDescription: String,
    nickname: String,
    playerColorId: String,
    connectionState: ConnectionState,
    modifier: Modifier = Modifier,
    navigationLabel: String? = null,
    onNavigationClick: (() -> Unit)? = null,
    onToggleSound: (() -> Unit)? = null,
    onToggleTheme: (() -> Unit)? = null,
) {
    val phaseColor =
        with(MaterialTheme.gameColors) {
            when {
                phase.contains("lobby", ignoreCase = true) -> lobby
                phase.contains("task", ignoreCase = true) -> tasks
                phase.contains("evidence", ignoreCase = true) -> tasks
                phase.contains("vote", ignoreCase = true) -> voting
                phase.contains("result", ignoreCase = true) -> results
                phase.contains("meeting", ignoreCase = true) -> meeting
                else -> MaterialTheme.colorScheme.primary
            }
        }
    val command =
        if (MaterialTheme.colorScheme.background.luminance() > 0.5f) Color(0xFFFDFBF6)
        else Color(0xFF111412)
    Surface(modifier = modifier.fillMaxWidth(), color = command, shadowElevation = 8.dp) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val showPhaseIcon = maxWidth > 390.dp
            val showIdentityName = maxWidth >= 430.dp
            Column {
                Row(
                    modifier =
                        Modifier.fillMaxWidth()
                            .height(68.dp)
                            .background(
                                Brush.horizontalGradient(
                                    listOf(phaseColor.copy(alpha = .11f), Color.Transparent),
                                    endX = 560f,
                                )
                            )
                            .padding(
                                horizontal = WebsiteLayout.phaseBarHorizontal,
                                vertical = WebsiteLayout.phaseBarVertical,
                            ),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (navigationLabel != null && onNavigationClick != null) {
                        GameIconButton(onNavigationClick, "Back to $navigationLabel") {
                            Text("←", style = MaterialTheme.typography.titleLarge)
                        }
                    }
                    if (showPhaseIcon) {
                        val icon =
                            when {
                                phase.contains("lobby", true) -> WebsiteIconKind.Lobby
                                phase.contains("task", true) || phase.contains("evidence", true) ->
                                    WebsiteIconKind.Tasks
                                phase.contains("result", true) -> WebsiteIconKind.Verdict
                                else -> WebsiteIconKind.Meeting
                            }
                        Box(
                            Modifier.size(42.dp)
                                .background(phaseColor.copy(alpha = .13f), GameShapes.card)
                                .border(1.dp, phaseColor.copy(alpha = .55f), GameShapes.card),
                            contentAlignment = Alignment.Center,
                        ) {
                            WebsiteIcon(icon, tint = phaseColor, size = 23.dp)
                        }
                    }
                    Text(
                        text = phase.uppercase(),
                        modifier = Modifier.semantics { contentDescription = phase },
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (timerText.isNotBlank()) {
                        Spacer(
                            Modifier.height(34.dp)
                                .width(1.dp)
                                .background(MaterialTheme.colorScheme.outlineVariant)
                        )
                        Text(
                            text = timerText,
                            modifier =
                                Modifier.border(0.dp, MaterialTheme.colorScheme.outlineVariant)
                                    .semantics { contentDescription = timerDescription },
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            maxLines = 1,
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    Row(
                        modifier =
                            Modifier.height(44.dp)
                                .border(
                                    1.dp,
                                    MaterialTheme.colorScheme.outlineVariant,
                                    GameShapes.pill,
                                )
                                .padding(start = 4.dp, end = if (showIdentityName) 10.dp else 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        PlayerAvatar(
                            transportId = playerColorId,
                            size = 36.dp,
                            contentDescription = nickname,
                            status =
                                if (connectionState == ConnectionState.Connected) null
                                else PlayerStatus.Disconnected,
                        )
                        if (showIdentityName) {
                            Text(
                                nickname,
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    onToggleSound?.let { toggle ->
                        val soundEnabled = LocalGameAccessibilityPreferences.current.soundEnabled
                        GameIconButton(
                            onClick = toggle,
                            contentDescription =
                                if (soundEnabled) "Mute game sounds" else "Enable game sounds",
                            modifier =
                                Modifier.size(WebsiteLayout.phaseControl)
                                    .border(
                                        1.dp,
                                        MaterialTheme.colorScheme.outlineVariant,
                                        GameShapes.small,
                                    ),
                        ) {
                            GameGlyph(
                                if (soundEnabled) GameGlyphKind.Sound else GameGlyphKind.Muted,
                                tint = phaseColor,
                            )
                        }
                    }
                    onToggleTheme?.let { toggle ->
                        GameIconButton(
                            onClick = toggle,
                            contentDescription = "Toggle light or dark theme",
                            modifier =
                                Modifier.size(WebsiteLayout.phaseControl)
                                    .border(
                                        1.dp,
                                        MaterialTheme.colorScheme.outlineVariant,
                                        GameShapes.small,
                                    ),
                        ) {
                            GameGlyph(GameGlyphKind.Theme, tint = phaseColor)
                        }
                    }
                }
                Spacer(
                    Modifier.fillMaxWidth()
                        .height(3.dp)
                        .background(
                            Brush.horizontalGradient(
                                listOf(phaseColor, phaseColor.copy(alpha = .35f), Color.Transparent)
                            )
                        )
                )
            }
        }
    }
}

@Composable
private fun CompactConnectionIndicator(connectionState: ConnectionState) {
    val semantic = LocalGameSemanticColors.current
    val label =
        when (connectionState) {
            ConnectionState.Connected -> stringResource(R.string.connection_connected)
            ConnectionState.Reconnecting -> stringResource(R.string.connection_reconnecting)
            ConnectionState.Offline -> stringResource(R.string.connection_offline)
        }
    val color =
        when (connectionState) {
            ConnectionState.Connected -> semantic.success
            ConnectionState.Reconnecting -> semantic.warning
            ConnectionState.Offline -> semantic.danger
        }
    androidx.compose.foundation.layout.Box(
        Modifier.size(20.dp).semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.layout.Spacer(
            Modifier.size(10.dp).background(color, androidx.compose.foundation.shape.CircleShape)
        )
    }
}

@Composable
private fun ConnectionPill(connectionState: ConnectionState) {
    val semantic = LocalGameSemanticColors.current
    val (label, background, foreground) =
        when (connectionState) {
            ConnectionState.Connected ->
                Triple(
                    stringResource(R.string.connection_connected),
                    semantic.successContainer,
                    semantic.onSuccessContainer,
                )
            ConnectionState.Reconnecting ->
                Triple(
                    stringResource(R.string.connection_reconnecting),
                    semantic.warningContainer,
                    semantic.onWarningContainer,
                )
            ConnectionState.Offline ->
                Triple(
                    stringResource(R.string.connection_offline),
                    MaterialTheme.colorScheme.errorContainer,
                    MaterialTheme.colorScheme.onErrorContainer,
                )
        }
    Text(
        text = label,
        modifier =
            Modifier.background(background, GameShapes.pill)
                .padding(horizontal = GameSpacing.sm, vertical = GameSpacing.xs),
        color = foreground,
        style = MaterialTheme.typography.labelLarge,
        maxLines = 1,
    )
}
