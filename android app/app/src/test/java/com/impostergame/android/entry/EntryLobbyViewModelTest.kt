package com.impostergame.android.entry

import androidx.lifecycle.SavedStateHandle
import com.impostergame.android.MainDispatcherRule
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.ParticipantSelf
import com.impostergame.data.model.PublicTaskPack
import com.impostergame.data.model.RoomJoinOptions
import com.impostergame.data.model.RoomSettings
import com.impostergame.data.model.RoomSettingsInput
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.RoomStatus
import com.impostergame.data.network.ApiFailure
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class EntryLobbyViewModelTest {
    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun failedResumeOffersManualRetryAndRecovers() =
        runTest(mainDispatcherRule.dispatcher) {
            val gateway =
                FakeGateway(
                    ArrayDeque(
                        listOf(
                            ResumeTarget.Failed(
                                ApiFailure.Transport(IllegalStateException("offline"))
                            ),
                            ResumeTarget.Entry,
                        )
                    )
                )
            val viewModel = EntryLobbyViewModel(gateway, SavedStateHandle())
            runCurrent()

            assertEquals(EntryDestination.HOME, viewModel.state.value.destination)
            assertTrue(viewModel.state.value.resumeFailed)

            viewModel.bootstrap()
            runCurrent()

            assertEquals(EntryDestination.HOME, viewModel.state.value.destination)
            assertFalse(viewModel.state.value.resumeFailed)
            assertEquals(2, gateway.resumeCalls)
        }

    @Test
    fun failedResumeRetriesAutomaticallyWithBackoff() =
        runTest(mainDispatcherRule.dispatcher) {
            val gateway =
                FakeGateway(
                    ArrayDeque(
                        listOf(
                            ResumeTarget.Failed(
                                ApiFailure.Transport(IllegalStateException("offline"))
                            ),
                            ResumeTarget.Game,
                        )
                    )
                )
            val viewModel = EntryLobbyViewModel(gateway, SavedStateHandle())
            runCurrent()

            assertTrue(viewModel.state.value.resumeFailed)
            advanceTimeBy(2_000)
            runCurrent()

            assertEquals(EntryDestination.GAME, viewModel.state.value.destination)
            assertFalse(viewModel.state.value.resumeFailed)
            assertEquals(2, gateway.resumeCalls)
        }

    @Test
    fun resultsGoHomeReleasesRoomMembership() =
        runTest(mainDispatcherRule.dispatcher) {
            val gateway = FakeGateway(ArrayDeque(listOf(ResumeTarget.Results)))
            val viewModel = EntryLobbyViewModel(gateway, SavedStateHandle())
            runCurrent()
            var accountLandingOpened = false

            assertEquals(EntryDestination.RESULTS, viewModel.state.value.destination)

            viewModel.exitResults { accountLandingOpened = true }
            runCurrent()

            assertEquals(1, gateway.leaveCalls)
            assertEquals(0, gateway.endSessionCalls)
            assertEquals(EntryDestination.HOME, viewModel.state.value.destination)
            assertTrue(accountLandingOpened)
        }

    @Test
    fun remoteHostStartRoutesLobbyParticipantIntoGame() =
        runTest(mainDispatcherRule.dispatcher) {
            val lobby = room(RoomStatus.LOBBY)
            val gateway =
                FakeGateway(
                    resumeTargets = ArrayDeque(listOf(ResumeTarget.Lobby(lobby))),
                    refreshRooms =
                        ArrayDeque(listOf(GatewayResult.Success(room(RoomStatus.ACTIVE)))),
                )
            val viewModel = EntryLobbyViewModel(gateway, SavedStateHandle())
            runCurrent()

            assertEquals(EntryDestination.LOBBY, viewModel.state.value.destination)
            advanceTimeBy(15_000)
            runCurrent()

            assertEquals(EntryDestination.GAME, viewModel.state.value.destination)
            assertEquals(1, gateway.refreshCalls)
        }

    @Test
    fun connectedRealtimeUsesSnapshotsWithoutPeriodicRoomFetches() =
        runTest(mainDispatcherRule.dispatcher) {
            val lobby = room(RoomStatus.LOBBY)
            val gateway =
                FakeGateway(
                    resumeTargets = ArrayDeque(listOf(ResumeTarget.Lobby(lobby))),
                    realtimeEnabled = true,
                )
            val viewModel = EntryLobbyViewModel(gateway, SavedStateHandle())
            runCurrent()
            gateway.connections.emit(
                com.impostergame.designsystem.component.ConnectionState.Connected
            )
            runCurrent()

            advanceTimeBy(120_000)
            runCurrent()
            assertEquals(0, gateway.refreshCalls)

            gateway.rooms.emit(room(RoomStatus.ACTIVE))
            runCurrent()
            assertEquals(EntryDestination.GAME, viewModel.state.value.destination)
        }

    @Test
    fun rapidLobbySettingChangesAreDebouncedIntoOneRequest() =
        runTest(mainDispatcherRule.dispatcher) {
            val lobby = room(RoomStatus.LOBBY, isHost = true)
            val gateway =
                FakeGateway(
                    resumeTargets = ArrayDeque(listOf(ResumeTarget.Lobby(lobby))),
                    settingsRoom = lobby,
                )
            val viewModel = EntryLobbyViewModel(gateway, SavedStateHandle())
            runCurrent()

            viewModel.updateTaskMinutes(20)
            viewModel.updateTaskMinutes(25)
            viewModel.updateTaskMinutes(30)
            advanceTimeBy(549)
            runCurrent()
            assertEquals(0, gateway.updateSettingsCalls)

            advanceTimeBy(1)
            runCurrent()

            assertEquals(1, gateway.updateSettingsCalls)
            assertEquals(30 * 60, gateway.lastSettingsInput?.taskPhaseSeconds)
            assertEquals(SettingsSaveState.Saved, viewModel.state.value.settingsSaveState)
            assertFalse(viewModel.state.value.settings.dirty)
            viewModel.showHome()
        }

    @Test
    fun selectingTheCurrentLobbyValueDoesNotCallSettingsApi() =
        runTest(mainDispatcherRule.dispatcher) {
            val lobby = room(RoomStatus.LOBBY, isHost = true)
            val gateway =
                FakeGateway(
                    resumeTargets = ArrayDeque(listOf(ResumeTarget.Lobby(lobby))),
                    settingsRoom = lobby,
                )
            val viewModel = EntryLobbyViewModel(gateway, SavedStateHandle())
            runCurrent()

            viewModel.updateTaskMinutes(lobby.settings.taskPhaseSeconds / 60)
            advanceTimeBy(1_000)
            runCurrent()

            assertEquals(0, gateway.updateSettingsCalls)
            viewModel.showHome()
        }

    @Test
    fun editsDuringSettingsSaveQueueOnlyTheLatestPayload() =
        runTest(mainDispatcherRule.dispatcher) {
            val lobby = room(RoomStatus.LOBBY, isHost = true)
            val gate = CompletableDeferred<Unit>()
            val gateway =
                FakeGateway(
                    resumeTargets = ArrayDeque(listOf(ResumeTarget.Lobby(lobby))),
                    settingsRoom = lobby,
                    firstSettingsGate = gate,
                )
            val viewModel = EntryLobbyViewModel(gateway, SavedStateHandle())
            runCurrent()

            viewModel.updateTaskMinutes(20)
            advanceTimeBy(550)
            runCurrent()
            assertEquals(1, gateway.updateSettingsCalls)

            viewModel.updateTaskMinutes(25)
            viewModel.updateTaskMinutes(30)
            advanceTimeBy(550)
            runCurrent()
            assertEquals(1, gateway.updateSettingsCalls)

            gate.complete(Unit)
            runCurrent()

            assertEquals(2, gateway.updateSettingsCalls)
            assertEquals(30 * 60, gateway.lastSettingsInput?.taskPhaseSeconds)
            assertEquals(SettingsSaveState.Saved, viewModel.state.value.settingsSaveState)
            viewModel.showHome()
        }

    @Test
    fun switchingFromCreateToJoinRequiresRoomLookupBeforeIdentity() =
        runTest(mainDispatcherRule.dispatcher) {
            val viewModel =
                EntryLobbyViewModel(
                    FakeGateway(ArrayDeque(listOf(ResumeTarget.Entry))),
                    SavedStateHandle(),
                )
            runCurrent()

            viewModel.showCreate()
            viewModel.setColor("fox")
            assertTrue(viewModel.state.value.form.availableColorIds.isNotEmpty())

            viewModel.showJoin()

            assertEquals(EntryDestination.JOIN, viewModel.state.value.destination)
            assertTrue(viewModel.state.value.form.availableColorIds.isEmpty())
            assertEquals(null, viewModel.state.value.form.selectedColorId)
            assertEquals(null, viewModel.state.value.form.spotsRemaining)
        }

    @Test
    fun roomOptionsKeepMinimumAndMaximumWithinValidRange() =
        runTest(mainDispatcherRule.dispatcher) {
            val viewModel =
                EntryLobbyViewModel(
                    FakeGateway(ArrayDeque(listOf(ResumeTarget.Entry))),
                    SavedStateHandle(),
                )
            runCurrent()

            viewModel.setMaximumPlayers(8)
            viewModel.setMinimumPlayers(12)

            assertEquals(8, viewModel.state.value.form.minPlayers)
            assertEquals(8, viewModel.state.value.form.maxPlayers)

            viewModel.setMinimumPlayers(5)
            viewModel.setMaximumPlayers(3)

            assertEquals(5, viewModel.state.value.form.minPlayers)
            assertEquals(5, viewModel.state.value.form.maxPlayers)
        }

    private fun room(status: RoomStatus, isHost: Boolean = false): RoomSnapshot =
        RoomSnapshot(
            id = "room",
            code = "ABC123",
            status = status,
            minPlayers = 3,
            maxPlayers = 15,
            settings =
                RoomSettings(
                    selectedTaskPack = null,
                    taskPhaseSeconds = 900,
                    meetingsPerPlayer = 2,
                    meetingDurationSeconds = 90,
                    meetingVotingMode = "timed",
                    voteVisibility = "private",
                    evidenceVisibility = "private",
                    imposterMeetingTaskRequirement = "one",
                    meetingCooldownSeconds = 90,
                    imposterCooldownSeconds = 50,
                    estimatedMeetingCooldownSeconds = 90,
                    imposterCount = 1,
                    allowedImposterCounts = listOf(1),
                    taskCounts = mapOf("medium" to 3),
                    roleCounts = emptyMap(),
                ),
            participants = emptyList(),
            self = ParticipantSelf("player", "Player", "fox", isHost, emptyList()),
            expiresAt = "2026-09-29T00:00:00Z",
            gameId = if (status == RoomStatus.ACTIVE) "game" else null,
        )
}

