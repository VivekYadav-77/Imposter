package com.impostergame.data.bootstrap

import com.impostergame.data.gameSnapshot
import com.impostergame.data.model.RoomStatus
import com.impostergame.data.network.ApiResult
import com.impostergame.data.repository.GameRepository
import com.impostergame.data.repository.GameSnapshotSource
import com.impostergame.data.repository.RoomRepository
import com.impostergame.data.repository.RoomSnapshotSource
import com.impostergame.data.roomSnapshot
import com.impostergame.data.session.ParticipantCredential
import com.impostergame.data.session.SessionStore
import com.impostergame.data.session.StoredSession
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BootstrapCoordinatorTest {
    @Test
    fun processRecreationRestoresRouteFromServerSnapshots() = runTest {
        val store = FakeSessionStore(StoredSession.Available(credential()))
        val coordinator =
            BootstrapCoordinator(
                store,
                RoomRepository(
                    RoomSnapshotSource { ApiResult.Success(roomSnapshot(RoomStatus.ACTIVE), null) }
                ),
                GameRepository(GameSnapshotSource { ApiResult.Success(gameSnapshot(), null) }),
            )

        coordinator.bootstrap()

        assertTrue(coordinator.destination.value is BootstrapDestination.Game)
    }

    @Test
    fun missingCredentialReturnsToEntryWithoutUsingUiState() = runTest {
        val coordinator =
            BootstrapCoordinator(
                FakeSessionStore(StoredSession.None),
                RoomRepository(RoomSnapshotSource { error("must not fetch") }),
                GameRepository(GameSnapshotSource { error("must not fetch") }),
            )
        coordinator.bootstrap()
        assertEquals(BootstrapDestination.Entry, coordinator.destination.value)
    }
}

internal class FakeSessionStore(initial: StoredSession) : SessionStore {
    private val mutable = MutableStateFlow(initial)
    override val session: StateFlow<StoredSession> = mutable

    override suspend fun restore(): StoredSession = mutable.value

    override suspend fun save(credential: ParticipantCredential) {
        mutable.value = StoredSession.Available(credential)
    }

    override suspend fun clear() {
        mutable.value = StoredSession.None
    }
}

internal fun credential() = ParticipantCredential("secret", Instant.parse("2099-01-01T00:00:00Z"))
