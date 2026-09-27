package com.impostergame.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.R
import com.impostergame.designsystem.theme.GameTouchTarget

enum class GameButtonStyle {
    Primary,
    Secondary,
    Destructive,
}

@Composable
fun GameButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: GameButtonStyle = GameButtonStyle.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val content: @Composable () -> Unit = {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = androidx.compose.material3.LocalContentColor.current,
                )
            }
            Text(text)
        }
    }
    val loadingDescription = stringResource(R.string.loading)
    val buttonModifier =
        modifier
            .defaultMinSize(minWidth = GameTouchTarget.minimum, minHeight = GameTouchTarget.minimum)
            .semantics {
                if (loading) stateDescription = loadingDescription
            }

    when (style) {
        GameButtonStyle.Primary ->
            Button(
                onClick = onClick,
                modifier = buttonModifier,
                enabled = enabled && !loading,
                content = { content() },
            )
        GameButtonStyle.Secondary ->
            FilledTonalButton(
                onClick = onClick,
                modifier = buttonModifier,
                enabled = enabled && !loading,
                content = { content() },
            )
        GameButtonStyle.Destructive ->
            Button(
                onClick = onClick,
                modifier = buttonModifier,
                enabled = enabled && !loading,
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError,
                    ),
                content = { content() },
            )
    }
}

@Composable
fun GameOutlinedButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        modifier =
            modifier.defaultMinSize(
                minWidth = GameTouchTarget.minimum,
                minHeight = GameTouchTarget.minimum,
            ),
        enabled = enabled,
    ) {
        Text(text)
    }
}

@Composable
fun GameIconButton(
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: @Composable () -> Unit,
) {
    IconButton(
        onClick = onClick,
        modifier =
            modifier
                .defaultMinSize(
                    minWidth = GameTouchTarget.minimum,
                    minHeight = GameTouchTarget.minimum,
                )
                .semantics { this.contentDescription = contentDescription },
        enabled = enabled,
        content = icon,
    )
}
