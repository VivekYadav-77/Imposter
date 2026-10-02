package com.impostergame.android.feedback

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import android.view.View
import com.impostergame.android.preferences.AppPreferences
import java.io.Closeable
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.sin

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
    private val applicationContext = context.applicationContext
    private val audioManager = context.applicationContext.getSystemService(AudioManager::class.java)
    private val vibrator: Vibrator? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            applicationContext.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION") applicationContext.getSystemService(Vibrator::class.java)
        }
    private val gate = GameFeedbackGate(android.os.SystemClock::elapsedRealtime)
    private val soundPlayer = WebsiteSoundPlayer(audioManager)
    private var foreground = false

    fun setForeground(value: Boolean) {
        foreground = value
    }

    fun emit(event: GameFeedbackEvent, preferences: AppPreferences, view: View) {
        if (!foreground) return
        if (!gate.shouldPlay(event)) return

        if (
            preferences.soundEnabled && audioManager.ringerMode == AudioManager.RINGER_MODE_NORMAL
        ) {
            soundPlayer.play(event.kind)
        }
        if (preferences.hapticsEnabled) {
            if (event.kind == GameFeedbackKind.Meeting && vibrator?.hasVibrator() == true) {
                val pattern = longArrayOf(0, 300, 100, 300, 140, 520, 120, 300)
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
                return
            }
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
        soundPlayer.close()
    }
}

private enum class Wave {
    Sine,
    Triangle,
    Saw,
    Square,
}

private data class ToneSpec(
    val frequency: Double,
    val start: Double,
    val duration: Double,
    val endFrequency: Double? = null,
    val gain: Double = 0.22,
    val wave: Wave = Wave.Sine,
    val attack: Double = 0.015,
)

private data class NoiseSpec(
    val start: Double,
    val duration: Double,
    val gain: Double,
    val lowPass: Double,
)

/** PCM port of src/client/audio/game-sounds.ts. */
internal class WebsiteSoundPlayer(private val audioManager: AudioManager? = null) : Closeable {
    private val running = AtomicBoolean(true)
    private val executor = Executors.newSingleThreadExecutor { task ->
        Thread(task, "game-sound").apply { isDaemon = true }
    }
    private val cache = mutableMapOf<GameFeedbackKind, ShortArray>()
    private val focusListener = AudioManager.OnAudioFocusChangeListener {}
    private val focusRequest by lazy {
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            .setOnAudioFocusChangeListener(focusListener)
            .build()
    }

    fun play(kind: GameFeedbackKind) {
        if (!running.get()) return
        executor.execute {
            if (!running.get()) return@execute
            if (!requestAudioFocus()) return@execute
            val samples = cache.getOrPut(kind) { synthesize(kind) }
            val track =
                AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_GAME)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setSampleRate(SAMPLE_RATE)
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(samples.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()
            try {
                track.write(samples, 0, samples.size)
                track.play()
                Thread.sleep((samples.size * 1000L / SAMPLE_RATE) + 30L)
            } finally {
                track.stop()
                track.release()
                abandonAudioFocus()
            }
        }
    }

    override fun close() {
        running.set(false)
        executor.shutdownNow()
        cache.clear()
    }

    internal fun synthesizeForTest(kind: GameFeedbackKind): ShortArray = synthesize(kind)

    private fun synthesize(kind: GameFeedbackKind): ShortArray {
        val (tones, noises) = recipe(kind)
        val duration =
            maxOf(
                tones.maxOfOrNull { it.start + it.duration } ?: 0.1,
                noises.maxOfOrNull { it.start + it.duration } ?: 0.1,
            ) + 0.03
        val mix = DoubleArray((duration * SAMPLE_RATE).toInt())
        tones.forEach { tone -> mixTone(mix, tone) }
        noises.forEachIndexed { index, noise -> mixNoise(mix, noise, kind.ordinal * 31 + index) }
        val compressed = compressLikeWebsiteLimiter(mix)
        return ShortArray(compressed.size) { index ->
            val limited = compressed[index] * MASTER_GAIN
            (limited.coerceIn(-1.0, 1.0) * Short.MAX_VALUE).toInt().toShort()
        }
    }

