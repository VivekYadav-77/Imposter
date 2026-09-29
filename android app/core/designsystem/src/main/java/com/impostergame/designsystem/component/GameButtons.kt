package com.impostergame.designsystem.component

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.R
import com.impostergame.designsystem.theme.GameMotion
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameTouchTarget
import com.impostergame.designsystem.theme.LocalGameAccessibilityPreferences

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
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val reduceMotion = LocalGameAccessibilityPreferences.current.reduceMotion
    val scale by
        animateFloatAsState(
            targetValue = if (pressed && !reduceMotion) 0.975f else 1f,
            animationSpec = tween(if (reduceMotion) 0 else GameMotion.QuickMillis),
            label = "gameButtonScale",
        )
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
            .scale(scale)
            .semantics {
                if (loading) stateDescription = loadingDescription
            }

    when (style) {
        GameButtonStyle.Primary ->
            Button(
                onClick = onClick,
                modifier = buttonModifier,
                enabled = enabled && !loading,
                interactionSource = interactionSource,
                shape = GameShapes.pill,
                elevation =
                    ButtonDefaults.buttonElevation(
                        defaultElevation = 3.dp,
                        pressedElevation = 0.dp,
                    ),
                content = { content() },
            )
        GameButtonStyle.Secondary ->
            FilledTonalButton(
                onClick = onClick,
                modifier = buttonModifier,
                enabled = enabled && !loading,
                interactionSource = interactionSource,
                shape = GameShapes.pill,
                content = { content() },
            )
        GameButtonStyle.Destructive ->
            Button(
                onClick = onClick,
                modifier = buttonModifier,
                enabled = enabled && !loading,
                interactionSource = interactionSource,
                shape = GameShapes.pill,
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
        shape = GameShapes.pill,
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
