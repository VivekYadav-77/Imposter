package com.impostergame.android.preferences

import android.animation.ValueAnimator
import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemeMode(val storedValue: String) {
    System("system"),
    Light("light"),
    Dark("dark");

    companion object {
        fun fromStored(value: String?): ThemeMode =
            entries.firstOrNull { it.storedValue == value } ?: System
    }
}

data class AppPreferences(
    val themeMode: ThemeMode = ThemeMode.System,
    val soundEnabled: Boolean = true,
    val hapticsEnabled: Boolean = true,
    val reduceMotion: Boolean = false,
    val highContrast: Boolean = false,
)

class AppPreferencesStore(context: Context) {
    private val preferences =
        context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val mutableState = MutableStateFlow(preferences.readState())
    private val listener =
        SharedPreferences.OnSharedPreferenceChangeListener { sharedPreferences, _ ->
            mutableState.value = sharedPreferences.readState()
        }

    val state: StateFlow<AppPreferences> = mutableState.asStateFlow()

    init {
        preferences.registerOnSharedPreferenceChangeListener(listener)
    }

    fun setThemeMode(value: ThemeMode) {
        preferences.edit { putString(KEY_THEME_MODE, value.storedValue) }
    }

    fun setSoundEnabled(value: Boolean) {
        preferences.edit { putBoolean(KEY_SOUND_ENABLED, value) }
    }

    fun setHapticsEnabled(value: Boolean) {
        preferences.edit { putBoolean(KEY_HAPTICS_ENABLED, value) }
    }

    fun setReduceMotion(value: Boolean) {
        preferences.edit { putBoolean(KEY_REDUCE_MOTION, value) }
    }

    fun setHighContrast(value: Boolean) {
        preferences.edit { putBoolean(KEY_HIGH_CONTRAST, value) }
    }

    private fun SharedPreferences.readState() =
        AppPreferences(
            themeMode = ThemeMode.fromStored(getString(KEY_THEME_MODE, null)),
            soundEnabled = getBoolean(KEY_SOUND_ENABLED, true),
            hapticsEnabled = getBoolean(KEY_HAPTICS_ENABLED, true),
            reduceMotion = getBoolean(KEY_REDUCE_MOTION, !ValueAnimator.areAnimatorsEnabled()),
            highContrast = getBoolean(KEY_HIGH_CONTRAST, false),
        )

    private companion object {
        const val PREFERENCES_NAME = "app-appearance"
        const val KEY_THEME_MODE = "theme-mode"
        const val KEY_SOUND_ENABLED = "sound-enabled"
        const val KEY_HAPTICS_ENABLED = "haptics-enabled"
        const val KEY_REDUCE_MOTION = "reduce-motion"
        const val KEY_HIGH_CONTRAST = "high-contrast"
    }
}
