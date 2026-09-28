package com.impostergame.data.bootstrap

import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.RoomStatus
import com.impostergame.data.network.ApiFailure
import com.impostergame.data.network.ApiResult
import com.impostergame.data.operations.OperationalMetric
import com.impostergame.data.operations.OperationalOutcome
import com.impostergame.data.operations.PrivacySafeOperations
import com.impostergame.data.repository.GameRepository
import com.impostergame.data.repository.RoomRepository
import com.impostergame.data.session.SessionStore
import com.impostergame.data.session.StoredSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface BootstrapDestination {
    data object Starting : BootstrapDestination

    data object Entry : BootstrapDestination

    data object Lobby : BootstrapDestination

    data class Game(val phase: GamePhase) : BootstrapDestination

    data object Result : BootstrapDestination

    data class RecoverableOffline(val failure: ApiFailure) : BootstrapDestination

    data class SecureStorageUnavailable(val reason: String) : BootstrapDestination
}

class BootstrapCoordinator(
    private val sessions: SessionStore,
    private val rooms: RoomRepository,
    private val games: GameRepository,
    private val operations: PrivacySafeOperations = PrivacySafeOperations(),
) {
    private val mutableDestination =
        MutableStateFlow<BootstrapDestination>(BootstrapDestination.Starting)
    val destination: StateFlow<BootstrapDestination> = mutableDestination.asStateFlow()

    suspend fun bootstrap() {
        operations.record(OperationalMetric.BOOTSTRAP, OperationalOutcome.STARTED)
        mutableDestination.value = BootstrapDestination.Starting
        when (val stored = sessions.restore()) {
            StoredSession.None -> mutableDestination.value = BootstrapDestination.Entry
            is StoredSession.Unavailable ->
                mutableDestination.value =
                    BootstrapDestination.SecureStorageUnavailable(stored.reason)
            is StoredSession.Available -> bootstrapAuthenticated()
        }
        operations.record(
            OperationalMetric.BOOTSTRAP,
            if (
                mutableDestination.value is BootstrapDestination.RecoverableOffline ||
                    mutableDestination.value is BootstrapDestination.SecureStorageUnavailable
            ) {
                OperationalOutcome.FAILED
            } else {
                OperationalOutcome.SUCCEEDED
            },
        )
    }

    private suspend fun bootstrapAuthenticated() {
        when (val roomResult = rooms.refresh()) {
            is ApiResult.Failure -> handleFailure(roomResult.error)
            is ApiResult.Success ->
                when (roomResult.value.status) {
                    RoomStatus.LOBBY -> mutableDestination.value = BootstrapDestination.Lobby
                    RoomStatus.ACTIVE -> loadActiveGame()
                    RoomStatus.COMPLETED,
                    RoomStatus.ABANDONED -> mutableDestination.value = BootstrapDestination.Result
                    RoomStatus.EXPIRED -> clearAndEnter()
                }
        }
    }

    private suspend fun loadActiveGame() {
        when (val gameResult = games.refresh()) {
            is ApiResult.Failure -> handleFailure(gameResult.error)
            is ApiResult.Success -> {
                val snapshot = gameResult.value
                mutableDestination.value =
                    if (snapshot == null) {
                        BootstrapDestination.RecoverableOffline(
                            ApiFailure.Contract(
                                IllegalStateException("Active room has no game snapshot")
                            )
                        )
                    } else if (
                        snapshot.phase == GamePhase.GAME_OVER ||
                            snapshot.phase == GamePhase.ABANDONED
                    ) {
                        BootstrapDestination.Result
                    } else {
                        BootstrapDestination.Game(snapshot.phase)
                    }
            }
        }
    }

    private suspend fun handleFailure(failure: ApiFailure) {
        if (failure is ApiFailure.Http && (failure.status == 401 || failure.status == 404)) {
            clearAndEnter()
        } else {
            mutableDestination.value = BootstrapDestination.RecoverableOffline(failure)
        }
    }

    private suspend fun clearAndEnter() {
        sessions.clear()
        rooms.clear()
        games.clear()
        mutableDestination.value = BootstrapDestination.Entry
    }
}
