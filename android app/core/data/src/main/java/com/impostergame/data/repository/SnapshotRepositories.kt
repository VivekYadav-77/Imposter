package com.impostergame.data.repository

import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.network.ApiFailure
import com.impostergame.data.network.ApiResult
import java.time.Clock
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

enum class Freshness {
    EMPTY,
    REFRESHING,
    FRESH,
    STALE,
}

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    BACKING_OFF,
    REVOKED,
}

data class SnapshotState<T>(
    val snapshot: T? = null,
    val freshness: Freshness = Freshness.EMPTY,
    val lastSuccessfulSync: Instant? = null,
    val failure: ApiFailure? = null,
)

fun interface RoomSnapshotSource {
    suspend fun fetch(): ApiResult<RoomSnapshot>
}

fun interface GameSnapshotSource {
    suspend fun fetch(knownStateVersion: Long?): ApiResult<GameSnapshot?>
}

class RoomRepository(
    private val source: RoomSnapshotSource,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val refreshMutex = Mutex()
    private val stateMutex = Mutex()
    private var revision = 0L
    private val mutableState = MutableStateFlow(SnapshotState<RoomSnapshot>())
    val state: StateFlow<SnapshotState<RoomSnapshot>> = mutableState.asStateFlow()

    suspend fun refresh(): ApiResult<RoomSnapshot> = refreshMutex.withLock {
        val startRevision = stateMutex.withLock { revision }
        mutableState.value =
            mutableState.value.copy(freshness = Freshness.REFRESHING, failure = null)
        val result = source.fetch()
        stateMutex.withLock {
            when (result) {
                is ApiResult.Success -> {
                    if (revision == startRevision) {
                        revision++
                        mutableState.value =
                            SnapshotState(result.value, Freshness.FRESH, clock.instant(), null)
                    }
                }
                is ApiResult.Failure ->
                    mutableState.value =
                        mutableState.value.copy(freshness = Freshness.STALE, failure = result.error)
            }
        }
        result
    }

    suspend fun replace(snapshot: RoomSnapshot) {
        stateMutex.withLock {
            revision++
            mutableState.value = SnapshotState(snapshot, Freshness.FRESH, clock.instant(), null)
        }
    }

    suspend fun clear() {
        stateMutex.withLock {
            revision++
            mutableState.value = SnapshotState()
        }
    }
}

sealed interface SnapshotApplyResult {
    data object Applied : SnapshotApplyResult

    data object IgnoredOlder : SnapshotApplyResult

    data class VersionGap(val expected: Long, val received: Long) : SnapshotApplyResult
}

class GameRepository(
    private val source: GameSnapshotSource,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val refreshMutex = Mutex()
    private val stateMutex = Mutex()
    private val mutableState = MutableStateFlow(SnapshotState<GameSnapshot>())
    val state: StateFlow<SnapshotState<GameSnapshot>> = mutableState.asStateFlow()

    suspend fun refresh(): ApiResult<GameSnapshot?> = refreshMutex.withLock {
        val knownVersion = state.value.snapshot?.stateVersion
        mutableState.value =
            mutableState.value.copy(freshness = Freshness.REFRESHING, failure = null)
        val result = source.fetch(knownVersion)
        stateMutex.withLock {
            when (result) {
                is ApiResult.Success -> {
                    val incoming = result.value
                    val current = mutableState.value.snapshot
                    if (
                        incoming != null &&
                            (current == null || incoming.stateVersion >= current.stateVersion)
                    ) {
                        mutableState.value =
                            SnapshotState(incoming, Freshness.FRESH, clock.instant(), null)
                    } else {
                        mutableState.value =
                            mutableState.value.copy(
                                freshness = Freshness.FRESH,
                                lastSuccessfulSync = clock.instant(),
                                failure = null,
                            )
                    }
                }
                is ApiResult.Failure ->
                    mutableState.value =
                        mutableState.value.copy(freshness = Freshness.STALE, failure = result.error)
            }
        }
        result
    }

    suspend fun applyRealtime(snapshot: GameSnapshot): SnapshotApplyResult = stateMutex.withLock {
        val currentVersion = mutableState.value.snapshot?.stateVersion
        when {
            currentVersion == null || snapshot.stateVersion == currentVersion + 1 -> {
                mutableState.value = SnapshotState(snapshot, Freshness.FRESH, clock.instant(), null)
                SnapshotApplyResult.Applied
            }
            snapshot.stateVersion <= currentVersion -> SnapshotApplyResult.IgnoredOlder
            else -> SnapshotApplyResult.VersionGap(currentVersion + 1, snapshot.stateVersion)
        }
    }

    suspend fun clear() {
        stateMutex.withLock { mutableState.value = SnapshotState() }
    }
}

class ConnectivityRepository {
    private val mutableState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val state: StateFlow<ConnectionState> = mutableState.asStateFlow()

    fun update(value: ConnectionState) {
        mutableState.value = value
    }
}

class PresenceRepository {
    private val mutablePresence = MutableStateFlow<Map<String, String>>(emptyMap())
    val presence: StateFlow<Map<String, String>> = mutablePresence.asStateFlow()

    fun update(participantId: String, presence: String) {
        mutablePresence.value = mutablePresence.value + (participantId to presence)
    }

    fun clear() {
        mutablePresence.value = emptyMap()
    }
}
