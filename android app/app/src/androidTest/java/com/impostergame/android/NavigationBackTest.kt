package com.impostergame.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.espresso.Espresso.pressBack
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.impostergame.session.AndroidKeystoreSessionStore
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.ExternalResource
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NavigationBackTest {
    @get:Rule(order = 0)
    val clearSessionRule =
        object : ExternalResource() {
            override fun before() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext
                runBlocking { AndroidKeystoreSessionStore(context).clear() }
            }
        }

    @get:Rule(order = 1) val composeRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun awaitHome() {
        composeRule.waitUntil(timeoutMillis = 10_000) {
            composeRule.onAllNodesWithText("Start a room  →").fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun deviceBackFromJoinReturnsHomeWithoutClosingActivity() {
        composeRule.onNodeWithText("Menu").performClick()
        composeRule.onNodeWithText("Join a room").performClick()
        composeRule.onNodeWithText("←  Back home").assertIsDisplayed()

        pressBack()

        composeRule.onNodeWithText("Everyone’s watching.").assertIsDisplayed()
    }

    @Test
    fun labeledBackButtonFromJoinReturnsHome() {
        composeRule.onNodeWithText("Menu").performClick()
        composeRule.onNodeWithText("Join a room").performClick()

        composeRule.onNodeWithText("←  Back home").performClick()

        composeRule.onNodeWithText("Everyone’s watching.").assertIsDisplayed()
    }

    @Test
    fun colorChoiceOwnsItsLabelAndActionOnOneSemanticNode() {
        composeRule.onNodeWithText("Start a room  →").performClick()
        composeRule.onNodeWithText("Choose an operative").performClick()

        composeRule
            .onNode(
                hasContentDescription("Fox") and hasClickAction(),
                useUnmergedTree = true,
            )
            .assertExists()
    }
}
