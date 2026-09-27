package com.impostergame.designsystem.avatar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
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

    Box(
        modifier =
            modifier
                .size(size)
                .semantics(mergeDescendants = true) {
                    this.contentDescription = fullDescription
                    this.selected = selected
                }
                .background(MaterialTheme.colorScheme.surfaceVariant, CircleShape)
                .border(if (selected) 3.dp else 1.dp, outline, CircleShape)
                .padding(size * 0.12f),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_crewmate),
            contentDescription = null,
            tint = avatarColor,
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
