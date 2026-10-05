package com.impostergame.data.account

import com.impostergame.data.model.ApiEnvelope
import com.impostergame.data.network.ApiClient
import com.impostergame.data.network.ApiResult
import com.impostergame.data.network.CommandFactory
import com.impostergame.data.network.CommandMethod
import com.impostergame.data.network.CommandRequest
import com.impostergame.data.network.ContractJson
import com.impostergame.data.network.UuidIdGenerator
import com.impostergame.data.network.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class AccountApi(
    private val client: ApiClient,
    private val accountCredential: () -> String?,
    private val participantCredential: () -> String?,
    private val commands: CommandFactory = CommandFactory(),
    private val json: Json = ContractJson.instance,
) {
    suspend fun beginGoogle(intent: String): ApiResult<MobileGoogleChallenge> =
        client
            .command(
                commands.create(
                    routeTemplate = "/api/v1/auth/google/mobile/challenges",
                    encodedPath = "/api/v1/auth/google/mobile/challenges",
                    body = json.encodeToString(MobileChallengeInput(intent)).encodeToByteArray(),
                ),
                ApiEnvelope.serializer(MobileGoogleChallenge.serializer()),
                bearerToken =
                    when (intent) {
                        "post_game" -> participantCredential()
                        "delete" -> accountCredential()
                        else -> null
                    },
            )
            .map { it.data }

    suspend fun completeGoogle(
        transactionToken: String,
        idToken: String,
    ): ApiResult<MobileGoogleCompletion> =
        client
            .command(
                commands.create(
                    routeTemplate = "/api/v1/auth/google/mobile/complete",
                    encodedPath = "/api/v1/auth/google/mobile/complete",
                    body =
                        json
                            .encodeToString(MobileCompleteInput(transactionToken, idToken))
                            .encodeToByteArray(),
                ),
                ApiEnvelope.serializer(MobileGoogleCompletion.serializer()),
                bearerToken = null,
            )
            .map { it.data }

    suspend fun me(): ApiResult<UserProfile> =
        client
            .get(
                routeTemplate = "/api/v1/me",
                encodedPath = "/api/v1/me",
                deserializer = ApiEnvelope.serializer(UserProfile.serializer()),
                bearerToken = accountCredential(),
            )
            .map { it.data }

    suspend fun dashboard(): ApiResult<DashboardData> =
        client
            .get(
                routeTemplate = "/api/v1/me/dashboard",
                encodedPath = "/api/v1/me/dashboard",
                deserializer = ApiEnvelope.serializer(DashboardData.serializer()),
                bearerToken = accountCredential(),
            )
            .map { it.data }

    suspend fun history(cursor: String? = null): ApiResult<HistoryPage> =
        client
            .get(
                routeTemplate = "/api/v1/me/games",
                encodedPath = "/api/v1/me/games",
                query =
                    buildMap {
                        put("limit", "20")
                        cursor?.let { put("cursor", it) }
                    },
                deserializer = ApiEnvelope.serializer(HistoryPage.serializer()),
                bearerToken = accountCredential(),
            )
            .map { it.data }

    suspend fun game(id: String): ApiResult<UserGameDetail> =
        client
            .get(
                routeTemplate = "/api/v1/me/games/{id}",
                encodedPath = "/api/v1/me/games/$id",
                deserializer = ApiEnvelope.serializer(UserGameDetail.serializer()),
                bearerToken = accountCredential(),
            )
            .map { it.data }

    suspend fun sessions(): ApiResult<List<UserSession>> =
        client
            .get(
                routeTemplate = "/api/v1/me/sessions",
                encodedPath = "/api/v1/me/sessions",
                deserializer = ApiEnvelope.serializer(ListSerializer(UserSession.serializer())),
                bearerToken = accountCredential(),
            )
            .map { it.data }

    suspend fun updateProfile(displayName: String, avatarId: String): ApiResult<UserProfile> =
        client
            .command(
                commands.create(
                    routeTemplate = "/api/v1/me",
                    encodedPath = "/api/v1/me",
                    body =
                        json
                            .encodeToString(ProfileInput(displayName, avatarId))
                            .encodeToByteArray(),
                    method = CommandMethod.PATCH,
                ),
                ApiEnvelope.serializer(UserProfile.serializer()),
                bearerToken = accountCredential(),
            )
            .map { it.data }

    suspend fun rejoin(participantId: String): ApiResult<AccountRejoinIssue> =
        client
            .command(
                CommandRequest(
                    routeTemplate = "/api/v1/me/participations/{id}/rejoin",
                    encodedPath = "/api/v1/me/participations/$participantId/rejoin",
                    body = EMPTY_JSON,
                    idempotencyKey = UuidIdGenerator.create(),
                ),
                ApiEnvelope.serializer(AccountRejoinIssue.serializer()),
                bearerToken = accountCredential(),
            )
            .map { it.data }

    suspend fun revokeSession(id: String): ApiResult<Unit> =
        client.delete(
            routeTemplate = "/api/v1/me/sessions/{id}",
            encodedPath = "/api/v1/me/sessions/$id",
            bearerToken = accountCredential(),
        )

    suspend fun revokeOthers(): ApiResult<Unit> =
        client.delete(
            routeTemplate = "/api/v1/me/sessions/others",
            encodedPath = "/api/v1/me/sessions/others",
            bearerToken = accountCredential(),
        )

    suspend fun signOut(): ApiResult<Unit> =
        client.delete(
            routeTemplate = "/api/v1/account-sessions/current",
            encodedPath = "/api/v1/account-sessions/current",
            bearerToken = accountCredential(),
        )

    suspend fun deleteAccount(): ApiResult<Unit> =
        client.commandNoContent(
            commands.create(
                routeTemplate = "/api/v1/me",
                encodedPath = "/api/v1/me",
                body = EMPTY_JSON,
                method = CommandMethod.DELETE,
            ),
            bearerToken = accountCredential(),
        )
}

@Serializable private data class MobileChallengeInput(val intent: String)

@Serializable
private data class MobileCompleteInput(val transactionToken: String, val idToken: String)

@Serializable private data class ProfileInput(val displayName: String, val avatarId: String)

private val EMPTY_JSON = "{}".encodeToByteArray()
