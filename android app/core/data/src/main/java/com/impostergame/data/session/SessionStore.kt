package com.impostergame.data.session

import java.time.Instant
import kotlinx.coroutines.flow.StateFlow

data class ParticipantCredential(val token: String, val expiresAt: Instant) {
    override fun toString(): String =
        "ParticipantCredential(token=██REDACTED██, expiresAt=$expiresAt)"
}

sealed interface StoredSession {
    data object None : StoredSession

    data class Available(val credential: ParticipantCredential) : StoredSession

    data class Unavailable(val reason: String) : StoredSession
}

interface SessionStore {
    val session: StateFlow<StoredSession>

    suspend fun restore(): StoredSession

    suspend fun save(credential: ParticipantCredential)

    suspend fun clear()
}
