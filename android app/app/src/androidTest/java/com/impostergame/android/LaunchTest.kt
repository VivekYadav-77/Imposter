package com.impostergame.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LaunchTest {
    @get:Rule val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun bootstrapShellLaunches() {
        composeRule.onNodeWithText("Getting things ready").assertIsDisplayed()
    }
}
