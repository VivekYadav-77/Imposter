package com.impostergame.designsystem.component

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
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
    retainPrimaryWhenDisabled: Boolean = false,
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
                colors =
                    if (retainPrimaryWhenDisabled) {
                        ButtonDefaults.buttonColors(
                            disabledContainerColor =
                                MaterialTheme.colorScheme.primary.copy(alpha = .55f),
                            disabledContentColor =
                                MaterialTheme.colorScheme.onPrimary.copy(alpha = .78f),
                        )
                    } else {
                        ButtonDefaults.buttonColors()
                    },
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

/** Website-equivalent white Google action used by account and guest-upgrade prompts. */
@Composable
fun GoogleSignInButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    Button(
        onClick = onClick,
        modifier =
            modifier.defaultMinSize(
                minWidth = GameTouchTarget.minimum,
                minHeight = GameTouchTarget.minimum,
            ),
        enabled = enabled && !loading,
        shape = GameShapes.pill,
        border = BorderStroke(1.dp, Color(0xFFDADCE0)),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = Color.White,
                contentColor = Color(0xFF202124),
                disabledContainerColor = Color(0xFFF1F3F4),
                disabledContentColor = Color(0xFF5F6368),
            ),
        elevation =
            ButtonDefaults.buttonElevation(defaultElevation = 1.dp, pressedElevation = 0.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = Color(0xFF4285F4),
                )
            } else {
                GoogleGMark()
            }
            Text("Continue with Google")
        }
    }
}

@Composable
private fun GoogleGMark() {
    Canvas(Modifier.size(18.dp)) {
        val stroke = Stroke(width = size.minDimension * .19f, cap = StrokeCap.Butt)
        val inset = size.minDimension * .14f
        val arcSize = Size(size.width - inset * 2, size.height - inset * 2)
        val topLeft = Offset(inset, inset)
        drawArc(Color(0xFF4285F4), -42f, 88f, false, topLeft, arcSize, style = stroke)
        drawArc(Color(0xFF34A853), 46f, 88f, false, topLeft, arcSize, style = stroke)
        drawArc(Color(0xFFFBBC05), 134f, 88f, false, topLeft, arcSize, style = stroke)
        drawArc(Color(0xFFEA4335), 222f, 96f, false, topLeft, arcSize, style = stroke)
        drawLine(
            Color(0xFF4285F4),
            start = Offset(size.width * .51f, size.height * .51f),
            end = Offset(size.width * .88f, size.height * .51f),
            strokeWidth = size.minDimension * .19f,
        )
    }
}

/** Consistent labeled navigation affordance for every non-root screen. */
@Composable
fun GameBackButton(
    label: String,
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
        Text("← $label")
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
