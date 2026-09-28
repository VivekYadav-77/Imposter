package com.impostergame.data.realtime

import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.network.ContractJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

sealed interface RealtimeEvent {
    data class ServerReady(val occurredAt: String) : RealtimeEvent

    data class RoomUpdated(val roomId: String, val snapshot: RoomSnapshot) : RealtimeEvent

    data class GameUpdated(
        val roomId: String,
        val gameId: String,
        val stateVersion: Long,
        val snapshot: GameSnapshot,
    ) : RealtimeEvent

    data class PresenceChanged(
        val roomId: String,
        val participantId: String,
        val presence: String,
    ) : RealtimeEvent

    data class ResyncRequired(val roomId: String, val reason: String) : RealtimeEvent

    data class SessionRevoked(val reason: String) : RealtimeEvent
}

class RealtimeProtocol(private val json: Json = ContractJson.instance) {
    fun decode(payload: String): RealtimeEvent {
        val root = json.parseToJsonElement(payload).jsonObject
        val version = root.requiredInt("schemaVersion")
        require(version == SCHEMA_VERSION) { "Unsupported realtime schema version: $version" }
        return when (val type = root.requiredString("type")) {
            "server.ready" -> RealtimeEvent.ServerReady(root.requiredString("occurredAt"))
            "room.snapshot" ->
                RealtimeEvent.RoomUpdated(
                    root.requiredString("roomId"),
                    json.decodeFromJsonElement(RoomSnapshot.serializer(), root.required("data")),
                )
            "game.snapshot" ->
                RealtimeEvent.GameUpdated(
                    roomId = root.requiredString("roomId"),
                    gameId = root.requiredString("gameId"),
                    stateVersion = root.requiredLong("stateVersion"),
                    snapshot =
                        json.decodeFromJsonElement(
                            GameSnapshot.serializer(),
                            root.required("data"),
                        ),
                )
            "presence.changed" -> {
                val data = root.required("data").jsonObject
                RealtimeEvent.PresenceChanged(
                    root.requiredString("roomId"),
                    data.requiredString("participantId"),
                    data.requiredString("presence"),
                )
            }
            "server.resync_required" -> {
                val data = root.required("data").jsonObject
                RealtimeEvent.ResyncRequired(
                    root.requiredString("roomId"),
                    data.requiredString("reason"),
                )
            }
            "session.revoked" -> {
                val data = root.required("data").jsonObject
                RealtimeEvent.SessionRevoked(data.requiredString("reason"))
            }
            else -> throw IllegalArgumentException("Unsupported realtime event: $type")
        }
    }

    private companion object {
        const val SCHEMA_VERSION = 1
    }
}

private fun Map<String, JsonElement>.required(name: String): JsonElement =
    checkNotNull(this[name]) { "Missing realtime property: $name" }

private fun Map<String, JsonElement>.requiredString(name: String): String =
    required(name).jsonPrimitive.content

private fun Map<String, JsonElement>.requiredInt(name: String): Int =
    required(name).jsonPrimitive.content.toInt()

private fun Map<String, JsonElement>.requiredLong(name: String): Long =
    required(name).jsonPrimitive.content.toLong()

@Serializable internal data class HeartbeatAck(val serverTime: String? = null)
