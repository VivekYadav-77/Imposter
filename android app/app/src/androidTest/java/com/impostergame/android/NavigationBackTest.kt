package com.impostergame.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.espresso.Espresso.pressBack
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NavigationBackTest {
    @get:Rule val composeRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun awaitHome() {
        composeRule.waitUntil(timeoutMillis = 10_000) {
            composeRule.onAllNodesWithText("Join a room  →").fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun deviceBackFromJoinReturnsHomeWithoutClosingActivity() {
        composeRule.onNodeWithText("Join a room  →").performClick()
        composeRule.onNodeWithText("← Home").assertIsDisplayed()

        pressBack()

        composeRule.onNodeWithText("Everyone’s watching.").assertIsDisplayed()
    }

    @Test
    fun labeledBackButtonFromJoinReturnsHome() {
        composeRule.onNodeWithText("Join a room  →").performClick()

        composeRule.onNodeWithText("← Home").performClick()

        composeRule.onNodeWithText("Everyone’s watching.").assertIsDisplayed()
    }
}
