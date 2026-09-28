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
            advanceTimeBy(5_000)
            runCurrent()

            assertEquals(EntryDestination.GAME, viewModel.state.value.destination)
            assertEquals(1, gateway.refreshCalls)
        }

    private fun room(status: RoomStatus): RoomSnapshot =
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
            self = ParticipantSelf("player", "Player", "fox", false, emptyList()),
            expiresAt = "2026-09-29T00:00:00Z",
            gameId = if (status == RoomStatus.ACTIVE) "game" else null,
        )
}

private class FakeGateway(
    private val resumeTargets: ArrayDeque<ResumeTarget>,
    private val refreshRooms: ArrayDeque<GatewayResult<RoomSnapshot>> = ArrayDeque(),
) : EntryLobbyGateway {
    var resumeCalls = 0
    var refreshCalls = 0

    override suspend fun resume(): ResumeTarget {
        resumeCalls += 1
        return resumeTargets.removeFirst()
    }

    override suspend fun joinOptions(code: String): GatewayResult<RoomJoinOptions> =
        error("Not used")

    override suspend fun create(
        nickname: String,
        colorId: String,
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

    override suspend fun updateSettings(input: RoomSettingsInput): GatewayResult<RoomSnapshot> =
        error("Not used")

    override suspend fun start(): GatewayResult<GameSnapshot> = error("Not used")

    override suspend fun leave(): GatewayResult<Unit> = error("Not used")

    override suspend fun endSession(): GatewayResult<Unit> = error("Not used")
}
