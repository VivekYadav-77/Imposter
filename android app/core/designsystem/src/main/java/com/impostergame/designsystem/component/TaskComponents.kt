package com.impostergame.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.LocalGameSemanticColors
import com.impostergame.designsystem.theme.WebsiteLayout
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
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = GameShapes.task,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
        shadowElevation = 3.dp,
        border =
            androidx.compose.foundation.BorderStroke(
                1.dp,
                when (uploadState) {
                    UploadState.RetryableFailure -> LocalGameSemanticColors.current.warning
                    UploadState.TerminalFailure -> LocalGameSemanticColors.current.danger
                    else -> MaterialTheme.colorScheme.outlineVariant
                },
            ),
    ) {
        Row(modifier = Modifier.fillMaxWidth().heightIn(min = WebsiteLayout.taskCardMinHeight)) {
            Box(
                Modifier.width(4.dp)
                    .fillMaxHeight()
                    .background(
                        if (uploadState == UploadState.Complete)
                            LocalGameSemanticColors.current.success
                        else MaterialTheme.gameColors.tasks
                    )
            )
            taskNumber?.let {
                Surface(
                    modifier =
                        Modifier.padding(start = 10.dp, top = 12.dp).size(WebsiteLayout.taskNumber),
                    shape = GameShapes.small,
                    color = MaterialTheme.gameColors.tasks.copy(alpha = 0.16f),
                    contentColor = MaterialTheme.gameColors.tasks,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            it.toString().padStart(2, '0'),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Black,
                        )
                    }
                }
            }
            Column(
                modifier = Modifier.weight(1f).padding(horizontal = 10.dp, vertical = 11.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (uploadState != UploadState.Idle && uploadState != UploadState.Complete) {
                    UploadStateIndicator(uploadState)
                }
                statusLabel?.let {
                    val statusColor =
                        if (uploadState == UploadState.Complete)
                            LocalGameSemanticColors.current.success
                        else MaterialTheme.gameColors.tasks
                    Text(
                        it.uppercase(),
                        modifier =
                            Modifier.background(
                                    statusColor.copy(alpha = .08f),
                                    GameShapes.pill,
                                )
                                .border(1.dp, statusColor, GameShapes.pill)
                                .padding(horizontal = 9.dp, vertical = 3.dp),
                        color = statusColor,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Black,
                    )
                }
            }
            if (uploadState == UploadState.Complete || (actionLabel != null && onAction != null)) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    border =
                        androidx.compose.foundation.BorderStroke(
                            1.dp,
                            MaterialTheme.colorScheme.outlineVariant,
                        ),
                ) {
                    Box(
                        Modifier.width(WebsiteLayout.taskProofWidth).fillMaxHeight().padding(6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (uploadState == UploadState.Complete) {
                            GameGlyph(
                                GameGlyphKind.Check,
                                tint = LocalGameSemanticColors.current.success,
                                size = 24.dp,
                            )
                        } else {
                            Surface(
                                onClick = requireNotNull(onAction),
                                modifier =
                                    Modifier.size(48.dp).semantics {
                                        contentDescription = requireNotNull(actionLabel)
                                    },
                                shape = GameShapes.small,
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                border =
                                    androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        MaterialTheme.colorScheme.outlineVariant,
                                    ),
                                tonalElevation = 0.dp,
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    GameGlyph(
                                        GameGlyphKind.Evidence,
                                        tint = MaterialTheme.gameColors.tasks,
                                        size = 24.dp,
                                    )
                                }
                            }
                        }
                    }
                }
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
