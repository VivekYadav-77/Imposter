package com.impostergame.android

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.CreationExtras
import com.impostergame.android.entry.EntryLobbyGateway
import com.impostergame.android.entry.EntryLobbyViewModel
import com.impostergame.android.entry.NetworkEntryLobbyGateway
import com.impostergame.android.entry.UnavailableEntryLobbyGateway
import com.impostergame.android.ui.ImposterGameApp
import com.impostergame.data.network.ApiClient
import com.impostergame.data.network.ParticipantApi
import com.impostergame.data.session.StoredSession
import com.impostergame.session.AndroidKeystoreSessionStore
import okhttp3.HttpUrl.Companion.toHttpUrl

class MainActivity : ComponentActivity() {
    private val sessionStore by lazy { AndroidKeystoreSessionStore(applicationContext) }
    private val gateway: EntryLobbyGateway by lazy {
        if (BuildConfig.API_BASE_URL.isBlank()) {
            UnavailableEntryLobbyGateway("API_BASE_URL is not configured for this build")
        } else {
            val client =
                ApiClient(
                    baseUrl = BuildConfig.API_BASE_URL.toHttpUrl(),
                    credentialProvider = {
                        (sessionStore.session.value as? StoredSession.Available)?.credential?.token
                    },
                    allowInsecureLocalDebug = BuildConfig.DEBUG,
                )
            NetworkEntryLobbyGateway(ParticipantApi(client), sessionStore)
        }
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ImposterGameApp(
                viewModel = entryLobbyViewModel,
                onCopyCode = ::copyRoomCode,
                onShareCode = ::shareRoomCode,
            )
        }
    }

    private fun copyRoomCode(code: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Room code", code))
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
}
