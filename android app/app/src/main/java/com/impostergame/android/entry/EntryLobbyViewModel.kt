package com.impostergame.android.entry

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.impostergame.data.model.RoomSettingsInput
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.RoomStatus
import com.impostergame.data.network.ApiFailure
import com.impostergame.designsystem.component.ConnectionState
import java.util.UUID
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class EntryLobbyViewModel(
    private val gateway: EntryLobbyGateway,
    private val savedState: SavedStateHandle,
    private val newIdempotencyKey: () -> String = { UUID.randomUUID().toString() },
) : ViewModel() {
    private val _state = kotlinx.coroutines.flow.MutableStateFlow(restoredState())
    val state: kotlinx.coroutines.flow.StateFlow<EntryLobbyUiState> = _state
    private var lobbyRefresh: Job? = null
    private var bootstrapRetry: Job? = null
    private var pendingSubmission: PendingSubmission? = null
    private var requestInFlight = false

    init {
        bootstrap(manual = false)
    }

    fun bootstrap(manual: Boolean = true) {
        if (manual) bootstrapRetry?.cancel()
        launchRequest {
            when (val target = gateway.resume()) {
                ResumeTarget.Entry -> {
                    cancelBootstrapRetry()
                    setDestination(EntryDestination.HOME)
                }
                is ResumeTarget.Lobby -> enterLobby(target.room, "Returned to lobby.")
                ResumeTarget.Game -> {
                    cancelBootstrapRetry()
                    setDestination(EntryDestination.GAME)
                }
                ResumeTarget.Results -> {
                    cancelBootstrapRetry()
                    setDestination(EntryDestination.RESULTS)
                }
                is ResumeTarget.Failed -> {
                    update {
                        it.copy(
                            destination = EntryDestination.HOME,
                            message = messageFor(target.error),
                            connectionState = ConnectionState.Offline,
                            resumeFailed = true,
                        )
                    }
                    scheduleBootstrapRetry()
                }
            }
        }
    }

    fun showHome() {
        lobbyRefresh?.cancel()
        cancelBootstrapRetry()
        setDestination(EntryDestination.HOME)
    }

    fun showJoin() {
        cancelBootstrapRetry()
        setDestination(EntryDestination.JOIN)
    }

    fun showCreate() {
        cancelBootstrapRetry()
        update {
            it.copy(
                destination = EntryDestination.CREATE,
                resumeFailed = false,
                form =
                    it.form.copy(
                        availableColorIds =
                            com.impostergame.designsystem.avatar.PlayerColors.all.map { color ->
                                color.transportId
                            }
                    ),
            )
        }
    }

    fun setCode(value: String) {
        pendingSubmission = null
        val normalized = normalizeRoomCode(value)
        savedState[KEY_CODE] = normalized
        update {
            it.copy(
                form =
                    it.form.copy(
                        roomCode = normalized,
                        codeError = null,
                        availableColorIds = emptyList(),
                        selectedColorId = null,
                    ),
                message = null,
                validationTarget = null,
            )
        }
    }

    fun setNickname(value: String) {
        pendingSubmission = null
        savedState[KEY_NICKNAME] = value
        update {
            it.copy(
                form = it.form.copy(nickname = value, nicknameError = null),
                validationTarget = null,
            )
        }
    }

    fun setColor(id: String) {
        pendingSubmission = null
        savedState[KEY_COLOR] = id
        update {
            it.copy(
                form = it.form.copy(selectedColorId = id),
                message = null,
                focusColorPicker = false,
                validationTarget = null,
            )
        }
    }

    fun setConsent(kind: ConsentKind, accepted: Boolean) {
        update {
            val form =
                when (kind) {
                    ConsentKind.AGE -> it.form.copy(ageAccepted = accepted)
                    ConsentKind.PHOTO -> it.form.copy(photoAccepted = accepted)
                    ConsentKind.PRIVACY -> it.form.copy(privacyAccepted = accepted)
                }
            it.copy(form = form, validationTarget = null, message = null)
        }
    }

    fun fetchJoinOptions() {
        val code = _state.value.form.roomCode
        validateRoomCode(code)?.let { error ->
            update { it.copy(form = it.form.copy(codeError = error)) }
            return
        }
        launchRequest {
            when (val result = gateway.joinOptions(code)) {
                is GatewayResult.Failure -> update { it.copy(message = messageFor(result.error)) }
                is GatewayResult.Success ->
                    update {
                        it.copy(
                            form =
                                it.form.copy(
                                    availableColorIds = result.value.availableAvatarIds,
                                    spotsRemaining = result.value.spotsRemaining,
                                    selectedColorId =
                                        it.form.selectedColorId?.takeIf { selected ->
                                            selected in result.value.availableAvatarIds
                                        },
                                ),
                            message =
                                if (result.value.spotsRemaining == 0) "This room is full."
                                else null,
                        )
                    }
            }
        }
    }

    fun submitEntry() {
        val snapshot = _state.value
        val form = snapshot.form
        val nicknameError = validateNickname(form.nickname)
        val codeError =
            if (snapshot.destination == EntryDestination.JOIN) validateRoomCode(form.roomCode)
            else null
        if (nicknameError != null || codeError != null) {
            update {
                it.copy(
                    form = it.form.copy(nicknameError = nicknameError, codeError = codeError),
                    message = "Check the highlighted field and try again.",
                    validationTarget =
                        if (codeError != null) EntryValidationTarget.ROOM_CODE
                        else EntryValidationTarget.NICKNAME,
                )
            }
            return
        }
        val color = form.selectedColorId
        if (color == null || !form.consentsAccepted) {
            update {
                it.copy(
                    message =
                        if (color == null) "Choose an available player color."
                        else "Accept all three agreements to continue.",
                    validationTarget =
                        if (color == null) EntryValidationTarget.COLOR
                        else EntryValidationTarget.CONSENTS,
                )
            }
            return
        }
        val normalizedName = normalizeNickname(form.nickname)
        val fingerprint = "${snapshot.destination}|${form.roomCode}|$normalizedName|$color"
        val pending =
            pendingSubmission?.takeIf { it.fingerprint == fingerprint }
                ?: PendingSubmission(fingerprint, newIdempotencyKey()).also {
                    pendingSubmission = it
                }
        launchRequest {
            val result =
                if (snapshot.destination == EntryDestination.CREATE) {
                    gateway.create(normalizedName, color, pending.key)
                } else {
                    gateway.join(form.roomCode, normalizedName, color, pending.key)
                }
            when (result) {
                is GatewayResult.Success -> {
                    pendingSubmission = null
                    enterLobby(result.value, "Joined room ${result.value.code}.")
                }
                is GatewayResult.Failure -> handleEntryFailure(result.error)
            }
        }
    }

    fun toggleAdvanced() = update {
        it.copy(settings = it.settings.copy(advancedExpanded = !it.settings.advancedExpanded))
    }

    fun selectTaskPack(id: String) = update {
        it.copy(
            settings = it.settings.copy(selectedTaskPackId = id, dirty = true),
            message = null,
        )
    }

    fun updateTaskMinutes(value: Int) = update {
        it.copy(
            settings = it.settings.copy(taskPhaseMinutes = value.coerceIn(5, 240), dirty = true)
        )
    }

    fun updateMeetingSeconds(value: Int) = update {
        it.copy(
            settings =
                it.settings.copy(meetingDurationSeconds = value.coerceIn(30, 1800), dirty = true)
        )
    }

    fun applySettings() {
        val draft = _state.value.settings
        launchRequest {
            val result =
                gateway.updateSettings(
                    RoomSettingsInput(
                        selectedTaskPackId = draft.selectedTaskPackId,
                        taskPhaseSeconds = draft.taskPhaseMinutes * 60,
                        meetingsPerPlayer = draft.meetingsPerPlayer,
                        meetingDurationSeconds = draft.meetingDurationSeconds,
                        meetingVotingMode = draft.meetingVotingMode,
                        voteVisibility = draft.voteVisibility,
                        evidenceVisibility = draft.evidenceVisibility,
                        meetingCooldownSeconds = draft.meetingCooldownSeconds,
                        imposterCooldownSeconds = draft.imposterCooldownSeconds,
                    )
                )
            when (result) {
                is GatewayResult.Success ->
                    update {
                        it.copy(
                            room = result.value,
                            settings = draftFrom(result.value).copy(dirty = false),
                            message = "Settings applied.",
                        )
                    }
                is GatewayResult.Failure -> {
                    if (result.error is ApiFailure.Http && result.error.status == 409)
                        refreshLobby()
                    update { it.copy(message = messageFor(result.error)) }
                }
            }
        }
    }

    fun startGame() {
        if (!_state.value.canStart) return
        launchRequest {
            when (val result = gateway.start()) {
                is GatewayResult.Success -> {
                    lobbyRefresh?.cancel()
                    setDestination(EntryDestination.GAME)
                }
                is GatewayResult.Failure -> {
                    update { it.copy(message = messageFor(result.error)) }
                    refreshLobby()
                }
            }
        }
    }

    fun requestLeave() = update { it.copy(confirmLeave = true) }

    fun dismissLeave() = update { it.copy(confirmLeave = false) }

    fun confirmLeave() {
        launchRequest {
            when (val result = gateway.leave()) {
                is GatewayResult.Success -> {
                    lobbyRefresh?.cancel()
                    savedState.remove<String>(KEY_CODE)
                    savedState.remove<String>(KEY_NICKNAME)
                    savedState.remove<String>(KEY_COLOR)
                    _state.value = EntryLobbyUiState(destination = EntryDestination.HOME)
                }
                is GatewayResult.Failure ->
                    update {
                        it.copy(confirmLeave = false, message = messageFor(result.error))
                    }
            }
        }
    }

    fun exitResults() {
        launchRequest {
            when (val result = gateway.endSession()) {
                is GatewayResult.Success -> {
                    lobbyRefresh?.cancel()
                    _state.value = EntryLobbyUiState(destination = EntryDestination.HOME)
                }
                is GatewayResult.Failure -> update { it.copy(message = messageFor(result.error)) }
            }
        }
    }

    fun clearAnnouncement() = update { it.copy(announce = null) }

    private fun enterLobby(room: RoomSnapshot, announcement: String?) {
        cancelBootstrapRetry()
        update {
            it.copy(
                destination = EntryDestination.LOBBY,
                room = room,
                settings = draftFrom(room),
                loading = false,
                message = null,
                announce = announcement,
                connectionState = ConnectionState.Connected,
                resumeFailed = false,
            )
        }
        viewModelScope.launch {
            when (val packs = gateway.taskPacks()) {
                is GatewayResult.Success -> update { it.copy(taskPacks = packs.value) }
                is GatewayResult.Failure -> Unit
            }
        }
        lobbyRefresh?.cancel()
        lobbyRefresh = viewModelScope.launch {
            while (isActive) {
                delay(5_000)
                if (!_state.value.loading) refreshLobby(silent = true)
            }
        }
    }

    private fun refreshLobby(silent: Boolean = false) {
        viewModelScope.launch {
            when (val result = gateway.refreshRoom()) {
                is GatewayResult.Failure ->
                    update {
                        it.copy(
                            message = if (silent) it.message else messageFor(result.error),
                            connectionState =
                                if (it.room == null) ConnectionState.Offline
                                else ConnectionState.Reconnecting,
                        )
                    }
                is GatewayResult.Success -> {
                    val old = _state.value.room
                    val new = result.value
                    when (new.status) {
                        RoomStatus.ACTIVE -> {
                            lobbyRefresh?.cancel()
                            setDestination(EntryDestination.GAME)
                            return@launch
                        }
                        RoomStatus.COMPLETED -> {
                            lobbyRefresh?.cancel()
                            setDestination(EntryDestination.RESULTS)
                            return@launch
                        }
                        else -> Unit
                    }
                    val announcement = rosterAnnouncement(old, new)
                    update {
                        it.copy(
                            room = new,
                            settings = if (it.settings.dirty) it.settings else draftFrom(new),
                            announce = announcement,
                            connectionState = ConnectionState.Connected,
                        )
                    }
                }
            }
        }
    }

    private suspend fun handleEntryFailure(error: ApiFailure) {
        val conflict = error as? ApiFailure.Http
        if (conflict?.code == "AVATAR_TAKEN") {
            update {
                it.copy(
                    message = "That color was just taken. Choose another.",
                    focusColorPicker = true,
                )
            }
            val code = _state.value.form.roomCode
            if (validateRoomCode(code) == null) {
                when (val options = gateway.joinOptions(code)) {
                    is GatewayResult.Success ->
                        update {
                            it.copy(
                                form =
                                    it.form.copy(
                                        availableColorIds = options.value.availableAvatarIds,
                                        spotsRemaining = options.value.spotsRemaining,
                                        selectedColorId = null,
                                    )
                            )
                        }
                    is GatewayResult.Failure -> Unit
                }
            }
        } else {
            update { it.copy(message = messageFor(error)) }
        }
    }

    private fun launchRequest(block: suspend () -> Unit) {
        if (requestInFlight) return
        requestInFlight = true
        viewModelScope.launch {
            update { it.copy(loading = true, message = null) }
            try {
                block()
            } finally {
                requestInFlight = false
                update { it.copy(loading = false) }
            }
        }
    }

    private fun scheduleBootstrapRetry() {
        if (bootstrapRetry?.isActive == true) return
        bootstrapRetry = viewModelScope.launch {
            for (delayMillis in listOf(2_000L, 4_000L, 8_000L, 15_000L, 30_000L)) {
                delay(delayMillis)
                if (!_state.value.resumeFailed) break
                bootstrap(manual = false)
            }
        }
    }

    private fun cancelBootstrapRetry() {
        bootstrapRetry?.cancel()
        bootstrapRetry = null
    }

    private fun setDestination(destination: EntryDestination) = update {
        it.copy(
            destination = destination,
            loading = false,
            message = null,
            resumeFailed = false,
            validationTarget = null,
        )
    }

    private fun update(transform: (EntryLobbyUiState) -> EntryLobbyUiState) {
        _state.value = transform(_state.value)
    }

    private fun restoredState(): EntryLobbyUiState =
        EntryLobbyUiState(
            form =
                EntryForm(
                    roomCode = savedState[KEY_CODE] ?: "",
                    nickname = savedState[KEY_NICKNAME] ?: "",
                    selectedColorId = savedState[KEY_COLOR],
                )
        )

    private data class PendingSubmission(val fingerprint: String, val key: String)

    companion object {
        private const val KEY_CODE = "entry.roomCode"
        private const val KEY_NICKNAME = "entry.nickname"
        private const val KEY_COLOR = "entry.color"
    }
}

