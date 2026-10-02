package com.impostergame.android.entry

import com.impostergame.android.sanitizedForDisplay
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.PublicTaskPack
import com.impostergame.data.model.RoomCreationInput
import com.impostergame.data.model.RoomJoinOptions
import com.impostergame.data.model.RoomMembershipInput
import com.impostergame.data.model.RoomSettingsInput
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.RoomStatus
import com.impostergame.data.network.ApiFailure
import com.impostergame.data.network.ApiResult
import com.impostergame.data.network.ParticipantApi
import com.impostergame.data.session.ParticipantCredential
import com.impostergame.data.session.SessionStore
import com.impostergame.data.session.StoredSession
import java.time.Instant

sealed interface GatewayResult<out T> {
    data class Success<T>(val value: T) : GatewayResult<T>

    data class Failure(val error: ApiFailure) : GatewayResult<Nothing>
}

sealed interface ResumeTarget {
    data object Entry : ResumeTarget

    data class Lobby(val room: RoomSnapshot) : ResumeTarget

    data object Game : ResumeTarget

    data object Results : ResumeTarget

    data class Failed(val error: ApiFailure) : ResumeTarget
}

interface EntryLobbyGateway {
    suspend fun resume(): ResumeTarget

    suspend fun joinOptions(code: String): GatewayResult<RoomJoinOptions>

    suspend fun create(
        nickname: String,
        colorId: String,
        minPlayers: Int,
        maxPlayers: Int,
        idempotencyKey: String,
    ): GatewayResult<RoomSnapshot>

    suspend fun join(
        code: String,
        nickname: String,
        colorId: String,
        idempotencyKey: String,
    ): GatewayResult<RoomSnapshot>

    suspend fun refreshRoom(): GatewayResult<RoomSnapshot>

    suspend fun taskPacks(): GatewayResult<List<PublicTaskPack>>

    suspend fun updateSettings(input: RoomSettingsInput): GatewayResult<RoomSnapshot>

    suspend fun start(): GatewayResult<GameSnapshot>

    suspend fun leave(): GatewayResult<Unit>

    suspend fun endSession(): GatewayResult<Unit>
}

class UnavailableEntryLobbyGateway(private val reason: String) : EntryLobbyGateway {
    private fun failure(): GatewayResult.Failure =
        GatewayResult.Failure(ApiFailure.Transport(IllegalStateException(reason)))

    override suspend fun resume(): ResumeTarget = ResumeTarget.Entry

    override suspend fun joinOptions(code: String): GatewayResult<RoomJoinOptions> = failure()

    override suspend fun create(
        nickname: String,
        colorId: String,
        minPlayers: Int,
        maxPlayers: Int,
        idempotencyKey: String,
    ): GatewayResult<RoomSnapshot> = failure()

    override suspend fun join(
        code: String,
        nickname: String,
        colorId: String,
        idempotencyKey: String,
    ): GatewayResult<RoomSnapshot> = failure()

    override suspend fun refreshRoom(): GatewayResult<RoomSnapshot> = failure()

    override suspend fun taskPacks(): GatewayResult<List<PublicTaskPack>> = failure()

    override suspend fun updateSettings(input: RoomSettingsInput): GatewayResult<RoomSnapshot> =
        failure()

    override suspend fun start(): GatewayResult<GameSnapshot> = failure()

    override suspend fun leave(): GatewayResult<Unit> = failure()

    override suspend fun endSession(): GatewayResult<Unit> = failure()
}

