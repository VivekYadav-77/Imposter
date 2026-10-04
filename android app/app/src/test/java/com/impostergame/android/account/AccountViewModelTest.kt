package com.impostergame.android.account

import com.impostergame.android.MainDispatcherRule
import com.impostergame.data.account.AccountCredential
import com.impostergame.data.account.AccountRejoinIssue
import com.impostergame.data.account.DashboardData
import com.impostergame.data.account.DashboardStats
import com.impostergame.data.account.HistoryPage
import com.impostergame.data.account.MobileGoogleChallenge
import com.impostergame.data.account.StoredAccountSession
import com.impostergame.data.account.UserGameDetail
import com.impostergame.data.account.UserProfile
import com.impostergame.data.account.UserSession
import com.impostergame.data.network.ApiFailure
import com.impostergame.data.network.ApiResult
import java.time.Instant
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AccountViewModelTest {
    @get:Rule val dispatcherRule = MainDispatcherRule()

    @Test
    fun validStoredAccountAutoLogsIntoDashboard() = runTest {
        val gateway = FakeAccountGateway()
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
            )

        advanceUntilIdle()

        assertEquals(AccountDestination.DASHBOARD, viewModel.state.value.destination)
        assertEquals("Player", viewModel.state.value.profile?.displayName)
        assertNotNull(viewModel.state.value.dashboard)
    }

    @Test
    fun cancelledGoogleFlowReturnsToChoiceWithoutCreatingSession() = runTest {
        val gateway = FakeAccountGateway(restore = StoredAccountSession.None)
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
            )
        viewModel.showAuthChoice(PendingGuestEntry.JOIN)
        viewModel.continueWithGoogle("play")

        advanceUntilIdle()

        assertEquals(AccountDestination.AUTH_CHOICE, viewModel.state.value.destination)
        assertEquals("Google sign-in was cancelled.", viewModel.state.value.message)
        assertEquals(0, gateway.completeCalls)
    }

    @Test
    fun unauthorizedStoredAccountFallsBackWithoutTouchingGameplayState() = runTest {
        val gateway =
            FakeAccountGateway(
                dashboardResult =
                    ApiResult.Failure(
                        ApiFailure.Http(401, "USER_SESSION_INVALID", "Sign in.", null, null, null)
                    )
            )
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
            )

        advanceUntilIdle()

        assertEquals(AccountDestination.NONE, viewModel.state.value.destination)
        assertEquals(
            "Your account session has ended. Sign in again.",
            viewModel.state.value.message,
        )
        assertEquals(AccountSessionStatus.SIGNED_OUT, viewModel.state.value.sessionStatus)
    }

    @Test
    fun activeParticipantPathValidatesAccountWithoutOpeningDashboard() = runTest {
        val gateway = FakeAccountGateway()
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
                autoBootstrap = false,
            )

        viewModel.restorePresence()
        advanceUntilIdle()

        assertEquals(AccountDestination.NONE, viewModel.state.value.destination)
        assertEquals(true, viewModel.state.value.accountCredentialPresent)
        assertEquals(AccountSessionStatus.AUTHENTICATED, viewModel.state.value.sessionStatus)
        assertEquals(1, gateway.meCalls)
        assertEquals(0, gateway.dashboardCalls)
    }

    @Test
    fun signedInResultExitOpensDashboard() = runTest {
        val gateway = FakeAccountGateway()
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
                autoBootstrap = false,
            )
        viewModel.restorePresence()
        advanceUntilIdle()

        viewModel.showDashboardAfterResults()
        advanceUntilIdle()

        assertEquals(AccountDestination.DASHBOARD, viewModel.state.value.destination)
        assertEquals(1, gateway.dashboardCalls)
    }

    @Test
    fun guestResultExitDoesNotOpenDashboard() = runTest {
        val gateway = FakeAccountGateway(restore = StoredAccountSession.None)
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
                autoBootstrap = false,
            )

        viewModel.showDashboardAfterResults()
        advanceUntilIdle()

        assertEquals(AccountDestination.NONE, viewModel.state.value.destination)
        assertEquals(0, gateway.dashboardCalls)
    }

    @Test
    fun participantPathPreservesCredentialAndSuppressesGuestPromptOnTransportFailure() = runTest {
        val gateway =
            FakeAccountGateway(
                meResult = ApiResult.Failure(ApiFailure.Transport(IllegalStateException("offline")))
            )
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
                autoBootstrap = false,
            )

        viewModel.restorePresence()
        advanceUntilIdle()

        assertEquals(true, viewModel.state.value.accountCredentialPresent)
        assertEquals(AccountSessionStatus.UNAVAILABLE, viewModel.state.value.sessionStatus)
        assertEquals(1, gateway.meCalls)
    }

    @Test
    fun resultValidationMarksAnExpiredAccountSignedOut() = runTest {
        val gateway = FakeAccountGateway()
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
                autoBootstrap = false,
            )
        viewModel.restorePresence()
        advanceUntilIdle()
        gateway.meResult =
            ApiResult.Failure(
                ApiFailure.Http(401, "USER_SESSION_INVALID", "Sign in.", null, null, null)
            )

        viewModel.validatePresence()
        advanceUntilIdle()

        assertEquals(AccountSessionStatus.SIGNED_OUT, viewModel.state.value.sessionStatus)
        assertEquals(false, viewModel.state.value.accountCredentialPresent)
    }

    @Test
    fun startRoomWithNewlyExpiredAccountOpensGoogleOrGuestChoice() = runTest {
        val gateway =
            FakeAccountGateway(
                meResult =
                    ApiResult.Failure(
                        ApiFailure.Http(
                            401,
                            "USER_SESSION_INVALID",
                            "Sign in.",
                            null,
                            null,
                            null,
                        )
                    )
            )
        val viewModel =
            AccountViewModel(
                gateway,
                googleCredential = { GoogleCredentialResult.Cancelled },
                clearGoogleState = {},
                enabled = true,
                autoBootstrap = false,
            )

        viewModel.requestPlay(PendingGuestEntry.CREATE)
        advanceUntilIdle()

        assertEquals(AccountDestination.AUTH_CHOICE, viewModel.state.value.destination)
        assertEquals(PendingGuestEntry.CREATE, viewModel.state.value.pendingGuestEntry)
        assertEquals(AccountSessionStatus.SIGNED_OUT, viewModel.state.value.sessionStatus)
    }
}

