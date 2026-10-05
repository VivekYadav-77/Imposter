package com.impostergame.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.avatar.PlayerAvatar
import com.impostergame.designsystem.component.GameButton
import com.impostergame.designsystem.component.TaskCard
import com.impostergame.designsystem.theme.ImposterGameTheme
import org.junit.Assert.assertTrue
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

    @Test
    fun longTaskKeepsMetadataVisibleAndOpensFullTextAction() {
        var opened = false
        composeRule.setContent {
            ImposterGameTheme {
                TaskCard(
                    title =
                        "Find the nearest marked entrance, document every visible checkpoint, " +
                            "and take a selfie beside the final location without leaving the room",
                    description = "Hard task",
                    statusLabel = "To do",
                    onTitleClick = { opened = true },
                )
            }
        }

        composeRule.onNodeWithText("Hard task").assertIsDisplayed()
        composeRule.onNodeWithText("TO DO").assertIsDisplayed()
        composeRule.onNodeWithText("Read full task…").assertIsDisplayed().performClick()
        composeRule.runOnIdle { assertTrue(opened) }
    }

    @Test
    fun oversizedProofCannotIncreaseTaskCardHeight() {
        composeRule.setContent {
            ImposterGameTheme {
                TaskCard(
                    title = "Photograph the nearest entrance",
                    description = "Medium task",
                    statusLabel = "Done",
                    proofContentDescription = "Task proof",
                    proofContent = { Box(Modifier.width(70.dp).height(800.dp)) },
                )
            }
        }

        composeRule.onNodeWithContentDescription("Task proof").assertHeightIsEqualTo(92.dp)
        composeRule.onNodeWithText("Medium task").assertIsDisplayed()
        composeRule.onNodeWithText("DONE").assertIsDisplayed()
    }
}
