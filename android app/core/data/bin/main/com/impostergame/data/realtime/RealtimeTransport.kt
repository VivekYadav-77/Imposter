package com.impostergame.data.realtime

import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.engineio.client.transports.WebSocket
import java.net.URI
import kotlin.coroutines.resume
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject

sealed interface TransportEvent {
    data object Connected : TransportEvent

    data class Payload(val value: String) : TransportEvent

    data class Disconnected(val reason: String) : TransportEvent

    data class Failed(val reason: String) : TransportEvent
}

interface RealtimeTransport {
    fun events(): Flow<TransportEvent>

    fun connect(token: String)

    fun emit(event: String)

    suspend fun heartbeat(): String?

    fun disconnect()
}

class SocketIoRealtimeTransport(
    serverUrl: URI,
    allowInsecureLocalDebug: Boolean = false,
) : RealtimeTransport {
    private val options =
        IO.Options.builder()
            .setPath("/realtime")
            .setTransports(arrayOf(WebSocket.NAME))
            .setReconnection(false)
            .setTimeout(15_000)
            .setAuth(mutableMapOf())
            .build()
    private val socket =
        IO.socket(
            validateServerUrl(serverUrl, allowInsecureLocalDebug),
            options,
        )

    override fun events(): Flow<TransportEvent> = callbackFlow {
        val connect = io.socket.emitter.Emitter.Listener { trySend(TransportEvent.Connected) }
        val disconnect =
            io.socket.emitter.Emitter.Listener { args ->
                trySend(TransportEvent.Disconnected(args.firstOrNull()?.toString().orEmpty()))
            }
        val error =
            io.socket.emitter.Emitter.Listener { args ->
                trySend(TransportEvent.Failed(args.firstOrNull()?.toString().orEmpty()))
            }
        val payloadListeners = EVENT_NAMES.associateWith { eventName ->
            io.socket.emitter.Emitter.Listener { args ->
                val payload = args.firstOrNull()
                val value =
                    when (payload) {
                        is JSONObject ->
                            JSONObject(payload.toString())
                                .apply { if (!has("type")) put("type", eventName) }
                                .toString()
                        is String ->
                            runCatching {
                                    JSONObject(payload)
                                        .apply { if (!has("type")) put("type", eventName) }
                                        .toString()
                                }
                                .getOrDefault(payload)
                        else -> return@Listener
                    }
                trySend(TransportEvent.Payload(value))
            }
        }
        socket.on(Socket.EVENT_CONNECT, connect)
        socket.on(Socket.EVENT_DISCONNECT, disconnect)
        socket.on(Socket.EVENT_CONNECT_ERROR, error)
        payloadListeners.forEach { (eventName, listener) -> socket.on(eventName, listener) }
        awaitClose {
            socket.off(Socket.EVENT_CONNECT, connect)
            socket.off(Socket.EVENT_DISCONNECT, disconnect)
            socket.off(Socket.EVENT_CONNECT_ERROR, error)
            payloadListeners.forEach { (eventName, listener) -> socket.off(eventName, listener) }
        }
    }

    override fun connect(token: String) {
        check(token.isNotBlank())
        options.auth["token"] = token
        socket.connect()
    }

    override fun emit(event: String) {
        socket.emit(event)
    }

    override suspend fun heartbeat(): String? =
        withTimeoutOrNull(5_000) {
            suspendCancellableCoroutine { continuation ->
                socket.emit(
                    "heartbeat",
                    Ack { args ->
                        if (continuation.isActive)
                            continuation.resume(args.firstOrNull()?.toString())
                    },
                )
            }
        }

    override fun disconnect() {
        socket.disconnect()
    }

    private companion object {
        val EVENT_NAMES =
            listOf(
                "server.ready",
                "room.snapshot",
                "game.snapshot",
                "presence.changed",
                "server.resync_required",
                "session.revoked",
            )

        fun validateServerUrl(uri: URI, allowInsecureLocalDebug: Boolean): URI {
            val secure = uri.scheme.equals("https", true) || uri.scheme.equals("wss", true)
            val local = uri.host == "localhost" || uri.host == "127.0.0.1" || uri.host == "10.0.2.2"
            require(secure || (allowInsecureLocalDebug && local)) {
                "Secure realtime transport is required outside an explicitly enabled local debug endpoint"
            }
            return uri
        }
    }
}
