package com.impostergame.data.realtime

import com.impostergame.data.ROOM_ID
import com.impostergame.data.gameSnapshot
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.network.ContractJson
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RealtimeProtocolTest {
    private val protocol = RealtimeProtocol()

    @Test
    fun documentedFixtureEventsDeserialize() {
        assertTrue(protocol.decode(base("server.ready")) is RealtimeEvent.ServerReady)
        assertTrue(
            protocol.decode(
                """{"schemaVersion":1,"type":"presence.changed","roomId":"$ROOM_ID","occurredAt":"2026-09-21T00:00:00Z","data":{"participantId":"p","presence":"connected"}}"""
            ) is RealtimeEvent.PresenceChanged
        )
        assertTrue(
            protocol.decode(
                """{"schemaVersion":1,"type":"server.resync_required","roomId":"$ROOM_ID","occurredAt":"2026-09-21T00:00:00Z","data":{"reason":"snapshot_failed"}}"""
            ) is RealtimeEvent.ResyncRequired
        )
        assertTrue(
            protocol.decode(
                """{"schemaVersion":1,"type":"session.revoked","occurredAt":"2026-09-21T00:00:00Z","data":{"reason":"rotated"}}"""
            ) is RealtimeEvent.SessionRevoked
        )
    }

    @Test
    fun gameSnapshotsDeserializeForEveryAuthoritativePhase() {
        GamePhase.entries.forEach { phase ->
            val snapshot = gameSnapshot(phase = phase)
            val payload = buildJsonObject {
                put("schemaVersion", 1)
                put("type", "game.snapshot")
                put("roomId", snapshot.roomId)
                put("gameId", snapshot.id)
                put("stateVersion", snapshot.stateVersion)
                put("occurredAt", "2026-09-27T00:00:00Z")
                put(
                    "data",
                    ContractJson.instance.encodeToJsonElement(GameSnapshot.serializer(), snapshot),
                )
            }
                .toString()
            val event = protocol.decode(payload) as RealtimeEvent.GameUpdated
            assertEquals(phase, event.snapshot.phase)
        }
    }

    @Test(expected = IllegalArgumentException::class)
    fun unknownSchemaVersionFailsClosed() {
        protocol.decode(base("server.ready").replace("\"schemaVersion\":1", "\"schemaVersion\":2"))
    }

    private fun base(type: String) =
        """{"schemaVersion":1,"type":"$type","occurredAt":"2026-09-21T00:00:00Z"}"""
}
