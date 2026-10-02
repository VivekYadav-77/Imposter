package com.impostergame.android

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PersistableBundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.CreationExtras
import com.impostergame.android.entry.EntryLobbyGateway
import com.impostergame.android.entry.EntryLobbyViewModel
import com.impostergame.android.entry.NetworkEntryLobbyGateway
import com.impostergame.android.entry.UnavailableEntryLobbyGateway
import com.impostergame.android.feedback.GameFeedbackController
import com.impostergame.android.feedback.GameFeedbackEvent
import com.impostergame.android.gameplay.EvidenceProcessor
import com.impostergame.android.gameplay.GameplayGateway
import com.impostergame.android.gameplay.GameplayViewModel
import com.impostergame.android.gameplay.NetworkGameplayGateway
import com.impostergame.android.gameplay.UnavailableGameplayGateway
import com.impostergame.android.preferences.AppPreferencesStore
import com.impostergame.android.ui.ImposterGameApp
import com.impostergame.data.network.ApiClient
import com.impostergame.data.network.ParticipantApi
import com.impostergame.data.network.SignedUploadClient
import com.impostergame.data.operations.SafeNetworkState
import com.impostergame.data.operations.SupportDiagnosticsBuffer
import com.impostergame.data.realtime.RealtimeProtocol
import com.impostergame.data.realtime.RealtimeSession
import com.impostergame.data.realtime.SocketIoRealtimeTransport
import com.impostergame.data.repository.ConnectivityRepository
import com.impostergame.data.repository.GameRepository
import com.impostergame.data.repository.PresenceRepository
import com.impostergame.data.repository.RoomRepository
import com.impostergame.data.session.StoredSession
import com.impostergame.session.AndroidKeystoreSessionStore
import java.net.URI
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl

