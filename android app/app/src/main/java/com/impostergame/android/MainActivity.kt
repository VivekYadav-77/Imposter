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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.CreationExtras
import com.impostergame.android.entry.EntryLobbyGateway
import com.impostergame.android.entry.EntryLobbyViewModel
import com.impostergame.android.entry.NetworkEntryLobbyGateway
import com.impostergame.android.entry.UnavailableEntryLobbyGateway
import com.impostergame.android.gameplay.EvidenceProcessor
import com.impostergame.android.gameplay.GameplayGateway
import com.impostergame.android.gameplay.GameplayViewModel
import com.impostergame.android.gameplay.NetworkGameplayGateway
import com.impostergame.android.gameplay.UnavailableGameplayGateway
import com.impostergame.android.ui.ImposterGameApp
import com.impostergame.data.network.ApiClient
import com.impostergame.data.network.ParticipantApi
import com.impostergame.data.network.SignedUploadClient
import com.impostergame.data.session.StoredSession
import com.impostergame.session.AndroidKeystoreSessionStore
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl

class MainActivity : ComponentActivity() {
    private val sessionStore by lazy { AndroidKeystoreSessionStore(applicationContext) }
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
                    allowInsecureLocalDebug = BuildConfig.DEBUG,
                )
            )
        }
    }
    private val gateway: EntryLobbyGateway by lazy {
        val api = participantApi
        if (api == null) {
            UnavailableEntryLobbyGateway("API_BASE_URL is not configured for this build")
        } else {
            NetworkEntryLobbyGateway(api, sessionStore)
        }
    }
    private val gameplayGateway: GameplayGateway by lazy {
        participantApi?.let {
            NetworkGameplayGateway(
                it,
                SignedUploadClient(allowInsecureLocalDebug = BuildConfig.DEBUG),
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
            ImposterGameApp(
                viewModel = entryLobbyViewModel,
                gameplayViewModel = gameplayViewModel,
                onCopyCode = ::copyRoomCode,
                onShareCode = ::shareRoomCode,
            )
        }
    }

    override fun onPause() {
        gameplayViewModel.onAppBackgrounded()
        super.onPause()
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

    private companion object {
        const val CLIPBOARD_IS_SENSITIVE = "android.content.extra.IS_SENSITIVE"
        const val CLIPBOARD_TTL_MILLIS = 60_000L
    }
}
