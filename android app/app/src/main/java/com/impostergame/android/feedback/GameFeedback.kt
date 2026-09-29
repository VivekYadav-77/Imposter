package com.impostergame.android.feedback

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import com.impostergame.android.preferences.AppPreferences
import java.io.Closeable

enum class GameFeedbackKind {
    Ui,
    RoleCrew,
    RoleImposter,
    PlayerJoin,
    GameStart,
    Meeting,
    Vote,
    VoteSelect,
    VoteLock,
    UploadStart,
    UploadFailure,
    Upload,
    TaskComplete,
    Kill,
    Eliminated,
    CooldownReady,
    Result,
    Victory,
    Defeat,
    EasterEgg,
}

data class GameFeedbackEvent(val kind: GameFeedbackKind, val stableId: String? = null)

class GameFeedbackController(context: Context) : Closeable {
    private val audioManager = context.applicationContext.getSystemService(AudioManager::class.java)
    private val gate = GameFeedbackGate(android.os.SystemClock::elapsedRealtime)
    private var foreground = false
    private var toneGenerator: ToneGenerator? = null

    fun setForeground(value: Boolean) {
        foreground = value
    }

    fun emit(event: GameFeedbackEvent, preferences: AppPreferences, view: View) {
        if (!foreground) return
        if (!gate.shouldPlay(event)) return

        if (
            preferences.soundEnabled && audioManager.ringerMode == AudioManager.RINGER_MODE_NORMAL
        ) {
            val (tone, duration) = event.kind.tone()
            val generator =
                toneGenerator
                    ?: ToneGenerator(AudioManager.STREAM_MUSIC, 55).also {
                        toneGenerator = it
                    }
            generator.startTone(tone, duration)
        }
        if (preferences.hapticsEnabled) {
            val haptic =
                when (event.kind) {
                    GameFeedbackKind.Meeting,
                    GameFeedbackKind.Eliminated,
                    GameFeedbackKind.UploadFailure -> HapticFeedbackConstants.LONG_PRESS
                    GameFeedbackKind.VoteLock,
                    GameFeedbackKind.TaskComplete,
                    GameFeedbackKind.Upload,
                    GameFeedbackKind.Victory,
                    GameFeedbackKind.Defeat ->
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            HapticFeedbackConstants.CONFIRM
                        } else {
                            HapticFeedbackConstants.VIRTUAL_KEY
                        }
                    else -> HapticFeedbackConstants.CLOCK_TICK
                }
            view.performHapticFeedback(haptic)
        }
    }

    override fun close() {
        toneGenerator?.release()
        toneGenerator = null
    }

    private fun GameFeedbackKind.tone(): Pair<Int, Int> =
        when (this) {
            GameFeedbackKind.Ui -> ToneGenerator.TONE_PROP_BEEP to 55
            GameFeedbackKind.RoleCrew -> ToneGenerator.TONE_PROP_ACK to 180
            GameFeedbackKind.RoleImposter -> ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD to 260
            GameFeedbackKind.PlayerJoin -> ToneGenerator.TONE_PROP_ACK to 100
            GameFeedbackKind.GameStart -> ToneGenerator.TONE_CDMA_ABBR_ALERT to 260
            GameFeedbackKind.Meeting -> ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD to 520
            GameFeedbackKind.Vote -> ToneGenerator.TONE_PROP_BEEP2 to 100
            GameFeedbackKind.VoteSelect -> ToneGenerator.TONE_PROP_BEEP to 70
            GameFeedbackKind.VoteLock -> ToneGenerator.TONE_PROP_ACK to 150
            GameFeedbackKind.UploadStart -> ToneGenerator.TONE_PROP_BEEP to 80
            GameFeedbackKind.UploadFailure -> ToneGenerator.TONE_PROP_NACK to 260
            GameFeedbackKind.Upload -> ToneGenerator.TONE_PROP_ACK to 130
            GameFeedbackKind.TaskComplete -> ToneGenerator.TONE_CDMA_CONFIRM to 180
            GameFeedbackKind.Kill -> ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE to 240
            GameFeedbackKind.Eliminated -> ToneGenerator.TONE_PROP_NACK to 320
            GameFeedbackKind.CooldownReady -> ToneGenerator.TONE_CDMA_CONFIRM to 120
            GameFeedbackKind.Result -> ToneGenerator.TONE_CDMA_ABBR_ALERT to 180
            GameFeedbackKind.Victory -> ToneGenerator.TONE_CDMA_CONFIRM to 360
            GameFeedbackKind.Defeat -> ToneGenerator.TONE_PROP_NACK to 360
            GameFeedbackKind.EasterEgg -> ToneGenerator.TONE_DTMF_9 to 280
        }
}
