package com.impostergame.designsystem.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BrandThemeTest {
    @Test
    fun coreBrandTokensMatchWebsitePaletteExactly() {
        assertEquals(Color(0xFF0D0F0E), DarkColorScheme.background)
        assertEquals(Color(0xFFEF9C3D), DarkColorScheme.primary)
        assertEquals(Color(0xFFF5F2EB), LightColorScheme.background)
        assertEquals(Color(0xFFAE550B), LightColorScheme.primary)
        assertEquals(Color(0xFF4A6878), DarkBrandColors.lobby)
        assertEquals(Color(0xFFC9A227), DarkBrandColors.tasks)
        assertEquals(Color(0xFFA63F2B), DarkBrandColors.meeting)
        assertEquals(Color(0xFF426D48), DarkBrandColors.results)
        assertEquals(Color(0xFF3D6578), LightBrandColors.lobby)
        assertEquals(Color(0xFFC19A1C), LightBrandColors.tasks)
        assertEquals(Color(0xFF9C3928), LightBrandColors.meeting)
        assertEquals(Color(0xFF3E7047), LightBrandColors.results)
        assertEquals(Color(0xFFF5F2E9), DarkColorScheme.onBackground)
        assertEquals(Color(0xFFFFFDF8), LightColorScheme.surface)
        assertEquals(Color(0xFF8F4207), LightBrandColors.accentStrong)
        assertEquals(Color(0xFF5B4BC4), LightBrandColors.voting)
    }

    @Test
    fun websiteGeometryTypographyAndMotionRolesStayFrozen() {
        assertEquals(20.dp, WebsiteLayout.mobileGutter)
        assertEquals(90.dp, WebsiteLayout.heroBottom)
        assertEquals(278.dp, WebsiteLayout.journeyCardWidth)
        assertEquals(16.sp, GameTypography.bodyMedium.fontSize)
        assertEquals(25.sp, GameTypography.bodyMedium.lineHeight)
        assertEquals(72.sp, GameTypography.displayLarge.fontSize)
        assertEquals(120, GameMotion.QuickMillis)
        assertEquals(200, GameMotion.StandardMillis)
        assertEquals(480, GameMotion.EmphasisMillis)
        assertEquals(420, GameMotion.ProgressMillis)
        assertEquals(440, GameMotion.CompletionMillis)
        assertEquals(560, GameMotion.RevealMillis)
        assertEquals(45, GameMotion.StaggerMillis)
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
