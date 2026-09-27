package com.impostergame.designsystem.catalog

import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.adaptive.AdaptiveGameScaffold
import com.impostergame.designsystem.avatar.PlayerStatus
import com.impostergame.designsystem.component.BannerKind
import com.impostergame.designsystem.component.ConnectionState
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.component.GameButtonStyle
import com.impostergame.designsystem.component.GameOutlinedButton
import com.impostergame.designsystem.component.GameTopBar
import com.impostergame.designsystem.component.PlayerCard
import com.impostergame.designsystem.component.StatusBanner
import com.impostergame.designsystem.component.TaskCard
import com.impostergame.designsystem.component.UploadState
import com.impostergame.designsystem.theme.GameAccessibilityPreferences
import com.impostergame.designsystem.theme.GameSpacing
import com.impostergame.designsystem.theme.ImposterGameTheme

@Composable
fun ComponentCatalog(
    modifier: Modifier = Modifier,
    occludingVerticalHingeWidth: androidx.compose.ui.unit.Dp = 0.dp,
) {
    AdaptiveGameScaffold(
        modifier = modifier,
        topBar = {
            GameTopBar(
                phase = "Design system",
                timerText = "01:42",
                timerDescription = "1 minute 42 seconds remaining",
                nickname = "Morgan",
                playerColorId = "wolf",
                connectionState = ConnectionState.Connected,
            )
        },
        primaryPane = { CatalogContent() },
        supportingPane = { SupportingCatalog() },
        bottomAction = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(GameSpacing.sm),
            ) {
                GameOutlinedButton("Back", onClick = {}, modifier = Modifier.weight(1f))
                GameButton("Continue", onClick = {}, modifier = Modifier.weight(1f))
            }
        },
        occludingVerticalHingeWidth = occludingVerticalHingeWidth,
    )
}

@Composable
private fun CatalogContent() {
    Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
    ) {
        Text("Players", style = MaterialTheme.typography.headlineLarge)
        PlayerCard(
            nickname = "Morgan",
            playerColorId = "wolf",
            isSelf = true,
            selected = true,
            onSelected = {},
        )
        PlayerCard(
            nickname = "Avery",
            playerColorId = "moth",
            isHost = true,
            status = PlayerStatus.Disconnected,
        )
        PlayerCard(
            nickname = "Riley",
            playerColorId = "bull",
            status = PlayerStatus.Ejected,
        )
        Text("Messages", style = MaterialTheme.typography.headlineLarge)
        StatusBanner("Room state is synchronized.", kind = BannerKind.Success)
        StatusBanner(
            "Connection is unstable. Actions will be rechecked.",
            kind = BannerKind.Warning,
        )
        StatusBanner(
            "Your session ended on another device.",
            kind = BannerKind.Error,
            assertive = true,
        )
    }
}

@Composable
private fun SupportingCatalog() {
    Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(GameSpacing.md),
    ) {
        Text("Tasks", style = MaterialTheme.typography.headlineLarge)
        TaskCard(
            title = "Document the control panel",
            description = "Take one clear photo and wait for server confirmation.",
            uploadState = UploadState.Uploading,
        )
        TaskCard(
            title = "Align the markers",
            description = "The server accepted this evidence.",
            uploadState = UploadState.Complete,
        )
        GameButton("Primary action", onClick = {}, modifier = Modifier.fillMaxWidth())
        GameButton(
            "Secondary action",
            onClick = {},
            modifier = Modifier.fillMaxWidth(),
            style = GameButtonStyle.Secondary,
        )
        GameButton(
            "Dangerous action",
            onClick = {},
            modifier = Modifier.fillMaxWidth(),
            style = GameButtonStyle.Destructive,
        )
    }
}

@Preview(name = "Compact portrait", widthDp = 360, heightDp = 800, showBackground = true)
@Composable
private fun CompactPortraitPreview() {
    ImposterGameTheme { ComponentCatalog() }
}

@Preview(name = "Compact landscape", widthDp = 800, heightDp = 360, showBackground = true)
@Composable
private fun CompactLandscapePreview() {
    ImposterGameTheme { ComponentCatalog() }
}

@Preview(name = "Medium foldable", widthDp = 700, heightDp = 900, showBackground = true)
@Composable
private fun MediumPreview() {
    ImposterGameTheme { ComponentCatalog() }
}

@Preview(name = "Foldable with hinge", widthDp = 900, heightDp = 700, showBackground = true)
@Composable
private fun HingePreview() {
    ImposterGameTheme { ComponentCatalog(occludingVerticalHingeWidth = 28.dp) }
}

@Preview(name = "Expanded tablet", widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
private fun ExpandedPreview() {
    ImposterGameTheme { ComponentCatalog() }
}

@Preview(
    name = "150 percent text",
    widthDp = 600,
    heightDp = 800,
    fontScale = 1.5f,
    showBackground = true,
)
@Composable
private fun LargeTextPreview() {
    ImposterGameTheme { ComponentCatalog() }
}

@Preview(
    name = "Dark 200 percent text",
    widthDp = 800,
    heightDp = 600,
    fontScale = 2f,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
private fun LargeTextDarkPreview() {
    ImposterGameTheme(
        darkTheme = true,
        accessibilityPreferences =
            GameAccessibilityPreferences(
                reduceMotion = true,
                soundEnabled = false,
                hapticsEnabled = false,
                highContrast = true,
            ),
    ) {
        ComponentCatalog(modifier = Modifier.padding(0.dp))
    }
}

@Preview(
    name = "RTL compact",
    widthDp = 360,
    heightDp = 800,
    locale = "ar",
    showBackground = true,
)
@Composable
private fun RtlPreview() {
    ImposterGameTheme { ComponentCatalog() }
}
