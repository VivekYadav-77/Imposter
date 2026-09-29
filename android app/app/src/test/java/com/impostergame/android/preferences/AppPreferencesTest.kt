package com.impostergame.android.preferences

import org.junit.Assert.assertEquals
import org.junit.Test

class AppPreferencesTest {
    @Test
    fun unknownOrMissingThemeValueFallsBackToSystem() {
        assertEquals(ThemeMode.System, ThemeMode.fromStored(null))
        assertEquals(ThemeMode.System, ThemeMode.fromStored("unexpected"))
    }

    @Test
    fun everyThemeValueRoundTrips() {
        ThemeMode.entries.forEach { mode ->
            assertEquals(mode, ThemeMode.fromStored(mode.storedValue))
        }
    }
}
