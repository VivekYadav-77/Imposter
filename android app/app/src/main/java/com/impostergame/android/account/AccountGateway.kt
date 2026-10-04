package com.impostergame.android.account

import com.impostergame.data.account.AccountApi
import com.impostergame.data.account.AccountCredential
import com.impostergame.data.account.AccountRejoinIssue
import com.impostergame.data.account.AccountSessionStore
import com.impostergame.data.account.DashboardData
import com.impostergame.data.account.HistoryPage
import com.impostergame.data.account.MobileGoogleChallenge
import com.impostergame.data.account.StoredAccountSession
import com.impostergame.data.account.UserGameDetail
import com.impostergame.data.account.UserProfile
import com.impostergame.data.account.UserSession
import com.impostergame.data.network.ApiFailure
import com.impostergame.data.network.ApiResult
import com.impostergame.data.session.ParticipantCredential
import com.impostergame.data.session.SessionStore
import java.time.Instant

interface AccountGateway {
    suspend fun restore(): StoredAccountSession

    suspend fun me(): ApiResult<UserProfile>

    suspend fun dashboard(): ApiResult<DashboardData>

    suspend fun history(cursor: String? = null): ApiResult<HistoryPage>

    suspend fun game(id: String): ApiResult<UserGameDetail>

    suspend fun sessions(): ApiResult<List<UserSession>>

    suspend fun updateProfile(displayName: String, avatarId: String): ApiResult<UserProfile>

    suspend fun beginGoogle(intent: String): ApiResult<MobileGoogleChallenge>

    suspend fun completeGoogle(
        challenge: MobileGoogleChallenge,
        idToken: String,
    ): ApiResult<UserProfile>

    suspend fun rejoin(participantId: String): ApiResult<AccountRejoinIssue>

    suspend fun revokeSession(id: String): ApiResult<Unit>

    suspend fun revokeOthers(): ApiResult<Unit>

    suspend fun signOut(): ApiResult<Unit>

    suspend fun deleteAccount(): ApiResult<Unit>

    suspend fun clearAccount()
}

class NetworkAccountGateway(
    private val api: AccountApi,
    private val accounts: AccountSessionStore,
    private val participants: SessionStore,
) : AccountGateway {
    override suspend fun restore(): StoredAccountSession = accounts.restore()

    override suspend fun me() = api.me().clearInvalidAccount()

    override suspend fun dashboard() = api.dashboard().clearInvalidAccount()

    override suspend fun history(cursor: String?) = api.history(cursor).clearInvalidAccount()

    override suspend fun game(id: String) = api.game(id).clearInvalidAccount()

    override suspend fun sessions() = api.sessions().clearInvalidAccount()

    override suspend fun updateProfile(displayName: String, avatarId: String) =
        api.updateProfile(displayName, avatarId).clearInvalidAccount()

    override suspend fun beginGoogle(intent: String) = api.beginGoogle(intent).clearInvalidAccount()

    override suspend fun completeGoogle(
        challenge: MobileGoogleChallenge,
        idToken: String,
    ): ApiResult<UserProfile> =
        when (val result = api.completeGoogle(challenge.transactionToken, idToken)) {
            is ApiResult.Failure -> result
            is ApiResult.Success -> {
                result.value.session?.let {
                    accounts.save(
                        AccountCredential(
                            token = it.token,
                            sessionId = it.sessionId,
                            expiresAt = Instant.parse(it.expiresAt),
                        )
                    )
                }
                ApiResult.Success(result.value.user, result.requestId)
            }
        }

    override suspend fun rejoin(participantId: String): ApiResult<AccountRejoinIssue> =
        when (val result = api.rejoin(participantId).clearInvalidAccount()) {
            is ApiResult.Failure -> result
            is ApiResult.Success -> {
                participants.save(
                    ParticipantCredential(
                        result.value.sessionToken,
                        Instant.parse(result.value.sessionExpiresAt),
                    )
                )
                result
            }
        }

    override suspend fun revokeSession(id: String) = api.revokeSession(id).clearInvalidAccount()

    override suspend fun revokeOthers() = api.revokeOthers().clearInvalidAccount()

    override suspend fun signOut(): ApiResult<Unit> {
        val result = api.signOut()
        // Local sign-out is authoritative for this device even when remote revocation is offline.
        accounts.clear()
        return result
    }

    override suspend fun deleteAccount(): ApiResult<Unit> {
        val result = api.deleteAccount()
        if (result is ApiResult.Success || result.isInvalidSession()) accounts.clear()
        return result
    }

    override suspend fun clearAccount() = accounts.clear()

    private suspend fun <T> ApiResult<T>.clearInvalidAccount(): ApiResult<T> {
        if (isInvalidSession()) accounts.clear()
        return this
    }

    private fun ApiResult<*>.isInvalidSession(): Boolean {
        val failure = (this as? ApiResult.Failure)?.error as? ApiFailure.Http
        return failure?.status == 401
    }
}

class UnavailableAccountGateway(private val reason: String) : AccountGateway {
    private fun <T> unavailable(): ApiResult<T> =
        ApiResult.Failure(ApiFailure.Contract(IllegalStateException(reason)))

    override suspend fun restore() = StoredAccountSession.None

    override suspend fun me() = unavailable<UserProfile>()

    override suspend fun dashboard() = unavailable<DashboardData>()

    override suspend fun history(cursor: String?) = unavailable<HistoryPage>()

    override suspend fun game(id: String) = unavailable<UserGameDetail>()

    override suspend fun sessions() = unavailable<List<UserSession>>()

    override suspend fun updateProfile(displayName: String, avatarId: String) =
        unavailable<UserProfile>()

    override suspend fun beginGoogle(intent: String) = unavailable<MobileGoogleChallenge>()

    override suspend fun completeGoogle(challenge: MobileGoogleChallenge, idToken: String) =
        unavailable<UserProfile>()

    override suspend fun rejoin(participantId: String) = unavailable<AccountRejoinIssue>()

    override suspend fun revokeSession(id: String) = unavailable<Unit>()

    override suspend fun revokeOthers() = unavailable<Unit>()

    override suspend fun signOut() = unavailable<Unit>()

    override suspend fun deleteAccount() = unavailable<Unit>()

    override suspend fun clearAccount() = Unit
}