class NetworkEntryLobbyGateway(
    private val api: ParticipantApi,
    private val sessions: SessionStore,
) : EntryLobbyGateway {
    override suspend fun resume(): ResumeTarget =
        when (sessions.restore()) {
            StoredSession.None,
            is StoredSession.Unavailable -> ResumeTarget.Entry
            is StoredSession.Available ->
                when (val result = api.fetch()) {
                    is ApiResult.Failure -> {
                        val error = result.error
                        if (error is ApiFailure.Http && error.status in listOf(401, 404)) {
                            sessions.clear()
                            ResumeTarget.Entry
                        } else {
                            ResumeTarget.Failed(error)
                        }
                    }
                    is ApiResult.Success ->
                        when (result.value.status) {
                            RoomStatus.LOBBY ->
                                ResumeTarget.Lobby(result.value.sanitizedForDisplay())
                            RoomStatus.ACTIVE -> ResumeTarget.Game
                            RoomStatus.COMPLETED,
                            RoomStatus.ABANDONED -> ResumeTarget.Results
                            RoomStatus.EXPIRED -> {
                                sessions.clear()
                                ResumeTarget.Entry
                            }
                        }
                }
        }

    override suspend fun joinOptions(code: String) = api.joinOptions(code).toGatewayResult()

    override suspend fun create(
        nickname: String,
        colorId: String,
        minPlayers: Int,
        maxPlayers: Int,
        idempotencyKey: String,
    ) = issueSession {
        api.createRoom(
            RoomCreationInput(nickname, colorId, minPlayers, maxPlayers),
            idempotencyKey,
        )
    }

    override suspend fun join(
        code: String,
        nickname: String,
        colorId: String,
        idempotencyKey: String,
    ) = issueSession {
        api.joinRoom(code, RoomMembershipInput(nickname, colorId), idempotencyKey)
    }

    override suspend fun refreshRoom() =
        api.fetch().toGatewayResult().mapSuccess(RoomSnapshot::sanitizedForDisplay)

    override suspend fun taskPacks() =
        api.taskPacks().toGatewayResult().mapSuccess { packs ->
            packs.map(PublicTaskPack::sanitizedForDisplay)
        }

    override suspend fun updateSettings(input: RoomSettingsInput) =
        api.updateSettings(input).toGatewayResult().mapSuccess(RoomSnapshot::sanitizedForDisplay)

    override suspend fun start() =
        api.startGame().toGatewayResult().mapSuccess(GameSnapshot::sanitizedForDisplay)

    override suspend fun leave(): GatewayResult<Unit> =
        when (val result = api.leaveRoom()) {
            is ApiResult.Failure -> GatewayResult.Failure(result.error)
            is ApiResult.Success -> {
                sessions.clear()
                GatewayResult.Success(Unit)
            }
        }

    override suspend fun endSession(): GatewayResult<Unit> =
        when (val result = api.endSession()) {
            is ApiResult.Failure -> {
                val error = result.error
                if (error is ApiFailure.Http && error.status in listOf(401, 404)) {
                    sessions.clear()
                    GatewayResult.Success(Unit)
                } else {
                    GatewayResult.Failure(error)
                }
            }
            is ApiResult.Success -> {
                sessions.clear()
                GatewayResult.Success(Unit)
            }
        }

    private suspend fun issueSession(
        block: suspend () -> ApiResult<com.impostergame.data.model.SessionIssue>
    ): GatewayResult<RoomSnapshot> =
        when (val result = block()) {
            is ApiResult.Failure -> GatewayResult.Failure(result.error)
            is ApiResult.Success -> {
                val issue = result.value
                sessions.save(
                    ParticipantCredential(issue.sessionToken, Instant.parse(issue.sessionExpiresAt))
                )
                GatewayResult.Success(issue.room.sanitizedForDisplay())
            }
        }
}

private fun <T> ApiResult<T>.toGatewayResult(): GatewayResult<T> =
    when (this) {
        is ApiResult.Failure -> GatewayResult.Failure(error)
        is ApiResult.Success -> GatewayResult.Success(value)
    }

private inline fun <T, R> GatewayResult<T>.mapSuccess(transform: (T) -> R): GatewayResult<R> =
    when (this) {
        is GatewayResult.Failure -> this
        is GatewayResult.Success -> GatewayResult.Success(transform(value))
    }