    /** Mirrors the website DynamicsCompressor settings: -14dB, 18dB knee, 8:1, 3ms/220ms. */
    private fun compressLikeWebsiteLimiter(input: DoubleArray): DoubleArray {
        var envelope = 0.0
        val attack = exp(-1.0 / (SAMPLE_RATE * 0.003))
        val release = exp(-1.0 / (SAMPLE_RATE * 0.22))
        return DoubleArray(input.size) { index ->
            val level = kotlin.math.abs(input[index])
            val coefficient = if (level > envelope) attack else release
            envelope = coefficient * envelope + (1.0 - coefficient) * level
            val inputDb = 20.0 * log10(envelope.coerceAtLeast(1e-9))
            val lower = COMPRESSOR_THRESHOLD_DB - COMPRESSOR_KNEE_DB / 2.0
            val upper = COMPRESSOR_THRESHOLD_DB + COMPRESSOR_KNEE_DB / 2.0
            val outputDb =
                when {
                    inputDb <= lower -> inputDb
                    inputDb >= upper ->
                        COMPRESSOR_THRESHOLD_DB +
                            (inputDb - COMPRESSOR_THRESHOLD_DB) / COMPRESSOR_RATIO
                    else -> {
                        val distance = inputDb - lower
                        inputDb +
                            (1.0 / COMPRESSOR_RATIO - 1.0) * distance * distance /
                                (2.0 * COMPRESSOR_KNEE_DB)
                    }
                }
            input[index] * 10.0.pow((outputDb - inputDb) / 20.0)
        }
    }

