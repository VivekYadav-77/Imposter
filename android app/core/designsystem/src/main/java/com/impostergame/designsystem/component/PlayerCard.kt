package com.impostergame.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.R
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.avatar.PlayerColors
import com.impostergame.designsystem.avatar.PlayerStatus
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.LocalGameSemanticColors

@Composable
fun PlayerCard(
    nickname: String,
    playerColorId: String,
    modifier: Modifier = Modifier,
    status: PlayerStatus? = null,
    isHost: Boolean = false,
    isSelf: Boolean = false,
    selected: Boolean = false,
    enabled: Boolean = true,
    onSelected: (() -> Unit)? = null,
) {
    val colorName = stringResource(PlayerColors.fromTransportId(playerColorId).nameResource)
    val selectedDescription = stringResource(R.string.player_status_selected)
    val notSelectedDescription = stringResource(R.string.state_not_selected)
    val selectionModifier =
        if (onSelected != null) {
            Modifier.selectable(
                selected = selected,
                enabled = enabled,
                role = Role.RadioButton,
                onClick = onSelected,
            )
        } else {
            Modifier
        }
    val borderColor =
        if (selected) LocalGameSemanticColors.current.focus
        else MaterialTheme.colorScheme.outlineVariant

    Surface(
        modifier =
            modifier.fillMaxWidth().then(selectionModifier).semantics {
                stateDescription = if (selected) selectedDescription else notSelectedDescription
            },
        shape = GameShapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border =
            androidx.compose.foundation.BorderStroke(if (selected) 3.dp else 1.dp, borderColor),
    ) {
        Row(
            modifier = Modifier.padding(GameSpacing.md),
            horizontalArrangement = Arrangement.spacedBy(GameSpacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlayerAvatar(
                transportId = playerColorId,
                size = 56.dp,
                contentDescription = nickname,
                status = status,
                selected = selected,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = nickname,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                Text(
                    text = colorName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                if (isSelf) StatusLabel(stringResource(R.string.player_status_self))
                if (isHost) StatusLabel(stringResource(R.string.player_status_host))
                if (status != null) StatusLabel(stringResource(status.descriptionResource))
            }
        }
    }
}

@Composable
private fun StatusLabel(label: String) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
    )
}
