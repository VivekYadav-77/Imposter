package com.impostergame.designsystem

import androidx.compose.foundation.layout.requiredSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.catalog.ComponentCatalog
import com.impostergame.designsystem.theme.ImposterGameTheme
import org.junit.Rule
import org.junit.Test

class DesignSystemScreenshotTest {
    @get:Rule val composeRule = createAndroidComposeRule<DesignSystemTestActivity>()

    @Test
    fun compactPortraitExposesPrimaryCatalogContent() {
        composeRule.setContent {
            ImposterGameTheme {
                ComponentCatalog(modifier = Modifier.requiredSize(width = 320.dp, height = 480.dp))
            }
        }

        composeRule.onNodeWithText("Design system").assertIsDisplayed()
        composeRule.onNodeWithText("Players").assertIsDisplayed()
        composeRule.onNodeWithText("Continue").assertIsDisplayed()
    }

    @Test
    fun compactLandscapeExposesBothCatalogPanes() {
        composeRule.setContent {
            ImposterGameTheme(darkTheme = true) {
                ComponentCatalog(modifier = Modifier.requiredSize(width = 700.dp, height = 400.dp))
            }
        }

        composeRule.onNodeWithText("Players").assertIsDisplayed()
        composeRule.onNodeWithText("Tasks").assertIsDisplayed()
    }
}
