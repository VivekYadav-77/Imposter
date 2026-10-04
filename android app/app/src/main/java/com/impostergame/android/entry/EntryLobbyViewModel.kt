package com.impostergame.android.entry

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.impostergame.android.feedback.GameFeedbackEvent
import com.impostergame.android.feedback.GameFeedbackKind
import com.impostergame.data.model.RoomSettingsInput
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.RoomStatus
import com.impostergame.data.network.ApiFailure
import com.impostergame.designsystem.component.ConnectionState
import java.util.UUID
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class EntryLobbyViewModel(
    private val gateway: EntryLobbyGateway,
    private val savedState: SavedStateHandle,
    private val newIdempotencyKey: () -> String = { UUID.randomUUID().toString() },
) : ViewModel() {
    private val _state = kotlinx.coroutines.flow.MutableStateFlow(restoredState())
    val state: kotlinx.coroutines.flow.StateFlow<EntryLobbyUiState> = _state
    private val _feedback = MutableSharedFlow<GameFeedbackEvent>(extraBufferCapacity = 16)
    val feedback = _feedback.asSharedFlow()
    private var lobbyRefresh: Job? = null
    private var settingsDebounce: Job? = null
    private var settingsSaveInFlight = false
    private var settingsSaveQueued = false
    private var bootstrapRetry: Job? = null
    private var pendingSubmission: PendingSubmission? = null
    private var requestInFlight = false
    private var taskPacksRoomId: String? = null

    init {
        if (gateway.supportsRealtime) {
            viewModelScope.launch {
                gateway.roomUpdates.collectLatest { snapshot -> acceptRoomSnapshot(snapshot) }
            }
            viewModelScope.launch {
                gateway.connectionUpdates.collectLatest { connection ->
                    update { it.copy(connectionState = connection) }
                    if (connection == ConnectionState.Connected) {
                        lobbyRefresh?.cancel()
                        lobbyRefresh = null
                    } else {
                        startLobbyFallbackRefresh()
                    }
                }
            }
        }
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
        settingsDebounce?.cancel()
        settingsDebounce = null
        cancelBootstrapRetry()
        setDestination(EntryDestination.HOME)
    }

    fun showSettings() {
        setDestination(EntryDestination.SETTINGS)
    }

    fun showJoin() {
        cancelBootstrapRetry()
        update {
            it.copy(
                destination = EntryDestination.JOIN,
                resumeFailed = false,
                form =
                    it.form.copy(
                        availableColorIds = emptyList(),
                        selectedColorId = null,
                        spotsRemaining = null,
                    ),
                message = null,
                validationTarget = null,
            )
        }
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

    fun setMinimumPlayers(value: Int) {
        pendingSubmission = null
        update {
            val minimum = value.coerceIn(3, it.form.maxPlayers)
            savedState[KEY_MIN_PLAYERS] = minimum
            it.copy(form = it.form.copy(minPlayers = minimum), message = null)
        }
    }

    fun setMaximumPlayers(value: Int) {
        pendingSubmission = null
        update {
            val maximum = value.coerceIn(it.form.minPlayers, 15)
            savedState[KEY_MAX_PLAYERS] = maximum
            it.copy(form = it.form.copy(maxPlayers = maximum), message = null)
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
        val fingerprint =
            "${snapshot.destination}|${form.roomCode}|$normalizedName|$color|" +
                "${form.minPlayers}|${form.maxPlayers}"
        val pending =
            pendingSubmission?.takeIf { it.fingerprint == fingerprint }
                ?: PendingSubmission(fingerprint, newIdempotencyKey()).also {
                    pendingSubmission = it
                }
        launchRequest {
            val result =
                if (snapshot.destination == EntryDestination.CREATE) {
                    gateway.create(
                        normalizedName,
                        color,
                        form.minPlayers,
                        form.maxPlayers,
                        pending.key,
                    )
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

    fun selectTaskPack(id: String) = updateSetting { state ->
        val pack = state.taskPacks.firstOrNull { it.id == id }
        state.copy(
            settings =
                state.settings.copy(
                    selectedTaskPackId = id,
                    taskCounts =
                        pack?.difficultyTaskCounts?.let(::initialTaskDistribution)
                            ?: state.settings.taskCounts,
                    roleCounts = emptyMap(),
                    dirty = true,
                ),
            message = null,
        )
    }

    fun updateTaskMinutes(value: Int) = updateSetting {
        it.copy(
            settings = it.settings.copy(taskPhaseMinutes = value.coerceIn(5, 240), dirty = true)
        )
    }

    fun updateMeetingSeconds(value: Int) = updateSetting {
        it.copy(
            settings =
                it.settings.copy(meetingDurationSeconds = value.coerceIn(30, 1800), dirty = true)
        )
    }

    fun updateMeetingsPerPlayer(value: Int) = updateSetting {
        it.copy(
            settings = it.settings.copy(meetingsPerPlayer = value.coerceIn(0, 10), dirty = true)
        )
    }

    fun updateMeetingVotingMode(value: String) = updateSetting {
        if (value !in setOf("timed", "all_voted")) it
        else it.copy(settings = it.settings.copy(meetingVotingMode = value, dirty = true))
    }

    fun updateVoteVisibility(value: String) = updateSetting {
        if (value !in setOf("private", "public")) it
        else it.copy(settings = it.settings.copy(voteVisibility = value, dirty = true))
    }

    fun updateEvidenceVisibility(value: String) = updateSetting {
        if (value !in setOf("private", "public")) it
        else it.copy(settings = it.settings.copy(evidenceVisibility = value, dirty = true))
    }

    fun updateImposterMeetingTaskRequirement(value: String) = updateSetting {
        if (value !in setOf("none", "one")) it
        else
            it.copy(
                settings = it.settings.copy(imposterMeetingTaskRequirement = value, dirty = true)
            )
    }

    fun updateMeetingCooldown(value: Int) = updateSetting {
        it.copy(
            settings =
                it.settings.copy(meetingCooldownSeconds = value.coerceIn(10, 1800), dirty = true)
        )
    }

    fun updateImposterCooldown(value: Int) = updateSetting {
        it.copy(
            settings =
                it.settings.copy(imposterCooldownSeconds = value.coerceIn(10, 300), dirty = true)
        )
    }

    fun updateImposterCount(value: Int) = updateSetting { state ->
        val allowed = state.room?.settings?.allowedImposterCounts.orEmpty()
        val next =
            if (allowed.isEmpty()) value.coerceIn(1, 7)
            else allowed.minBy { kotlin.math.abs(it - value) }
        val maximumCrew = ((state.room?.participants?.size ?: 1) - next).coerceAtLeast(0)
        state.copy(
            settings =
                state.settings.copy(
                    imposterCount = next,
                    roleCounts = state.settings.roleCounts.fitWithin(maximumCrew),
                    dirty = true,
                )
        )
    }

    fun updateTaskCount(difficulty: String, value: Int) = updateSetting { state ->
        if (difficulty !in setOf("easy", "medium", "hard")) return@updateSetting state
        val pack = state.taskPacks.firstOrNull { it.id == state.settings.selectedTaskPackId }
        val available =
            when (difficulty) {
                "easy" -> pack?.difficultyTaskCounts?.easy
                "medium" -> pack?.difficultyTaskCounts?.medium
                else -> pack?.difficultyTaskCounts?.hard
            } ?: 15
        val otherTotal = state.settings.taskCounts.filterKeys { it != difficulty }.values.sum()
        val maximum = minOf(available, (15 - otherTotal).coerceAtLeast(0))
        state.copy(
            settings =
                state.settings.copy(
                    taskCounts =
                        state.settings.taskCounts + (difficulty to value.coerceIn(0, maximum)),
                    dirty = true,
                )
        )
    }

    fun updateRoleCount(role: String, value: Int) = updateSetting { state ->
        val roles =
            state.taskPacks
                .firstOrNull { it.id == state.settings.selectedTaskPackId }
                ?.roles
                .orEmpty()
        if (roles.none { it.name == role }) return@updateSetting state
        val maximumCrew =
            ((state.room?.participants?.size ?: 1) - state.settings.imposterCount).coerceAtLeast(0)
        val otherTotal = state.settings.roleCounts.filterKeys { it != role }.values.sum()
        state.copy(
            settings =
                state.settings.copy(
                    roleCounts =
                        state.settings.roleCounts +
                            (role to
                                value.coerceIn(0, (maximumCrew - otherTotal).coerceAtLeast(0))),
                    dirty = true,
                )
        )
    }

    fun applySettings() {
        val snapshot = _state.value
        if (snapshot.settingsValidationErrors.isNotEmpty()) {
            update { it.copy(message = snapshot.settingsValidationErrors.joinToString(" ")) }
            return
        }
        settingsDebounce?.cancel()
        settingsDebounce = null
        viewModelScope.launch { requestSettingsSave() }
    }

    fun startGame() {
        if (!_state.value.canStart) return
        launchRequest {
            when (val result = gateway.start()) {
                is GatewayResult.Success -> {
                    lobbyRefresh?.cancel()
                    settingsDebounce?.cancel()
                    _feedback.tryEmit(
                        GameFeedbackEvent(
                            GameFeedbackKind.GameStart,
                            "${result.value.id}:${result.value.stateVersion}",
                        )
                    )
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
                    settingsDebounce?.cancel()
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
            when (val result = gateway.leave()) {
                is GatewayResult.Success -> {
                    lobbyRefresh?.cancel()
                    settingsDebounce?.cancel()
                    savedState.remove<String>(KEY_CODE)
                    savedState.remove<String>(KEY_NICKNAME)
                    savedState.remove<String>(KEY_COLOR)
                    _state.value = EntryLobbyUiState(destination = EntryDestination.HOME)
                }
                is GatewayResult.Failure -> update { it.copy(message = messageFor(result.error)) }
            }
        }
    }

    /** Accepts the authoritative lobby returned by the replay command. */
    fun enterReplayedRoom(room: RoomSnapshot) {
        enterLobby(room, "Room reset. Waiting in the lobby.")
    }

    /** Accepts an authoritative room and participant credential returned by account rejoin. */
    fun enterAccountRoom(room: RoomSnapshot) {
        enterLobby(room, "Room ready.")
    }

    fun clearAnnouncement() = update { it.copy(announce = null) }

    fun onAppBackgrounded() {
        lobbyRefresh?.cancel()
        lobbyRefresh = null
    }

    fun onAppForegrounded() {
        if (_state.value.destination == EntryDestination.LOBBY) {
            startLobbyFallbackRefresh(force = !gateway.supportsRealtime)
        }
    }

    private fun enterLobby(room: RoomSnapshot, announcement: String?) {
        cancelBootstrapRetry()
        update {
            it.copy(
                destination = EntryDestination.LOBBY,
                room = room,
                settings = draftFrom(room),
                settingsSaveState = SettingsSaveState.Clean,
                loading = false,
                message = null,
                announce = announcement,
                connectionState =
                    if (gateway.supportsRealtime) ConnectionState.Reconnecting
                    else ConnectionState.Connected,
                resumeFailed = false,
            )
        }
        if (taskPacksRoomId != room.id || _state.value.taskPacks.isEmpty()) {
            taskPacksRoomId = room.id
            viewModelScope.launch {
                when (val packs = gateway.taskPacks()) {
                    is GatewayResult.Success -> update { it.copy(taskPacks = packs.value) }
                    is GatewayResult.Failure -> taskPacksRoomId = null
                }
            }
        }
        startLobbyFallbackRefresh(force = !gateway.supportsRealtime)
    }

    private fun startLobbyFallbackRefresh(force: Boolean = false) {
        if (_state.value.destination != EntryDestination.LOBBY) return
        if (!force && _state.value.connectionState == ConnectionState.Connected) return
        if (lobbyRefresh?.isActive == true) return
        lobbyRefresh = viewModelScope.launch {
            val fallbackDelays = listOf(15_000L, 30_000L, 60_000L)
            var attempt = 0
            while (isActive) {
                delay(fallbackDelays[attempt.coerceAtMost(fallbackDelays.lastIndex)])
                if (!_state.value.loading) refreshLobby(silent = true)
                if (force) attempt = 0 else attempt++
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
                    acceptRoomSnapshot(result.value)
                }
            }
        }
    }

    private fun acceptRoomSnapshot(new: RoomSnapshot) {
        if (_state.value.destination != EntryDestination.LOBBY) return
        val old = _state.value.room
        when (new.status) {
            RoomStatus.ACTIVE -> {
                lobbyRefresh?.cancel()
                _feedback.tryEmit(
                    GameFeedbackEvent(GameFeedbackKind.GameStart, new.gameId ?: new.id)
                )
                setDestination(EntryDestination.GAME)
                return
            }
            RoomStatus.COMPLETED -> {
                lobbyRefresh?.cancel()
                setDestination(EntryDestination.RESULTS)
                return
            }
            else -> Unit
        }
        val announcement = rosterAnnouncement(old, new)
        if (old != null && new.participants.size > old.participants.size) {
            val joined =
                new.participants.map { it.id }.toSet() - old.participants.map { it.id }.toSet()
            _feedback.tryEmit(
                GameFeedbackEvent(GameFeedbackKind.PlayerJoin, joined.sorted().joinToString(","))
            )
        }
        update {
            it.copy(
                room = new,
                settings = if (it.settings.dirty) it.settings else draftFrom(new),
                settingsSaveState =
                    if (it.settings.dirty) it.settingsSaveState else SettingsSaveState.Clean,
                announce = announcement,
                connectionState =
                    if (gateway.supportsRealtime) it.connectionState else ConnectionState.Connected,
            )
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

    private fun updateSetting(transform: (EntryLobbyUiState) -> EntryLobbyUiState) {
        val before = _state.value.settings
        val transformed = transform(_state.value)
        if (transformed.settings.toInput() == before.toInput()) return
        _state.value = transformed.copy(settingsSaveState = SettingsSaveState.Dirty)
        scheduleSettingsSave()
    }

    private fun scheduleSettingsSave() {
        settingsDebounce?.cancel()
        val snapshot = _state.value
        if (
            snapshot.room?.self?.isHost != true ||
                !snapshot.settings.dirty ||
                snapshot.settingsValidationErrors.isNotEmpty()
        )
            return
        settingsDebounce = viewModelScope.launch {
            delay(SETTINGS_SAVE_DEBOUNCE_MILLIS)
            settingsDebounce = null
            requestSettingsSave()
        }
    }

    private suspend fun requestSettingsSave() {
        val snapshot = _state.value
        if (
            snapshot.room?.self?.isHost != true ||
                !snapshot.settings.dirty ||
                snapshot.settingsValidationErrors.isNotEmpty()
        )
            return
        if (settingsSaveInFlight) {
            settingsSaveQueued = true
            return
        }
        settingsSaveInFlight = true
        try {
            do {
                settingsSaveQueued = false
                val draft = _state.value.settings
                val submitted = draft.toInput()
                update { it.copy(settingsSaveState = SettingsSaveState.Saving, message = null) }
                when (val result = gateway.updateSettings(submitted)) {
                    is GatewayResult.Success ->
                        update { current ->
                            val unchanged = current.settings.toInput() == submitted
                            current.copy(
                                room = result.value,
                                settings =
                                    if (unchanged) draftFrom(result.value).copy(dirty = false)
                                    else current.settings,
                                settingsSaveState =
                                    if (unchanged) SettingsSaveState.Saved
                                    else SettingsSaveState.Dirty,
                            )
                        }
                    is GatewayResult.Failure -> {
                        if (result.error is ApiFailure.Http && result.error.status == 409) {
                            refreshLobby()
                        }
                        update {
                            it.copy(
                                settingsSaveState = SettingsSaveState.Error,
                                message = messageFor(result.error),
                            )
                        }
                    }
                }
                if (_state.value.settings.dirty && _state.value.settings.toInput() != submitted) {
                    settingsSaveQueued = true
                }
            } while (settingsSaveQueued && _state.value.settingsValidationErrors.isEmpty())
        } finally {
            settingsSaveInFlight = false
        }
    }

    private fun restoredState(): EntryLobbyUiState =
        EntryLobbyUiState(
            form =
                EntryForm(
                    roomCode = savedState[KEY_CODE] ?: "",
                    nickname = savedState[KEY_NICKNAME] ?: "",
                    minPlayers = savedState[KEY_MIN_PLAYERS] ?: 3,
                    maxPlayers = savedState[KEY_MAX_PLAYERS] ?: 15,
                    selectedColorId = savedState[KEY_COLOR],
                )
        )

    private data class PendingSubmission(val fingerprint: String, val key: String)

    companion object {
        private const val KEY_CODE = "entry.roomCode"
        private const val KEY_NICKNAME = "entry.nickname"
        private const val KEY_COLOR = "entry.color"
        private const val KEY_MIN_PLAYERS = "entry.minPlayers"
        private const val KEY_MAX_PLAYERS = "entry.maxPlayers"
        private const val SETTINGS_SAVE_DEBOUNCE_MILLIS = 550L
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
        imposterMeetingTaskRequirement = room.settings.imposterMeetingTaskRequirement,
        meetingCooldownSeconds = room.settings.meetingCooldownSeconds,
        imposterCooldownSeconds = room.settings.imposterCooldownSeconds,
        imposterCount = room.settings.imposterCount,
        taskCounts = room.settings.taskCounts,
        roleCounts = room.settings.roleCounts,
    )

private fun LobbySettingsDraft.toInput(): RoomSettingsInput =
    RoomSettingsInput(
        selectedTaskPackId = selectedTaskPackId,
        taskPhaseSeconds = taskPhaseMinutes * 60,
        meetingsPerPlayer = meetingsPerPlayer,
        meetingDurationSeconds = meetingDurationSeconds,
        meetingVotingMode = meetingVotingMode,
        voteVisibility = voteVisibility,
        evidenceVisibility = evidenceVisibility,
        imposterMeetingTaskRequirement = imposterMeetingTaskRequirement,
        meetingCooldownSeconds = meetingCooldownSeconds,
        imposterCooldownSeconds = imposterCooldownSeconds,
        imposterCount = imposterCount,
        taskCounts = taskCounts,
        roleCounts = roleCounts,
    )

private fun initialTaskDistribution(
    counts: com.impostergame.data.model.DifficultyTaskCounts
): Map<String, Int> {
    val available = mapOf("easy" to counts.easy, "medium" to counts.medium, "hard" to counts.hard)
    val result = mutableMapOf("easy" to 0, "medium" to 0, "hard" to 0)
    val target = minOf(3, available.values.sum())
    while (result.values.sum() < target) {
        val before = result.values.sum()
        listOf("easy", "medium", "hard").forEach { difficulty ->
            if (
                result.values.sum() < target &&
                    result.getValue(difficulty) < available.getValue(difficulty)
            ) {
                result[difficulty] = result.getValue(difficulty) + 1
            }
        }
        if (result.values.sum() == before) break
    }
    return result
}

private fun Map<String, Int>.fitWithin(maximum: Int): Map<String, Int> {
    var remaining = maximum
    return entries.associate { (name, count) ->
        val kept = count.coerceIn(0, remaining)
        remaining -= kept
        name to kept
    }
}

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