    private fun requestAudioFocus(): Boolean {
        val manager = audioManager ?: return true
        val result = manager.requestAudioFocus(focusRequest)
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonAudioFocus() {
        val manager = audioManager ?: return
        manager.abandonAudioFocusRequest(focusRequest)
    }

    private fun mixTone(output: DoubleArray, spec: ToneSpec) {
        val startSample = (spec.start * SAMPLE_RATE).toInt()
        val count = (spec.duration * SAMPLE_RATE).toInt()
        var phase = 0.0
        repeat(count) { local ->
            val progress = local.toDouble() / count.coerceAtLeast(1)
            val frequency =
                spec.endFrequency?.let { spec.frequency * Math.pow(it / spec.frequency, progress) }
                    ?: spec.frequency
            phase += frequency / SAMPLE_RATE
            val raw =
                when (spec.wave) {
                    Wave.Sine -> sin(2.0 * PI * phase)
                    Wave.Triangle ->
                        2.0 * kotlin.math.abs(2.0 * (phase - kotlin.math.floor(phase + 0.5))) - 1.0
                    Wave.Saw -> 2.0 * (phase - kotlin.math.floor(phase + 0.5))
                    Wave.Square -> if (sin(2.0 * PI * phase) >= 0.0) 1.0 else -1.0
                }
            val elapsed = local.toDouble() / SAMPLE_RATE
            val envelope =
                if (elapsed < spec.attack) elapsed / spec.attack
                else
                    exp(
                        -7.7 * (elapsed - spec.attack) /
                            (spec.duration - spec.attack).coerceAtLeast(0.001)
                    )
            val target = startSample + local
            if (target in output.indices) output[target] += raw * envelope * spec.gain
        }
    }

    private fun mixNoise(output: DoubleArray, spec: NoiseSpec, seedValue: Int) {
        var seed = seedValue.toLong().coerceAtLeast(1L)
        var filtered = 0.0
        val alpha =
            (2.0 * PI * spec.lowPass / (2.0 * PI * spec.lowPass + SAMPLE_RATE)).coerceIn(0.0, 1.0)
        val startSample = (spec.start * SAMPLE_RATE).toInt()
        val count = (spec.duration * SAMPLE_RATE).toInt()
        repeat(count) { local ->
            seed = (seed * 1664525L + 1013904223L) and 0xffffffffL
            val raw = (seed.toDouble() / 0xffffffffL.toDouble()) * 2.0 - 1.0
            filtered += alpha * (raw - filtered)
            val envelope = exp(-7.7 * local / count.coerceAtLeast(1).toDouble())
            val target = startSample + local
            if (target in output.indices) output[target] += filtered * envelope * spec.gain
        }
    }

    private fun recipe(kind: GameFeedbackKind): Pair<List<ToneSpec>, List<NoiseSpec>> {
        fun chord(values: List<Double>, step: Double, duration: Double, gain: Double, wave: Wave) =
            values.mapIndexed { i, value ->
                ToneSpec(value, i * step, duration, gain = gain, wave = wave)
            }
        return when (kind) {
            GameFeedbackKind.Ui ->
                listOf(ToneSpec(420.0, 0.0, 0.07, 620.0, 0.08, Wave.Triangle)) to emptyList()
            GameFeedbackKind.RoleCrew ->
                chord(listOf(261.63, 329.63, 392.0), 0.09, 0.32, 0.12, Wave.Triangle) to emptyList()
            GameFeedbackKind.RoleImposter ->
                listOf(
                    ToneSpec(110.0, 0.0, 0.75, 55.0, 0.28, Wave.Saw),
                    ToneSpec(116.5, 0.04, 0.66, 58.0, 0.12, Wave.Square),
                ) to listOf(NoiseSpec(0.0, 0.42, 0.07, 500.0))
            GameFeedbackKind.PlayerJoin ->
                listOf(
                    ToneSpec(440.0, 0.0, 0.11, 587.33, 0.10, Wave.Triangle),
                    ToneSpec(659.25, 0.1, 0.2, 783.99, 0.12),
                ) to emptyList()
            GameFeedbackKind.GameStart ->
                chord(listOf(196.0, 293.66, 392.0, 587.33), 0.095, 0.38, 0.13, Wave.Saw) to
                    listOf(NoiseSpec(0.0, 0.16, 0.08, 1500.0))
            GameFeedbackKind.Meeting -> {
                val tones = mutableListOf(ToneSpec(92.0, 0.0, 2.12, 78.0, 0.09, Wave.Sine, 0.03))
                val noises = mutableListOf<NoiseSpec>()
                repeat(5) { i ->
                    val start = i * 0.4
                    val high = if (i % 2 == 0) 980.0 else 760.0
                    tones +=
                        ToneSpec(
                            high,
                            start,
                            0.31,
                            if (i % 2 == 0) 650.0 else 1040.0,
                            0.28,
                            Wave.Saw,
                            0.018,
                        )
                    tones +=
                        ToneSpec(
                            high / 2,
                            start,
                            0.31,
                            if (i % 2 == 0) 325.0 else 520.0,
                            0.16,
                            Wave.Square,
                            0.018,
                        )
                    noises += NoiseSpec(start, 0.25, 0.045, 1350.0)
                }
                tones to noises
            }
            GameFeedbackKind.Vote ->
                listOf(
                    ToneSpec(190.0, 0.0, 0.12, 120.0, 0.2, Wave.Triangle),
                    ToneSpec(760.0, 0.07, 0.09, gain = 0.08),
                ) to emptyList()
            GameFeedbackKind.VoteSelect ->
                listOf(ToneSpec(520.0, 0.0, 0.08, 650.0, 0.07, Wave.Triangle)) to emptyList()
            GameFeedbackKind.VoteLock ->
                listOf(
                    ToneSpec(180.0, 0.0, 0.11, 120.0, 0.13, Wave.Triangle),
                    ToneSpec(680.0, 0.08, 0.13, 880.0, 0.1),
                ) to emptyList()
            GameFeedbackKind.UploadStart ->
                listOf(ToneSpec(280.0, 0.0, 0.1, 420.0, 0.07, Wave.Triangle)) to emptyList()
            GameFeedbackKind.UploadFailure ->
                listOf(
                    ToneSpec(210.0, 0.0, 0.18, 130.0, 0.12, Wave.Saw),
                    ToneSpec(145.0, 0.13, 0.2, gain = 0.08, wave = Wave.Triangle),
                ) to emptyList()
            GameFeedbackKind.Upload ->
                chord(listOf(330.0, 440.0, 660.0), 0.08, 0.16, 0.1, Wave.Triangle) to emptyList()
            GameFeedbackKind.TaskComplete ->
                chord(listOf(523.25, 659.25, 783.99), 0.1, 0.38, 0.12, Wave.Sine) to emptyList()
            GameFeedbackKind.Kill ->
                listOf(ToneSpec(150.0, 0.0, 0.5, 42.0, 0.3, Wave.Saw)) to
                    listOf(NoiseSpec(0.0, 0.18, 0.22, 1800.0))
            GameFeedbackKind.Eliminated ->
                chord(listOf(293.66, 220.0, 146.83), 0.16, 0.42, 0.14, Wave.Triangle) to emptyList()
            GameFeedbackKind.CooldownReady ->
                listOf(
                    ToneSpec(660.0, 0.0, 0.14, gain = 0.09),
                    ToneSpec(880.0, 0.13, 0.2, gain = 0.12),
                ) to emptyList()
            GameFeedbackKind.Result ->
                listOf(
                    ToneSpec(196.0, 0.0, 0.85, 174.61, 0.2, Wave.Triangle),
                    ToneSpec(98.0, 0.0, 0.95, gain = 0.1),
                ) to emptyList()
            GameFeedbackKind.Victory ->
                chord(listOf(261.63, 329.63, 392.0, 523.25), 0.11, 0.55, 0.11, Wave.Triangle) to
                    emptyList()
            GameFeedbackKind.Defeat ->
                chord(listOf(261.63, 233.08, 196.0, 130.81), 0.15, 0.5, 0.13, Wave.Saw) to
                    emptyList()
            GameFeedbackKind.EasterEgg ->
                chord(listOf(880.0, 1174.66, 987.77, 1318.51), 0.07, 0.16, 0.09, Wave.Square) to
                    emptyList()
        }
    }

    private companion object {
        const val SAMPLE_RATE = 44_100
        const val MASTER_GAIN = 0.76
        const val COMPRESSOR_THRESHOLD_DB = -14.0
        const val COMPRESSOR_KNEE_DB = 18.0
        const val COMPRESSOR_RATIO = 8.0
    }
}
