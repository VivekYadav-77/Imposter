package com.impostergame.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.luminance
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
    val playerColor = PlayerColors.fromTransportId(playerColorId)
    val colorName = stringResource(playerColor.nameResource)
    val accent =
        if (MaterialTheme.colorScheme.background.luminance() < 0.5f) playerColor.dark
        else playerColor.light
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
        color = if (selected) accent.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surface,
        tonalElevation = if (selected) 3.dp else 1.dp,
        border =
            androidx.compose.foundation.BorderStroke(if (selected) 3.dp else 1.dp, borderColor),
    ) {
        Row(
            modifier = Modifier.padding(GameSpacing.md),
            horizontalArrangement = Arrangement.spacedBy(GameSpacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.width(4.dp).height(48.dp).background(accent, GameShapes.pill))
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
                    color = accent,
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
    SignalChip(label)
}
