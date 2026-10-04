package com.impostergame.android.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.impostergame.data.account.DashboardData
import com.impostergame.data.account.MobileGoogleChallenge
import com.impostergame.data.account.StoredAccountSession
import com.impostergame.data.account.UserGameDetail
import com.impostergame.data.account.UserGameSummary
import com.impostergame.data.account.UserProfile
import com.impostergame.data.account.UserSession
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.network.ApiFailure
import com.impostergame.data.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AccountDestination {
    NONE,
    AUTH_CHOICE,
    DASHBOARD,
    HISTORY,
    GAME_DETAIL,
    SETTINGS,
}

enum class PendingGuestEntry {
    CREATE,
    JOIN,
}

enum class AccountSessionStatus {
    CHECKING,
    AUTHENTICATED,
    SIGNED_OUT,
    UNAVAILABLE,
}

data class AccountUiState(
    val destination: AccountDestination = AccountDestination.NONE,
    val pendingGuestEntry: PendingGuestEntry = PendingGuestEntry.CREATE,
    val pendingPlayRequest: Boolean = false,
    val loading: Boolean = false,
    val signingIn: Boolean = false,
    val message: String? = null,
    val accountCredentialPresent: Boolean = false,
    val sessionStatus: AccountSessionStatus = AccountSessionStatus.CHECKING,
    val profile: UserProfile? = null,
    val dashboard: DashboardData? = null,
    val history: List<UserGameSummary> = emptyList(),
    val historyCursor: String? = null,
    val game: UserGameDetail? = null,
    val sessions: List<UserSession> = emptyList(),
    val rejoinedRoom: RoomSnapshot? = null,
)

