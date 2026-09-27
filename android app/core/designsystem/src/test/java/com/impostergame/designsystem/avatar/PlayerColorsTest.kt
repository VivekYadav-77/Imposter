package com.impostergame.designsystem.avatar

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayerColorsTest {
    @Test
    fun allLegacyTransportIdsHaveOneStableUniqueSlot() {
        val expectedIds =
            listOf(
                "fox",
                "owl",
                "wolf",
                "raven",
                "moth",
                "cobra",
                "stag",
                "hare",
                "panther",
                "shark",
                "bull",
                "gecko",
                "beetle",
                "spider",
                "bat",
                "raccoon",
                "lynx",
                "falcon",
            )

        assertEquals(expectedIds, PlayerColors.all.map(PlayerColor::transportId))
        assertEquals(expectedIds.size, PlayerColors.all.map(PlayerColor::light).distinct().size)
        assertEquals(expectedIds.size, PlayerColors.all.map(PlayerColor::dark).distinct().size)
    }

    @Test
    fun unknownTransportIdDoesNotExposeTheWireValueAsAName() {
        val result = PlayerColors.fromTransportId("unexpected-wire-value")

        assertEquals(PlayerColors.unknown, result)
        assertNotEquals("unexpected-wire-value", result.transportId)
    }

    @Test
    fun everySlotHasDifferentLightAndDarkRenderingColors() {
        assertTrue(PlayerColors.all.all { it.light != it.dark })
    }

    @Test
    fun everySlotExceedsTextContrastAgainstItsThemeBackground() {
        val lightBackground = Color(0xFFFAFAFD)
        val darkBackground = Color(0xFF090B10)

        PlayerColors.all.forEach { slot ->
            assertTrue(
                "${slot.transportId} light contrast",
                slot.light.contrastAgainst(lightBackground) >= 4.5f,
            )
            assertTrue(
                "${slot.transportId} dark contrast",
                slot.dark.contrastAgainst(darkBackground) >= 4.5f,
            )
        }
    }

    @Test
    fun commonColorVisionSimulationsKeepSlotsMechanicallyDistinct() {
        val simulations =
            listOf(
                floatArrayOf(0.567f, 0.433f, 0f, 0.558f, 0.442f, 0f, 0f, 0.242f, 0.758f),
                floatArrayOf(0.625f, 0.375f, 0f, 0.7f, 0.3f, 0f, 0f, 0.3f, 0.7f),
                floatArrayOf(0.95f, 0.05f, 0f, 0f, 0.433f, 0.567f, 0f, 0.475f, 0.525f),
            )

        simulations.forEach { matrix ->
            val simulated = PlayerColors.all.map { it.light.simulate(matrix) }
            assertEquals(PlayerColors.all.size, simulated.distinct().size)
        }
    }

    private fun Color.contrastAgainst(other: Color): Float {
        val lighter = maxOf(luminance(), other.luminance())
        val darker = minOf(luminance(), other.luminance())
        return (lighter + 0.05f) / (darker + 0.05f)
    }

    private fun Color.simulate(matrix: FloatArray): Triple<Int, Int, Int> =
        Triple(
            ((red * matrix[0] + green * matrix[1] + blue * matrix[2]) * 255).toInt(),
            ((red * matrix[3] + green * matrix[4] + blue * matrix[5]) * 255).toInt(),
            ((red * matrix[6] + green * matrix[7] + blue * matrix[8]) * 255).toInt(),
        )
}