enum class ConsentKind {
    AGE,
    PHOTO,
    PRIVACY,
}

private fun draftFrom(room: RoomSnapshot): LobbySettingsDraft =
    LobbySettingsDraft(
        selectedTaskPackId = room.settings.selectedTaskPack?.id,
        taskPhaseMinutes = room.settings.taskPhaseSeconds / 60,
        meetingDurationSeconds = room.settings.meetingDurationSeconds,
        meetingsPerPlayer = room.settings.meetingsPerPlayer,
        meetingVotingMode = room.settings.meetingVotingMode,
        voteVisibility = room.settings.voteVisibility,
        evidenceVisibility = room.settings.evidenceVisibility,
        meetingCooldownSeconds = room.settings.meetingCooldownSeconds,
        imposterCooldownSeconds = room.settings.imposterCooldownSeconds,
    )

private fun rosterAnnouncement(old: RoomSnapshot?, new: RoomSnapshot): String? {
    if (old == null) return null
    val oldHost = old.participants.firstOrNull { it.isHost }?.nickname
    val newHost = new.participants.firstOrNull { it.isHost }?.nickname
    if (oldHost != newHost && newHost != null) return "$newHost is now the host."
    val delta = new.participants.size - old.participants.size
    return when {
        delta > 0 -> "$delta ${if (delta == 1) "player" else "players"} joined."
        delta < 0 -> {
            val count = -delta
            "$count ${if (count == 1) "player" else "players"} left."
        }
        else -> null
    }
}

internal fun messageFor(error: ApiFailure): String =
    when (error) {
        ApiFailure.Cancelled -> "Request cancelled."
        is ApiFailure.Contract -> "The server returned an unexpected response."
        is ApiFailure.Transport -> "Connection lost. Check your network and try again."
        is ApiFailure.Http ->
            when (error.code) {
                "ROOM_NOT_FOUND" -> "That room does not exist or has expired."
                "ROOM_EXPIRED" -> "That room has expired."
                "ROOM_FULL" -> "That room is full."
                "NICKNAME_TAKEN" -> "That nickname is already in use."
                "RATE_LIMITED" -> "Too many attempts. Wait a moment and try again."
                else -> error.safeMessage
            }
    }
