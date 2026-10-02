package com.impostergame.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
    showSelfBadge: Boolean = true,
    presenceLabel: String? = null,
    selected: Boolean = false,
    enabled: Boolean = true,
    compact: Boolean = false,
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

    val semanticModifier =
        if (onSelected != null) {
            Modifier.semantics {
                stateDescription = if (selected) selectedDescription else notSelectedDescription
            }
        } else {
            Modifier
        }

    Surface(
        modifier =
            modifier.fillMaxWidth().then(selectionModifier).then(semanticModifier).semantics(
                mergeDescendants = true
            ) {},
        shape = GameShapes.card,
        color = if (selected) accent.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
        border =
            androidx.compose.foundation.BorderStroke(if (selected) 3.dp else 1.dp, borderColor),
    ) {
        Row(
            modifier =
                Modifier.heightIn(min = if (compact) 64.dp else 78.dp)
                    .padding(horizontal = 14.dp, vertical = if (compact) 8.dp else 10.dp),
            horizontalArrangement =
                Arrangement.spacedBy(if (compact) GameSpacing.sm else GameSpacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlayerAvatar(
                transportId = playerColorId,
                size = if (compact) 42.dp else 56.dp,
                contentDescription = nickname,
                status = status,
                selected = selected,
                decorative = true,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = nickname,
                    style =
                        if (compact) MaterialTheme.typography.titleMedium
                        else MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                Text(
                    text = presenceLabel?.let { "$colorName · $it" } ?: colorName,
                    style = MaterialTheme.typography.bodyMedium,
                    color =
                        if (presenceLabel == null) accent
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                if (isSelf && showSelfBadge)
                    StatusLabel(stringResource(R.string.player_status_self))
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
