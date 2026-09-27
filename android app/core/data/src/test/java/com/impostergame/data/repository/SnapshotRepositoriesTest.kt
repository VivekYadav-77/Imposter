package com.impostergame.data.repository

import com.impostergame.data.gameSnapshot
import com.impostergame.data.network.ApiResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class SnapshotRepositoriesTest {
    @Test
    fun lateHttpResponseCannotReplaceNewerRealtimeSnapshot() = runTest {
        val release = CompletableDeferred<Unit>()
        val repository =
            GameRepository(
                GameSnapshotSource {
                    release.await()
                    ApiResult.Success(gameSnapshot(version = 1), "old")
                }
            )
        val refresh = async { repository.refresh() }
        repository.applyRealtime(gameSnapshot(version = 2))
        release.complete(Unit)
        refresh.await()

        assertEquals(2L, repository.state.value.snapshot?.stateVersion)
    }

    @Test
    fun versionGapDoesNotMutateAuthoritativeSnapshot() = runTest {
        val repository = GameRepository(GameSnapshotSource { ApiResult.Success(null, null) })
        repository.applyRealtime(gameSnapshot(version = 1))

        val result = repository.applyRealtime(gameSnapshot(version = 3))

        org.junit.Assert.assertTrue(result is SnapshotApplyResult.VersionGap)
        assertEquals(1L, repository.state.value.snapshot?.stateVersion)
    }
}
