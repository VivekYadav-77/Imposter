package com.impostergame.designsystem.component

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.os.Build
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.theme.GameShapes
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.LocalGameSemanticColors

enum class BannerKind {
    Info,
    Success,
    Warning,
    Error,
}

@Composable
fun StatusBanner(
    message: String,
    modifier: Modifier = Modifier,
    kind: BannerKind = BannerKind.Info,
    assertive: Boolean = false,
) {
    val semantic = LocalGameSemanticColors.current
    val (background, foreground) =
        when (kind) {
            BannerKind.Info ->
                MaterialTheme.colorScheme.primaryContainer to
                    MaterialTheme.colorScheme.onPrimaryContainer
            BannerKind.Success -> semantic.successContainer to semantic.onSuccessContainer
            BannerKind.Warning -> semantic.warningContainer to semantic.onWarningContainer
            BannerKind.Error ->
                MaterialTheme.colorScheme.errorContainer to
                    MaterialTheme.colorScheme.onErrorContainer
        }
    Text(
        text = message,
        modifier =
            modifier
                .fillMaxWidth()
                .background(background, GameShapes.medium)
                .padding(GameSpacing.md)
                .semantics {
                    liveRegion = if (assertive) LiveRegionMode.Assertive else LiveRegionMode.Polite
                },
        color = foreground,
        style = MaterialTheme.typography.bodyLarge,
    )
}

@Composable
fun InlineValidation(message: String, modifier: Modifier = Modifier) {
    Text(
        text = message,
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
fun GameSnackbar(
    message: String,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Snackbar(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        action = action,
    ) {
        Text(message)
    }
}

enum class StatePanelKind {
    Empty,
    Loading,
    Retry,
    Offline,
    SessionEnded,
    BlockingError,
}

@Composable
fun StatePanel(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    kind: StatePanelKind = StatePanelKind.Empty,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier =
            modifier.fillMaxWidth().widthIn(max = 560.dp).padding(GameSpacing.lg).semantics {
                if (kind == StatePanelKind.BlockingError || kind == StatePanelKind.SessionEnded) {
                    liveRegion = LiveRegionMode.Assertive
                }
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
    ) {
        if (kind == StatePanelKind.Loading) CircularProgressIndicator()
        Text(
            text = title,
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineLarge,
            textAlign = TextAlign.Center,
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (actionLabel != null && onAction != null) {
            GameButton(text = actionLabel, onClick = onAction)
        }
    }
}

@Composable
fun GameConfirmationDialog(
    title: String,
    message: String,
    confirmLabel: String,
    dismissLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    destructive: Boolean = false,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            GameButton(
                text = confirmLabel,
                onClick = onConfirm,
                style = if (destructive) GameButtonStyle.Destructive else GameButtonStyle.Primary,
            )
        },
        dismissButton = { GameOutlinedButton(text = dismissLabel, onClick = onDismiss) },
    )
}

@Composable
fun GameModalSheet(
    title: String,
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = state,
        modifier = Modifier.semantics { paneTitle = title },
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(GameSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
        ) {
            Text(title, style = MaterialTheme.typography.headlineLarge)
            content()
        }
    }
}

@Composable
fun SensitiveSurface(
    paneTitle: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val view = LocalView.current
    DisposableEffect(view) {
        val window = view.context.findActivity()?.window
        val wasSecure =
            ((window?.attributes?.flags ?: 0) and WindowManager.LayoutParams.FLAG_SECURE) != 0
        window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) window?.setHideOverlayWindows(true)
        onDispose {
            if (!wasSecure) window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) window?.setHideOverlayWindows(false)
        }
    }
    Box(
        modifier =
            modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).semantics {
                this.paneTitle = paneTitle
            },
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}

private tailrec fun Context.findActivity(): Activity? =
    when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }
