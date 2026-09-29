package com.impostergame.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.R
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.LocalGameSemanticColors
import com.impostergame.designsystem.theme.gameColors

enum class UploadState {
    Idle,
    Preparing,
    RequestingIntent,
    Uploading,
    Confirming,
    Processing,
    Complete,
    RetryableFailure,
    TerminalFailure,
}

@Composable
fun TaskCard(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    uploadState: UploadState = UploadState.Idle,
    taskNumber: Int? = null,
    statusLabel: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    SignalCard(
        modifier = modifier.fillMaxWidth(),
        accent =
            when (uploadState) {
                UploadState.Complete -> LocalGameSemanticColors.current.success
                UploadState.RetryableFailure -> LocalGameSemanticColors.current.warning
                UploadState.TerminalFailure -> LocalGameSemanticColors.current.danger
                else -> MaterialTheme.gameColors.tasks
            },
        emphasized = uploadState !in setOf(UploadState.Idle, UploadState.Complete),
    ) {
        Column(
            modifier = Modifier.padding(GameSpacing.md),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.sm),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                taskNumber?.let {
                    Surface(
                        modifier = Modifier.size(44.dp),
                        shape = MaterialTheme.shapes.medium,
                        color = MaterialTheme.gameColors.tasks.copy(alpha = 0.16f),
                        contentColor = MaterialTheme.gameColors.tasks,
                    ) {
                        androidx.compose.foundation.layout.Box(
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                it.toString().padStart(2, '0'),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Black,
                            )
                        }
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Text(
                        description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                statusLabel?.let {
                    Surface(
                        shape = MaterialTheme.shapes.extraLarge,
                        color =
                            if (uploadState == UploadState.Complete) {
                                LocalGameSemanticColors.current.success.copy(alpha = 0.16f)
                            } else {
                                LocalGameSemanticColors.current.warning.copy(alpha = 0.16f)
                            },
                    ) {
                        Text(
                            it,
                            Modifier.padding(
                                horizontal = GameSpacing.sm,
                                vertical = GameSpacing.xs,
                            ),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
            UploadStateIndicator(uploadState)
            if (actionLabel != null && onAction != null) {
                GameButton(
                    text = actionLabel,
                    onClick = onAction,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
fun UploadStateIndicator(state: UploadState, modifier: Modifier = Modifier) {
    val semantic = LocalGameSemanticColors.current
    val labelResource =
        when (state) {
            UploadState.Idle -> R.string.upload_idle
            UploadState.Preparing -> R.string.upload_preparing
            UploadState.RequestingIntent -> R.string.upload_requesting_intent
            UploadState.Uploading -> R.string.upload_uploading
            UploadState.Confirming -> R.string.upload_confirming
            UploadState.Processing -> R.string.upload_processing
            UploadState.Complete -> R.string.upload_complete
            UploadState.RetryableFailure -> R.string.upload_retryable_failure
            UploadState.TerminalFailure -> R.string.upload_terminal_failure
        }
    val label = stringResource(labelResource)
    val working =
        state in
            setOf(
                UploadState.Preparing,
                UploadState.RequestingIntent,
                UploadState.Uploading,
                UploadState.Confirming,
                UploadState.Processing,
            )
    val color =
        when (state) {
            UploadState.Complete -> semantic.success
            UploadState.RetryableFailure -> semantic.warning
            UploadState.TerminalFailure -> semantic.danger
            else -> MaterialTheme.colorScheme.primary
        }

    Column(
        modifier = modifier.fillMaxWidth().semantics { contentDescription = label },
        verticalArrangement = Arrangement.spacedBy(GameSpacing.xs),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(GameSpacing.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (working)
                CircularProgressIndicator(modifier = Modifier.padding(2.dp), strokeWidth = 2.dp)
            Text(label, color = color, style = MaterialTheme.typography.labelLarge)
        }
        if (working) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
    }
}