class MainActivity : ComponentActivity() {
    private val sessionStore by lazy { AndroidKeystoreSessionStore(applicationContext) }
    private val appPreferences by lazy { AppPreferencesStore(applicationContext) }
    private val feedbackController by lazy { GameFeedbackController(applicationContext) }
    private val supportDiagnostics = SupportDiagnosticsBuffer()
    private val participantApi: ParticipantApi? by lazy {
        if (BuildConfig.API_BASE_URL.isBlank()) {
            null
        } else {
            ParticipantApi(
                ApiClient(
                    baseUrl = BuildConfig.API_BASE_URL.toHttpUrl(),
                    credentialProvider = {
                        (sessionStore.session.value as? StoredSession.Available)?.credential?.token
                    },
                    logger = supportDiagnostics,
                    allowInsecureLocalDebug = BuildConfig.DEBUG,
                )
            )
        }
    }
    private val roomRepository by lazy { participantApi?.let(::RoomRepository) }
    private val gameRepository by lazy { participantApi?.let(::GameRepository) }
    private val presenceRepository by lazy { PresenceRepository() }
    private val connectivityRepository by lazy { ConnectivityRepository() }
    private val realtimeSession: RealtimeSession? by lazy {
        val api = participantApi ?: return@lazy null
        val rooms = roomRepository ?: return@lazy null
        val games = gameRepository ?: return@lazy null
        RealtimeSession(
            scope = lifecycleScope,
            transport =
                SocketIoRealtimeTransport(
                    URI(BuildConfig.API_BASE_URL),
                    allowInsecureLocalDebug = BuildConfig.DEBUG,
                ),
            protocol = RealtimeProtocol(),
            roomRepository = rooms,
            gameRepository = games,
            presenceRepository = presenceRepository,
            connectivity = connectivityRepository,
            sessionStore = sessionStore,
        )
    }
    private val gateway: EntryLobbyGateway by lazy {
        val api = participantApi
        if (api == null) {
            UnavailableEntryLobbyGateway("API_BASE_URL is not configured for this build")
        } else {
            NetworkEntryLobbyGateway(
                api = api,
                sessions = sessionStore,
                realtime = realtimeSession,
                roomRepository = roomRepository,
                connectivityRepository = connectivityRepository,
            )
        }
    }
    private val gameplayGateway: GameplayGateway by lazy {
        participantApi?.let {
            val apiBaseUrl = BuildConfig.API_BASE_URL.toHttpUrl()
            NetworkGameplayGateway(
                it,
                SignedUploadClient(
                    apiBaseUrl = apiBaseUrl,
                    allowInsecureLocalDebug = BuildConfig.DEBUG,
                ),
                allowInsecureLocalDebug = BuildConfig.DEBUG,
            )
        } ?: UnavailableGameplayGateway("API_BASE_URL is not configured for this build")
    }
    private val entryLobbyViewModel: EntryLobbyViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(
                modelClass: Class<T>,
                extras: CreationExtras,
            ): T = EntryLobbyViewModel(gateway, extras.createSavedStateHandle()) as T
        }
    }
    private val gameplayViewModel: GameplayViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
                GameplayViewModel(gameplayGateway, EvidenceProcessor(applicationContext)) as T
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val preferences by appPreferences.state.collectAsStateWithLifecycle()
            ImposterGameApp(
                viewModel = entryLobbyViewModel,
                gameplayViewModel = gameplayViewModel,
                onCopyCode = ::copyRoomCode,
                onShareCode = ::shareRoomCode,
                onShareDiagnostics = ::shareSupportDiagnostics,
                preferences = preferences,
                onThemeModeChanged = appPreferences::setThemeMode,
                onSoundChanged = appPreferences::setSoundEnabled,
                onHapticsChanged = appPreferences::setHapticsEnabled,
                onReduceMotionChanged = appPreferences::setReduceMotion,
                onHighContrastChanged = appPreferences::setHighContrast,
                onResolvedDarkTheme = ::updateSystemBars,
                onFeedback = ::handleFeedback,
                onMinimizeApp = { moveTaskToBack(true) },
            )
        }
    }

    private fun updateSystemBars(darkTheme: Boolean) {
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !darkTheme
            isAppearanceLightNavigationBars = !darkTheme
        }
    }

    private fun handleFeedback(event: GameFeedbackEvent) {
        feedbackController.emit(event, appPreferences.state.value, window.decorView)
    }

    override fun onResume() {
        super.onResume()
        entryLobbyViewModel.onAppForegrounded()
        feedbackController.setForeground(true)
    }

    override fun onPause() {
        feedbackController.setForeground(false)
        entryLobbyViewModel.onAppBackgrounded()
        gameplayViewModel.onAppBackgrounded()
        super.onPause()
    }

    override fun onDestroy() {
        realtimeSession?.stop()
        if (isFinishing) feedbackController.close()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus) gameplayViewModel.resealRole()
    }

    private fun copyRoomCode(code: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Room code", code)
        clip.description.extras =
            PersistableBundle().apply { putBoolean(CLIPBOARD_IS_SENSITIVE, true) }
        clipboard.setPrimaryClip(clip)
        lifecycleScope.launch {
            delay(CLIPBOARD_TTL_MILLIS)
            val current = clipboard.primaryClip?.getItemAt(0)?.coerceToText(this@MainActivity)
            if (current?.toString() == code) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) clipboard.clearPrimaryClip()
                else clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
            }
        }
    }

    private fun shareRoomCode(code: String) {
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, "Join my Imposter Game room with code $code")
                },
                "Share room code",
            )
        )
    }

    private fun shareSupportDiagnostics() {
        val text =
            supportDiagnostics
                .snapshot(
                    versionName = BuildConfig.VERSION_NAME,
                    versionCode = BuildConfig.VERSION_CODE,
                    environment = BuildConfig.ENVIRONMENT,
                    networkState = SafeNetworkState.UNKNOWN,
                )
                .asConsentGatedText(userConsented = true) ?: return
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                },
                "Share support diagnostics",
            )
        )
    }

    private companion object {
        const val CLIPBOARD_IS_SENSITIVE = "android.content.extra.IS_SENSITIVE"
        const val CLIPBOARD_TTL_MILLIS = 60_000L
    }
}
