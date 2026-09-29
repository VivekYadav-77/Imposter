package com.impostergame.designsystem.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BrandThemeTest {
    @Test
    fun coreBrandTokensMatchApprovedWebsiteEquivalentPalette() {
        assertEquals(Color(0xFF0D0F0E), DarkColorScheme.background)
        assertEquals(Color(0xFFEF9C3D), DarkColorScheme.primary)
        assertEquals(Color(0xFFF5F2EB), LightColorScheme.background)
        assertEquals(Color(0xFFAE550B), LightColorScheme.primary)
        assertEquals(Color(0xFF27B8C8), DarkBrandColors.lobby)
        assertEquals(Color(0xFF36C889), DarkBrandColors.results)
    }

    @Test
    fun essentialTextPairsMeetNormalTextContrast() {
        listOf(
                DarkColorScheme.onBackground to DarkColorScheme.background,
                DarkColorScheme.onSurface to DarkColorScheme.surface,
                DarkColorScheme.onPrimary to DarkColorScheme.primary,
                LightColorScheme.onBackground to LightColorScheme.background,
                LightColorScheme.onSurface to LightColorScheme.surface,
                LightColorScheme.onPrimary to LightColorScheme.primary,
            )
            .forEach { (foreground, background) ->
                assertTrue(
                    "Expected contrast >= 4.5 but was ${contrast(foreground, background)}",
                    contrast(foreground, background) >= 4.5f,
                )
            }
    }

    private fun contrast(first: Color, second: Color): Float {
        val lighter = maxOf(first.luminance(), second.luminance())
        val darker = minOf(first.luminance(), second.luminance())
        return (lighter + 0.05f) / (darker + 0.05f)
    }
}
