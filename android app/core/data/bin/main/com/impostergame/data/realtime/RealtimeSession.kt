package com.impostergame.data.realtime

import com.impostergame.data.network.ApiResult
import com.impostergame.data.operations.OperationalMetric
import com.impostergame.data.operations.OperationalOutcome
import com.impostergame.data.operations.PrivacySafeOperations
import com.impostergame.data.repository.ConnectionState
import com.impostergame.data.repository.ConnectivityRepository
import com.impostergame.data.repository.GameRepository
import com.impostergame.data.repository.PresenceRepository
import com.impostergame.data.repository.RoomRepository
import com.impostergame.data.repository.SnapshotApplyResult
import com.impostergame.data.session.SessionStore
import kotlin.math.min
import kotlin.random.Random
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class RealtimeSession(
    private val scope: CoroutineScope,
    private val transport: RealtimeTransport,
    private val protocol: RealtimeProtocol,
    private val roomRepository: RoomRepository,
    private val gameRepository: GameRepository,
    private val presenceRepository: PresenceRepository,
    private val connectivity: ConnectivityRepository,
    private val sessionStore: SessionStore,
    private val backoff: ReconnectBackoff = ReconnectBackoff(),
    private val operations: PrivacySafeOperations = PrivacySafeOperations(),
) {
    private val resyncMutex = Mutex()
    private var job: Job? = null
    private var revoked = false
    private var gameResyncPending = false

    fun start(token: String) {
        stop()
        revoked = false
        job = scope.launch { connectLoop(token) }
    }

    fun stop() {
        job?.cancel()
        job = null
        transport.disconnect()
        if (!revoked) connectivity.update(ConnectionState.DISCONNECTED)
    }

    private suspend fun connectLoop(token: String) {
        var attempt = 0
        var reconnecting = false
        while (!revoked) {
            connectivity.update(ConnectionState.CONNECTING)
            transport.connect(token)
            try {
                transport.events().collect { event ->
                    when (event) {
                        TransportEvent.Connected -> {
                            if (reconnecting) {
                                operations.record(
                                    OperationalMetric.SOCKET_RECONNECT,
                                    OperationalOutcome.SUCCEEDED,
                                )
                                reconnecting = false
                            }
                            attempt = 0
                            connectivity.update(ConnectionState.CONNECTED)
                            transport.heartbeat()
                        }
                        is TransportEvent.Payload -> handle(protocol.decode(event.value))
                        is TransportEvent.Disconnected,
                        is TransportEvent.Failed -> throw ReconnectRequired()
                    }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: SessionEnded) {
                return
            } catch (_: ReconnectRequired) {
                if (!revoked) {
                    reconnecting = true
                    operations.record(
                        OperationalMetric.SOCKET_RECONNECT,
                        OperationalOutcome.RETRYING,
                    )
                    connectivity.update(ConnectionState.BACKING_OFF)
                    backoff.pause(attempt++)
                }
            }
        }
    }

    private suspend fun handle(event: RealtimeEvent) {
        when (event) {
            is RealtimeEvent.ServerReady -> transport.heartbeat()
            is RealtimeEvent.RoomUpdated -> roomRepository.replace(event.snapshot)
            is RealtimeEvent.GameUpdated ->
                when (gameRepository.applyRealtime(event.snapshot)) {
                    SnapshotApplyResult.Applied -> markGameResynced()
                    is SnapshotApplyResult.VersionGap -> resyncGameOnce()
                    else -> Unit
                }
            is RealtimeEvent.PresenceChanged ->
                presenceRepository.update(event.participantId, event.presence)
            is RealtimeEvent.ResyncRequired -> resyncAllOnce()
            is RealtimeEvent.SessionRevoked -> revoke()
        }
        if (revoked) throw SessionEnded()
    }

    private suspend fun resyncGameOnce() {
        resyncMutex.withLock {
            if (!gameResyncPending) {
                gameResyncPending = true
                operations.record(OperationalMetric.RESYNC, OperationalOutcome.STARTED)
                transport.emit("game.resync")
            }
        }
    }

    private suspend fun markGameResynced() {
        resyncMutex.withLock {
            if (gameResyncPending) {
                operations.record(OperationalMetric.RESYNC, OperationalOutcome.SUCCEEDED)
            }
            gameResyncPending = false
        }
    }

    private suspend fun resyncAllOnce() {
        resyncMutex.withLock {
            operations.record(OperationalMetric.RESYNC, OperationalOutcome.STARTED)
            val roomResult = roomRepository.refresh()
            val gameResult = gameRepository.refresh()
            operations.record(
                OperationalMetric.RESYNC,
                if (roomResult is ApiResult.Success && gameResult is ApiResult.Success) {
                    OperationalOutcome.SUCCEEDED
                } else {
                    OperationalOutcome.FAILED
                },
            )
        }
    }

    private suspend fun revoke() {
        operations.record(OperationalMetric.SESSION_REVOCATION, OperationalOutcome.SUCCEEDED)
        revoked = true
        transport.disconnect()
        sessionStore.clear()
        roomRepository.clear()
        gameRepository.clear()
        presenceRepository.clear()
        connectivity.update(ConnectionState.REVOKED)
    }
}

class ReconnectBackoff(
    private val minimumMillis: Long = 500,
    private val maximumMillis: Long = 10_000,
    private val jitter: (Long) -> Long = { upper -> Random.nextLong(0, upper + 1) },
    private val sleeper: suspend (Long) -> Unit = { delay(it) },
) {
    suspend fun pause(attempt: Int) {
        val exponent = attempt.coerceIn(0, 20)
        val ceiling = min(maximumMillis, minimumMillis * (1L shl exponent))
        sleeper(jitter(ceiling).coerceIn(0, maximumMillis))
    }
}

private class ReconnectRequired : RuntimeException()

private class SessionEnded : RuntimeException()