private class FakeGateway(
    private val resumeTargets: ArrayDeque<ResumeTarget>,
    private val refreshRooms: ArrayDeque<GatewayResult<RoomSnapshot>> = ArrayDeque(),
    private val settingsRoom: RoomSnapshot? = null,
    private var firstSettingsGate: CompletableDeferred<Unit>? = null,
    private val realtimeEnabled: Boolean = false,
) : EntryLobbyGateway {
    val rooms = MutableSharedFlow<RoomSnapshot>(extraBufferCapacity = 4)
    val connections =
        MutableSharedFlow<com.impostergame.designsystem.component.ConnectionState>(
            extraBufferCapacity = 4
        )
    override val supportsRealtime: Boolean = realtimeEnabled
    override val roomUpdates = rooms
    override val connectionUpdates = connections
    var resumeCalls = 0
    var refreshCalls = 0
    var updateSettingsCalls = 0
    var leaveCalls = 0
    var endSessionCalls = 0
    var lastSettingsInput: RoomSettingsInput? = null

    override suspend fun resume(): ResumeTarget {
        resumeCalls += 1
        return resumeTargets.removeFirst()
    }

    override suspend fun joinOptions(code: String): GatewayResult<RoomJoinOptions> =
        error("Not used")

    override suspend fun create(
        nickname: String,
        colorId: String,
        minPlayers: Int,
        maxPlayers: Int,
        idempotencyKey: String,
    ): GatewayResult<RoomSnapshot> = error("Not used")

    override suspend fun join(
        code: String,
        nickname: String,
        colorId: String,
        idempotencyKey: String,
    ): GatewayResult<RoomSnapshot> = error("Not used")

    override suspend fun refreshRoom(): GatewayResult<RoomSnapshot> {
        refreshCalls += 1
        return refreshRooms.removeFirst()
    }

    override suspend fun taskPacks(): GatewayResult<List<PublicTaskPack>> =
        GatewayResult.Success(emptyList())

    override suspend fun updateSettings(input: RoomSettingsInput): GatewayResult<RoomSnapshot> {
        updateSettingsCalls += 1
        lastSettingsInput = input
        firstSettingsGate?.also {
            firstSettingsGate = null
            it.await()
        }
        val room = checkNotNull(settingsRoom)
        return GatewayResult.Success(
            room.copy(
                settings =
                    room.settings.copy(
                        taskPhaseSeconds = input.taskPhaseSeconds ?: room.settings.taskPhaseSeconds,
                        meetingsPerPlayer =
                            input.meetingsPerPlayer ?: room.settings.meetingsPerPlayer,
                        meetingDurationSeconds =
                            input.meetingDurationSeconds ?: room.settings.meetingDurationSeconds,
                        meetingVotingMode =
                            input.meetingVotingMode ?: room.settings.meetingVotingMode,
                        voteVisibility = input.voteVisibility ?: room.settings.voteVisibility,
                        evidenceVisibility =
                            input.evidenceVisibility ?: room.settings.evidenceVisibility,
                        imposterMeetingTaskRequirement =
                            input.imposterMeetingTaskRequirement
                                ?: room.settings.imposterMeetingTaskRequirement,
                        meetingCooldownSeconds =
                            input.meetingCooldownSeconds ?: room.settings.meetingCooldownSeconds,
                        imposterCooldownSeconds =
                            input.imposterCooldownSeconds ?: room.settings.imposterCooldownSeconds,
                        imposterCount = input.imposterCount ?: room.settings.imposterCount,
                        taskCounts = input.taskCounts ?: room.settings.taskCounts,
                        roleCounts = input.roleCounts ?: room.settings.roleCounts,
                    )
            )
        )
    }

    override suspend fun start(): GatewayResult<GameSnapshot> = error("Not used")

    override suspend fun leave(): GatewayResult<Unit> {
        leaveCalls += 1
        return GatewayResult.Success(Unit)
    }

    override suspend fun endSession(): GatewayResult<Unit> {
        endSessionCalls += 1
        return GatewayResult.Success(Unit)
    }
}
