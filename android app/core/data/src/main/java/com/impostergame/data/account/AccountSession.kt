package com.impostergame.data.account

import java.time.Instant
import kotlinx.coroutines.flow.StateFlow

data class AccountCredential(
    val token: String,
    val sessionId: String,
    val expiresAt: Instant,
) {
    override fun toString(): String =
        "AccountCredential(token=██REDACTED██, sessionId=██REDACTED██, expiresAt=$expiresAt)"
}

sealed interface StoredAccountSession {
    data object None : StoredAccountSession

    data class Available(val credential: AccountCredential) : StoredAccountSession

    data class Unavailable(val reason: String) : StoredAccountSession
}

interface AccountSessionStore {
    val session: StateFlow<StoredAccountSession>

    suspend fun restore(): StoredAccountSession

    suspend fun save(credential: AccountCredential)

    suspend fun clear()
}
