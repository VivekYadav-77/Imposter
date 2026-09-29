package com.impostergame.data.network

import com.impostergame.data.model.ApiEnvelope
import com.impostergame.data.model.CallMeetingInput
import com.impostergame.data.model.ConfirmSubmissionInput
import com.impostergame.data.model.EjectionVoteInput
import com.impostergame.data.model.FlagAcknowledgement
import com.impostergame.data.model.FlagSubmissionInput
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.KillInput
import com.impostergame.data.model.PublicTaskPack
import com.impostergame.data.model.ReviewVoteInput
import com.impostergame.data.model.RoomCreationInput
import com.impostergame.data.model.RoomJoinOptions
import com.impostergame.data.model.RoomMembershipInput
import com.impostergame.data.model.RoomSettingsInput
import com.impostergame.data.model.RoomSnapshot
import com.impostergame.data.model.SessionCredential
import com.impostergame.data.model.SessionIssue
import com.impostergame.data.model.Submission
import com.impostergame.data.model.SubmissionConfirmation
import com.impostergame.data.model.UploadIntent
import com.impostergame.data.model.UploadIntentInput
import com.impostergame.data.model.VoteAcknowledgement
import com.impostergame.data.repository.GameSnapshotSource
import com.impostergame.data.repository.RoomSnapshotSource
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class ParticipantApi(
    private val client: ApiClient,
    private val commands: CommandFactory = CommandFactory(),
    private val json: Json = ContractJson.instance,
) : RoomSnapshotSource, GameSnapshotSource {
    override suspend fun fetch(): ApiResult<RoomSnapshot> =
        client
            .get(
                routeTemplate = "/api/v1/rooms/current",
                encodedPath = "/api/v1/rooms/current",
                deserializer = ApiEnvelope.serializer(RoomSnapshot.serializer()),
            )
            .map { it.data }

    override suspend fun fetch(knownStateVersion: Long?): ApiResult<GameSnapshot?> =
        client
            .getOptional(
                routeTemplate = "/api/v1/games/current/snapshot",
                encodedPath = "/api/v1/games/current/snapshot",
                query =
                    knownStateVersion?.let { mapOf("knownStateVersion" to it.toString()) }
                        ?: emptyMap(),
                deserializer = ApiEnvelope.serializer(GameSnapshot.serializer()),
            )
            .map { it?.data }

    suspend fun createRoom(
        input: RoomCreationInput,
        idempotencyKey: String = UuidIdGenerator.create(),
    ): ApiResult<SessionIssue> =
        executeSessionCommand(
            CommandRequest(
                routeTemplate = "/api/v1/rooms",
                encodedPath = "/api/v1/rooms",
                body = json.encodeToString(input).encodeToByteArray(),
                idempotencyKey = idempotencyKey,
            )
        )

    suspend fun joinRoom(
        code: String,
        input: RoomMembershipInput,
        idempotencyKey: String = UuidIdGenerator.create(),
    ): ApiResult<SessionIssue> {
        require(ROOM_CODE.matches(code)) { "Room code must contain six ASCII letters or digits" }
        return executeSessionCommand(
            CommandRequest(
                routeTemplate = "/api/v1/rooms/{code}/participants",
                encodedPath = "/api/v1/rooms/${code.uppercase()}/participants",
                body = json.encodeToString(input).encodeToByteArray(),
                idempotencyKey = idempotencyKey,
            )
        )
    }

    suspend fun joinOptions(code: String): ApiResult<RoomJoinOptions> {
        require(ROOM_CODE.matches(code)) { "Room code must contain six ASCII letters or digits" }
        return client
            .get(
                routeTemplate = "/api/v1/rooms/{code}/join-options",
                encodedPath = "/api/v1/rooms/${code.uppercase()}/join-options",
                deserializer = ApiEnvelope.serializer(RoomJoinOptions.serializer()),
            )
            .map { it.data }
    }

    suspend fun updateSettings(input: RoomSettingsInput): ApiResult<RoomSnapshot> =
        client
            .command(
                commands.create(
                    routeTemplate = "/api/v1/rooms/current/settings",
                    encodedPath = "/api/v1/rooms/current/settings",
                    body = json.encodeToString(input).encodeToByteArray(),
                    method = CommandMethod.PATCH,
                ),
                ApiEnvelope.serializer(RoomSnapshot.serializer()),
            )
            .map { it.data }

    suspend fun startGame(): ApiResult<GameSnapshot> =
        client
            .command(
                commands.create(
                    routeTemplate = "/api/v1/rooms/current/start",
                    encodedPath = "/api/v1/rooms/current/start",
                    body = EMPTY_JSON,
                ),
                ApiEnvelope.serializer(GameSnapshot.serializer()),
            )
            .map { it.data }

    suspend fun taskPacks(): ApiResult<List<PublicTaskPack>> =
        client
            .get(
                routeTemplate = "/api/v1/task-packs",
                encodedPath = "/api/v1/task-packs",
                query = mapOf("limit" to "50"),
                deserializer = ApiEnvelope.serializer(ListSerializer(PublicTaskPack.serializer())),
            )
            .map { it.data }

    suspend fun createUploadIntent(
        assignmentId: String,
        input: UploadIntentInput,
        idempotencyKey: String,
    ): ApiResult<UploadIntent> =
        client
            .command(
                CommandRequest(
                    routeTemplate = "/api/v1/task-assignments/{assignmentId}/upload-intents",
                    encodedPath = "/api/v1/task-assignments/$assignmentId/upload-intents",
                    body = json.encodeToString(input).encodeToByteArray(),
                    idempotencyKey = idempotencyKey,
                ),
                ApiEnvelope.serializer(UploadIntent.serializer()),
            )
            .map { it.data }

    suspend fun confirmSubmission(
        assignmentId: String,
        input: ConfirmSubmissionInput,
        idempotencyKey: String,
    ): ApiResult<SubmissionConfirmation> =
        client
            .command(
                CommandRequest(
                    routeTemplate = "/api/v1/task-assignments/{assignmentId}/submissions",
                    encodedPath = "/api/v1/task-assignments/$assignmentId/submissions",
                    body = json.encodeToString(input).encodeToByteArray(),
                    idempotencyKey = idempotencyKey,
                ),
                ApiEnvelope.serializer(SubmissionConfirmation.serializer()),
            )
            .map { it.data }

    suspend fun submissions(): ApiResult<List<Submission>> =
        client
            .get(
                routeTemplate = "/api/v1/games/current/submissions",
                encodedPath = "/api/v1/games/current/submissions",
                query = mapOf("limit" to "50"),
                deserializer = ApiEnvelope.serializer(ListSerializer(Submission.serializer())),
            )
            .map { it.data }

    suspend fun flagSubmission(
        submissionId: String,
        input: FlagSubmissionInput,
        idempotencyKey: String,
    ): ApiResult<FlagAcknowledgement> =
        client
            .command(
                CommandRequest(
                    routeTemplate = "/api/v1/submissions/{submissionId}/flags",
                    encodedPath = "/api/v1/submissions/$submissionId/flags",
                    body = json.encodeToString(input).encodeToByteArray(),
                    idempotencyKey = idempotencyKey,
                ),
                ApiEnvelope.serializer(FlagAcknowledgement.serializer()),
            )
            .map { it.data }

    suspend fun kill(input: KillInput, idempotencyKey: String): ApiResult<GameSnapshot> =
        client
            .command(
                CommandRequest(
                    routeTemplate = "/api/v1/games/current/kills",
                    encodedPath = "/api/v1/games/current/kills",
                    body = json.encodeToString(input).encodeToByteArray(),
                    idempotencyKey = idempotencyKey,
                ),
                ApiEnvelope.serializer(GameSnapshot.serializer()),
            )
            .map { it.data }

    suspend fun callMeeting(
        input: CallMeetingInput,
        idempotencyKey: String,
    ): ApiResult<GameSnapshot> =
        client
            .command(
                CommandRequest(
                    routeTemplate = "/api/v1/games/current/meetings",
                    encodedPath = "/api/v1/games/current/meetings",
                    body = json.encodeToString(input).encodeToByteArray(),
                    idempotencyKey = idempotencyKey,
                ),
                ApiEnvelope.serializer(GameSnapshot.serializer()),
            )
            .map { it.data }

    suspend fun reviewVote(
        reviewItemId: String,
        input: ReviewVoteInput,
        idempotencyKey: String,
    ): ApiResult<VoteAcknowledgement> =
        client
            .command(
                CommandRequest(
                    routeTemplate = "/api/v1/evidence-review-items/{reviewItemId}/vote",
                    encodedPath = "/api/v1/evidence-review-items/$reviewItemId/vote",
                    body = json.encodeToString(input).encodeToByteArray(),
                    idempotencyKey = idempotencyKey,
                    method = CommandMethod.PUT,
                ),
                ApiEnvelope.serializer(VoteAcknowledgement.serializer()),
            )
            .map { it.data }

    suspend fun ejectionVote(
        meetingId: String,
        input: EjectionVoteInput,
        idempotencyKey: String,
    ): ApiResult<VoteAcknowledgement> =
        client
            .command(
                CommandRequest(
                    routeTemplate = "/api/v1/meetings/{meetingId}/ejection-vote",
                    encodedPath = "/api/v1/meetings/$meetingId/ejection-vote",
                    body = json.encodeToString(input).encodeToByteArray(),
                    idempotencyKey = idempotencyKey,
                    method = CommandMethod.PUT,
                ),
                ApiEnvelope.serializer(VoteAcknowledgement.serializer()),
            )
            .map { it.data }

    suspend fun endSession(): ApiResult<Unit> =
        client.delete(
            routeTemplate = "/api/v1/participant-sessions/current",
            encodedPath = "/api/v1/participant-sessions/current",
        )

    suspend fun rotateSession(): ApiResult<SessionCredential> =
        client
            .command(
                commands.create(
                    routeTemplate = "/api/v1/participant-sessions/current/rotate",
                    encodedPath = "/api/v1/participant-sessions/current/rotate",
                    body = EMPTY_JSON,
                ),
                ApiEnvelope.serializer(SessionCredential.serializer()),
            )
            .map { it.data }

    suspend fun leaveRoom(): ApiResult<Unit> =
        client
            .command(
                commands.create(
                    routeTemplate = "/api/v1/rooms/current/leave",
                    encodedPath = "/api/v1/rooms/current/leave",
                    body = EMPTY_JSON,
                ),
                ApiEnvelope.serializer(LeaveResult.serializer()),
            )
            .discardValue()

    private suspend fun executeSessionCommand(command: CommandRequest): ApiResult<SessionIssue> =
        client.command(command, ApiEnvelope.serializer(SessionIssue.serializer())).map { it.data }

    private companion object {
        val ROOM_CODE = Regex("^[A-Za-z0-9]{6}$")
        val EMPTY_JSON = "{}".encodeToByteArray()
    }
}

@kotlinx.serialization.Serializable private data class LeaveResult(val left: Boolean)

inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> =
    when (this) {
        is ApiResult.Success -> ApiResult.Success(transform(value), requestId)
        is ApiResult.Failure -> this
    }

private fun <T> ApiResult<T>.discardValue(): ApiResult<Unit> =
    when (this) {
        is ApiResult.Success -> ApiResult.Success(Unit, requestId)
        is ApiResult.Failure -> this
    }