class AccountViewModel(
    private val gateway: AccountGateway,
    private val googleCredential: suspend (String) -> GoogleCredentialResult,
    private val clearGoogleState: suspend () -> Unit,
    private val enabled: Boolean,
    autoBootstrap: Boolean = true,
) : ViewModel() {
    private val mutableState = MutableStateFlow(AccountUiState())
    val state: StateFlow<AccountUiState> = mutableState.asStateFlow()

    private var bootstrapStarted = false
    private var presenceRestoreStarted = false

    init {
        if (autoBootstrap) bootstrap()
    }

    fun bootstrap() {
        if (!enabled || bootstrapStarted) return
        bootstrapStarted = true
        viewModelScope.launch {
            when (gateway.restore()) {
                is StoredAccountSession.Available -> loadDashboard(open = true)
                StoredAccountSession.None,
                is StoredAccountSession.Unavailable ->
                    mutableState.value =
                        mutableState.value.copy(sessionStatus = AccountSessionStatus.SIGNED_OUT)
            }
        }
    }

    /** Restores only local account presence while participant navigation remains authoritative. */
    fun restorePresence() {
        if (!enabled || presenceRestoreStarted) return
        presenceRestoreStarted = true
        validatePresence()
    }

    /** Revalidates the account when a result becomes authoritative, matching the website gate. */
    fun validatePresence() {
        if (!enabled) return
        viewModelScope.launch { validateStoredPresence() }
    }

    private suspend fun validateStoredPresence() {
        when (gateway.restore()) {
            is StoredAccountSession.Available -> {
                mutableState.value =
                    mutableState.value.copy(
                        accountCredentialPresent = true,
                        sessionStatus = AccountSessionStatus.CHECKING,
                    )
                when (val profile = gateway.me()) {
                    is ApiResult.Success ->
                        mutableState.value =
                            mutableState.value.copy(
                                accountCredentialPresent = true,
                                sessionStatus = AccountSessionStatus.AUTHENTICATED,
                                profile = profile.value,
                            )
                    is ApiResult.Failure -> fail(profile.error)
                }
            }
            StoredAccountSession.None,
            is StoredAccountSession.Unavailable ->
                mutableState.value =
                    mutableState.value.copy(
                        accountCredentialPresent = false,
                        sessionStatus = AccountSessionStatus.SIGNED_OUT,
                    )
        }
    }

    fun showAuthChoice(entry: PendingGuestEntry) {
        if (!enabled) return
        mutableState.value =
            mutableState.value.copy(
                destination = AccountDestination.AUTH_CHOICE,
                pendingGuestEntry = entry,
                pendingPlayRequest = false,
                message = null,
            )
    }

    fun requestPlay(entry: PendingGuestEntry) {
        if (!enabled) return
        if (mutableState.value.sessionStatus == AccountSessionStatus.SIGNED_OUT) {
            showAuthChoice(entry)
            return
        }
        mutableState.value =
            mutableState.value.copy(pendingGuestEntry = entry, pendingPlayRequest = true)
        viewModelScope.launch { loadDashboard(open = true) }
    }

    fun dismiss() {
        mutableState.value =
            mutableState.value.copy(destination = AccountDestination.NONE, message = null)
    }

    fun showDashboard() {
        viewModelScope.launch { loadDashboard(open = true) }
    }

    /** Opens the account landing page after participant cleanup, but never signs a guest in. */
    fun showDashboardAfterResults() {
        if (!enabled || !mutableState.value.accountCredentialPresent) return
        showDashboard()
    }

    fun showHistory() {
        mutableState.value =
            mutableState.value.copy(
                destination = AccountDestination.HISTORY,
                loading = true,
                message = null,
                history = emptyList(),
            )
        loadHistory(null)
    }

    fun loadMoreHistory() {
        mutableState.value.historyCursor?.let(::loadHistory)
    }

    fun showGame(id: String) {
        mutableState.value =
            mutableState.value.copy(
                destination = AccountDestination.GAME_DETAIL,
                loading = true,
                message = null,
                game = null,
            )
        viewModelScope.launch {
            when (val result = gateway.game(id)) {
                is ApiResult.Success ->
                    mutableState.value =
                        mutableState.value.copy(game = result.value, loading = false)
                is ApiResult.Failure -> fail(result.error)
            }
        }
    }

    fun showSettings() {
        mutableState.value =
            mutableState.value.copy(
                destination = AccountDestination.SETTINGS,
                loading = true,
                message = null,
            )
        viewModelScope.launch {
            val profile = gateway.me()
            val sessions = gateway.sessions()
            if (profile is ApiResult.Success && sessions is ApiResult.Success) {
                mutableState.value =
                    mutableState.value.copy(
                        profile = profile.value,
                        sessions = sessions.value,
                        loading = false,
                    )
            } else {
                fail(
                    (profile as? ApiResult.Failure)?.error ?: (sessions as ApiResult.Failure).error
                )
            }
        }
    }

    fun continueWithGoogle(intent: String = "login") {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(signingIn = true, message = null)
            when (val challenge = gateway.beginGoogle(intent)) {
                is ApiResult.Failure -> fail(challenge.error)
                is ApiResult.Success -> completeGoogle(challenge.value, intent)
            }
        }
    }

    private suspend fun completeGoogle(challenge: MobileGoogleChallenge, intent: String) {
        when (val credential = googleCredential(challenge.nonce)) {
            GoogleCredentialResult.Cancelled ->
                mutableState.value =
                    mutableState.value.copy(
                        signingIn = false,
                        message = "Google sign-in was cancelled.",
                    )
            is GoogleCredentialResult.Failed ->
                mutableState.value =
                    mutableState.value.copy(
                        signingIn = false,
                        message = "Google sign-in could not be completed. Please try again.",
                    )
            is GoogleCredentialResult.Success ->
                when (val completion = gateway.completeGoogle(challenge, credential.idToken)) {
                    is ApiResult.Failure -> fail(completion.error)
                    is ApiResult.Success -> {
                        mutableState.value =
                            mutableState.value.copy(
                                accountCredentialPresent = true,
                                sessionStatus = AccountSessionStatus.AUTHENTICATED,
                                profile = completion.value,
                                signingIn = false,
                                message =
                                    if (intent == "post_game") "Case saved to your dashboard."
                                    else null,
                            )
                        if (intent == "post_game") dismiss() else loadDashboard(open = true)
                    }
                }
        }
    }

    fun rejoin(participantId: String) {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, message = null)
            when (val result = gateway.rejoin(participantId)) {
                is ApiResult.Success ->
                    mutableState.value =
                        mutableState.value.copy(
                            rejoinedRoom = result.value.room,
                            destination = AccountDestination.NONE,
                            loading = false,
                        )
                is ApiResult.Failure -> fail(result.error)
            }
        }
    }

    fun consumeRejoinedRoom() {
        mutableState.value = mutableState.value.copy(rejoinedRoom = null)
    }

    fun saveProfile(displayName: String, avatarId: String) {
        val normalized = displayName.trim()
        if (normalized.isEmpty() || normalized.length > 24) {
            mutableState.value =
                mutableState.value.copy(message = "Display name must be 1–24 characters.")
            return
        }
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, message = null)
            when (val result = gateway.updateProfile(normalized, avatarId)) {
                is ApiResult.Success ->
                    mutableState.value =
                        mutableState.value.copy(
                            profile = result.value,
                            loading = false,
                            message = "Profile updated.",
                        )
                is ApiResult.Failure -> fail(result.error)
            }
        }
    }

    fun revokeSession(id: String) =
        runAccountAction("Device signed out.") { gateway.revokeSession(id) }

    fun revokeOthers() = runAccountAction("Other devices signed out.") { gateway.revokeOthers() }

    fun signOut() {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, message = null)
            gateway.signOut()
            clearGoogleState()
            mutableState.value =
                AccountUiState(
                    message = "Signed out.",
                    sessionStatus = AccountSessionStatus.SIGNED_OUT,
                )
        }
    }

    fun deleteAccount() {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(signingIn = true, message = null)
            when (val challenge = gateway.beginGoogle("delete")) {
                is ApiResult.Failure -> fail(challenge.error)
                is ApiResult.Success ->
                    when (val credential = googleCredential(challenge.value.nonce)) {
                        GoogleCredentialResult.Cancelled ->
                            mutableState.value =
                                mutableState.value.copy(
                                    signingIn = false,
                                    message = "Verification cancelled.",
                                )
                        is GoogleCredentialResult.Failed ->
                            mutableState.value =
                                mutableState.value.copy(
                                    signingIn = false,
                                    message = "Google verification failed.",
                                )
                        is GoogleCredentialResult.Success ->
                            when (
                                val verified =
                                    gateway.completeGoogle(challenge.value, credential.idToken)
                            ) {
                                is ApiResult.Failure -> fail(verified.error)
                                is ApiResult.Success ->
                                    when (val deleted = gateway.deleteAccount()) {
                                        is ApiResult.Failure -> fail(deleted.error)
                                        is ApiResult.Success -> {
                                            clearGoogleState()
                                            mutableState.value =
                                                AccountUiState(
                                                    message = "Account deleted.",
                                                    sessionStatus = AccountSessionStatus.SIGNED_OUT,
                                                )
                                        }
                                    }
                            }
                    }
            }
        }
    }

    private suspend fun loadDashboard(open: Boolean) {
        mutableState.value =
            mutableState.value.copy(
                destination =
                    if (open) AccountDestination.DASHBOARD else mutableState.value.destination,
                loading = true,
                message = null,
            )
        val userProfile =
            when (val profile = gateway.me()) {
                is ApiResult.Failure -> {
                    fail(profile.error)
                    return
                }
                is ApiResult.Success -> profile.value
            }
        when (val result = gateway.dashboard()) {
            is ApiResult.Success ->
                mutableState.value =
                    mutableState.value.copy(
                        profile = userProfile,
                        accountCredentialPresent = true,
                        sessionStatus = AccountSessionStatus.AUTHENTICATED,
                        dashboard = result.value,
                        loading = false,
                        pendingPlayRequest = false,
                    )
            is ApiResult.Failure -> fail(result.error)
        }
    }

    private fun loadHistory(cursor: String?) {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, message = null)
            when (val result = gateway.history(cursor)) {
                is ApiResult.Success ->
                    mutableState.value =
                        mutableState.value.copy(
                            history =
                                if (cursor == null) result.value.items
                                else mutableState.value.history + result.value.items,
                            historyCursor = result.value.nextCursor,
                            loading = false,
                        )
                is ApiResult.Failure -> fail(result.error)
            }
        }
    }

    private fun runAccountAction(success: String, action: suspend () -> ApiResult<Unit>) {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, message = null)
            when (val result = action()) {
                is ApiResult.Success -> {
                    mutableState.value = mutableState.value.copy(loading = false, message = success)
                    showSettings()
                }
                is ApiResult.Failure -> fail(result.error)
            }
        }
    }

    private fun fail(failure: ApiFailure) {
        if (failure is ApiFailure.Http && failure.status == 401) {
            val expired = mutableState.value
            mutableState.value =
                AccountUiState(
                    destination =
                        if (expired.pendingPlayRequest) AccountDestination.AUTH_CHOICE
                        else AccountDestination.NONE,
                    pendingGuestEntry = expired.pendingGuestEntry,
                    message = "Your account session has ended. Sign in again.",
                    sessionStatus = AccountSessionStatus.SIGNED_OUT,
                )
            return
        }
        mutableState.value =
            mutableState.value.copy(
                loading = false,
                signingIn = false,
                sessionStatus =
                    if (mutableState.value.accountCredentialPresent) {
                        AccountSessionStatus.UNAVAILABLE
                    } else {
                        AccountSessionStatus.SIGNED_OUT
                    },
                message =
                    when (failure) {
                        is ApiFailure.Http -> failure.safeMessage.ifBlank { "The request failed." }
                        is ApiFailure.Transport -> "Check your connection and try again."
                        else -> "The account service could not be opened."
                    },
            )
    }
}
