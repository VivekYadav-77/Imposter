package com.impostergame.designsystem

import androidx.compose.foundation.layout.requiredSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.impostergame.designsystem.catalog.ComponentCatalog
import com.impostergame.designsystem.theme.ImposterGameTheme
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class DesignSystemScreenshotTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun compactPortraitRendersAVisuallyNonEmptyCatalog() {
        composeRule.setContent {
            ImposterGameTheme {
                ComponentCatalog(modifier = Modifier.requiredSize(width = 320.dp, height = 480.dp))
            }
        }

        val bitmap = composeRule.onRoot().captureToImage().asAndroidBitmap()
        assertTrue(bitmap.width > 0)
        assertTrue(bitmap.height > bitmap.width)
        assertNotEquals(bitmap.getPixel(0, 0), bitmap.getPixel(bitmap.width / 2, bitmap.height / 2))
    }

    @Test
    fun compactLandscapeRendersAVisuallyNonEmptyTwoPaneCatalog() {
        composeRule.setContent {
            ImposterGameTheme(darkTheme = true) {
                ComponentCatalog(modifier = Modifier.requiredSize(width = 480.dp, height = 320.dp))
            }
        }

        val bitmap = composeRule.onRoot().captureToImage().asAndroidBitmap()
        assertTrue(bitmap.width > bitmap.height)
        assertNotEquals(bitmap.getPixel(0, 0), bitmap.getPixel(bitmap.width / 2, bitmap.height / 2))
    }
}
