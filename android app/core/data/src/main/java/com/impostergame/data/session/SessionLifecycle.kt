package com.impostergame.data.session

interface SessionLifecycle {
    suspend fun rotate(): ParticipantCredential

    suspend fun leaveRoom()

    suspend fun revokeLocalSession()
}

class DefaultSessionLifecycle(
    private val store: SessionStore,
    private val rotateRemote: suspend () -> ParticipantCredential,
    private val leaveRemote: suspend () -> Unit,
) : SessionLifecycle {
    override suspend fun rotate(): ParticipantCredential {
        val rotated = rotateRemote()
        store.save(rotated)
        return rotated
    }

    override suspend fun leaveRoom() {
        leaveRemote()
        store.clear()
    }

    override suspend fun revokeLocalSession() {
        store.clear()
    }
}