private class FakeAccountGateway(
    private val restore: StoredAccountSession =
        StoredAccountSession.Available(
            AccountCredential("account-token", "session-id", Instant.now().plusSeconds(3600))
        ),
    private val dashboardResult: ApiResult<DashboardData> = ApiResult.Success(dashboard, "request"),
    var meResult: ApiResult<UserProfile> = ApiResult.Success(profile, "request"),
) : AccountGateway {
    var completeCalls = 0
    var meCalls = 0
    var dashboardCalls = 0

    override suspend fun restore() = restore

    override suspend fun me() = meResult.also { meCalls += 1 }

    override suspend fun dashboard() = dashboardResult.also { dashboardCalls += 1 }

    override suspend fun history(cursor: String?) =
        ApiResult.Success(HistoryPage(emptyList(), null), "request")

    override suspend fun game(id: String): ApiResult<UserGameDetail> = error("not used")

    override suspend fun sessions() = ApiResult.Success<List<UserSession>>(emptyList(), "request")

    override suspend fun updateProfile(displayName: String, avatarId: String) =
        ApiResult.Success(profile.copy(displayName = displayName, avatarId = avatarId), "request")

    override suspend fun beginGoogle(intent: String) =
        ApiResult.Success(
            MobileGoogleChallenge("transaction", "nonce", "2099-01-01T00:00:00Z"),
            "request",
        )

    override suspend fun completeGoogle(challenge: MobileGoogleChallenge, idToken: String) =
        ApiResult.Success(profile, "request").also { completeCalls += 1 }

    override suspend fun rejoin(participantId: String): ApiResult<AccountRejoinIssue> =
        error("not used")

    override suspend fun revokeSession(id: String) = ApiResult.Success(Unit, "request")

    override suspend fun revokeOthers() = ApiResult.Success(Unit, "request")

    override suspend fun signOut() = ApiResult.Success(Unit, "request")

    override suspend fun deleteAccount() = ApiResult.Success(Unit, "request")

    override suspend fun clearAccount() = Unit

    companion object {
        val profile =
            UserProfile(
                id = "user-id",
                email = "player@example.com",
                displayName = "Player",
                avatarId = "fox",
                createdAt = "2026-01-01T00:00:00Z",
            )
        val dashboard =
            DashboardData(
                rooms = emptyList(),
                recentGames = emptyList(),
                stats = DashboardStats(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
            )
    }
}
