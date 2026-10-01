package com.impostergame.designsystem

import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.theme.ImposterGameTheme
import org.junit.Rule
import org.junit.Test

class AccessibilityTest {
    @get:Rule val composeRule = createAndroidComposeRule<DesignSystemTestActivity>()

    @Test
    fun buttonMeetsMinimumTouchTarget() {
        composeRule.setContent { ImposterGameTheme { GameButton("Continue", onClick = {}) } }

        composeRule.onNodeWithText("Continue").assertHeightIsAtLeast(48.dp).assertIsDisplayed()
    }

    @Test
    fun avatarAnnouncesWebsiteIdentityAndSelection() {
        composeRule.setContent {
            ImposterGameTheme {
                PlayerAvatar(
                    transportId = "wolf",
                    size = 64.dp,
                    contentDescription = "Morgan",
                    selected = true,
                )
            }
        }

        composeRule
            .onNodeWithContentDescription("Morgan, Wolf, Selected")
            .assertIsSelected()
            .assertIsDisplayed()
    }
}
