package com.impostergame.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.compositeOver
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
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = phaseColor.copy(alpha = 0.14f).compositeOver(MaterialTheme.colorScheme.surface),
        shadowElevation = 12.dp,
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val compact = maxWidth < 600.dp
            Column {
                Row(
                    modifier =
                        Modifier.fillMaxWidth()
                            .padding(
                                horizontal = WebsiteLayout.phaseBarHorizontal,
                                vertical = WebsiteLayout.phaseBarVertical,
                            ),
                    horizontalArrangement =
                        Arrangement.spacedBy(if (compact) 6.dp else GameSpacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (navigationLabel != null && onNavigationClick != null) {
                        GameIconButton(onNavigationClick, "Back to $navigationLabel") {
                            Text("←", style = MaterialTheme.typography.titleLarge)
                        }
                    }
                    Text(
                        text = phase.uppercase(),
                        modifier = Modifier.semantics { contentDescription = phase },
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (timerText.isNotBlank()) {
                        Text(
                            text = timerText,
                            modifier =
                                Modifier.border(0.dp, MaterialTheme.colorScheme.outlineVariant)
                                    .semantics { contentDescription = timerDescription },
                            style =
                                if (compact) MaterialTheme.typography.titleLarge
                                else MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Black,
                            maxLines = 1,
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    PlayerAvatar(
                        transportId = playerColorId,
                        size = WebsiteLayout.phaseControl,
                        contentDescription = nickname,
                        status =
                            if (connectionState == ConnectionState.Connected) null
                            else PlayerStatus.Disconnected,
                    )
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
                Spacer(Modifier.fillMaxWidth().height(2.dp).background(phaseColor))
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
