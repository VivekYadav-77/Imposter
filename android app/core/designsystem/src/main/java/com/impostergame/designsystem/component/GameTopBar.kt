package com.impostergame.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.R
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.LocalGameSemanticColors

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
) {
    Surface(modifier = modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.surface) {
        BoxWithConstraints {
            val compact = maxWidth < 600.dp
            Row(
                modifier =
                    Modifier.fillMaxWidth()
                        .padding(horizontal = GameSpacing.md, vertical = GameSpacing.sm),
                horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = phase,
                        style = MaterialTheme.typography.titleLarge,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (!compact) {
                        Text(
                            text = nickname,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Text(
                    text = timerText,
                    modifier = Modifier.semantics { contentDescription = timerDescription },
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Black,
                )
                ConnectionPill(connectionState)
                PlayerAvatar(
                    transportId = playerColorId,
                    size = 44.dp,
                    contentDescription = nickname,
                )
            }
        }
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
