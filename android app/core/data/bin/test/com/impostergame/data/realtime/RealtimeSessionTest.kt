package com.impostergame.data.realtime

import com.impostergame.data.GAME_ID
import com.impostergame.data.ROOM_ID
import com.impostergame.data.bootstrap.FakeSessionStore
import com.impostergame.data.bootstrap.credential
import com.impostergame.data.gameSnapshot
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.network.ApiResult
import com.impostergame.data.network.ContractJson
import com.impostergame.data.repository.ConnectionState
import com.impostergame.data.repository.ConnectivityRepository
import com.impostergame.data.repository.GameRepository
import com.impostergame.data.repository.GameSnapshotSource
import com.impostergame.data.repository.PresenceRepository
import com.impostergame.data.repository.RoomRepository
import com.impostergame.data.repository.RoomSnapshotSource
import com.impostergame.data.session.StoredSession
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RealtimeSessionTest {
    @Test
    fun gapRequestsOneResyncAndRevocationClearsSessionPermanently() = runTest {
        val transport = FakeTransport()
        val sessions = FakeSessionStore(StoredSession.Available(credential()))
        val gameRepository = GameRepository(GameSnapshotSource { ApiResult.Success(null, null) })
        gameRepository.applyRealtime(gameSnapshot(version = 1))
        val connectivity = ConnectivityRepository()
        val session =
            RealtimeSession(
                scope = backgroundScope,
                transport = transport,
                protocol = RealtimeProtocol(),
                roomRepository =
                    RoomRepository(RoomSnapshotSource { error("unexpected room refresh") }),
                gameRepository = gameRepository,
                presenceRepository = PresenceRepository(),
                connectivity = connectivity,
                sessionStore = sessions,
                backoff = ReconnectBackoff(jitter = { 0 }),
            )
        session.start("secret")
        testScheduler.runCurrent()

        transport.send(gameEvent(gameSnapshot(version = 3)))
        transport.send(gameEvent(gameSnapshot(version = 3)))
        testScheduler.runCurrent()
        assertEquals(1, transport.emitted.count { it == "game.resync" })

        transport.send(
            """{"schemaVersion":1,"type":"session.revoked","occurredAt":"2026-09-27T00:00:00Z","data":{"reason":"rotated"}}"""
        )
        testScheduler.runCurrent()

        assertEquals(StoredSession.None, sessions.session.value)
        assertEquals(ConnectionState.REVOKED, connectivity.state.value)
        assertEquals(1, transport.connectCount)
        assertTrue(transport.disconnected)
    }

    private fun gameEvent(snapshot: GameSnapshot): String =
        """{"schemaVersion":1,"type":"game.snapshot","roomId":"$ROOM_ID","gameId":"$GAME_ID","stateVersion":${snapshot.stateVersion},"occurredAt":"2026-09-27T00:00:00Z","data":${ContractJson.instance.encodeToString(snapshot)}}"""
}

private class FakeTransport : RealtimeTransport {
    private val stream = MutableSharedFlow<TransportEvent>(extraBufferCapacity = 16)
    val emitted = mutableListOf<String>()
    var connectCount = 0
    var disconnected = false

    override fun events(): Flow<TransportEvent> = stream

    override fun connect(token: String) {
        connectCount++
    }

    override fun emit(event: String) {
        emitted += event
    }

    override suspend fun heartbeat(): String = "2026-09-27T00:00:00Z"

    override fun disconnect() {
        disconnected = true
    }

    fun send(payload: String) {
        check(stream.tryEmit(TransportEvent.Payload(payload)))
    }
}
