package com.impostergame.designsystem.adaptive

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GameWindowClassTest {
    @Test
    fun compactPortraitUsesOnePane() {
        val result = GameWindowClass.calculate(width = 360.dp, height = 800.dp)

        assertEquals(GameWindowWidth.Compact, result.width)
        assertEquals(GameWindowHeight.Regular, result.height)
        assertFalse(result.usesTwoPanes)
    }

    @Test
    fun compactHeightLandscapeUsesTwoPanesWhenWidthAllows() {
        val result = GameWindowClass.calculate(width = 700.dp, height = 360.dp)

        assertEquals(GameWindowWidth.Medium, result.width)
        assertEquals(GameWindowHeight.Compact, result.height)
        assertTrue(result.usesTwoPanes)
    }

    @Test
    fun expandedWindowUsesTwoPanes() {
        assertTrue(GameWindowClass.calculate(width = 1200.dp, height = 800.dp).usesTwoPanes)
    }
}
