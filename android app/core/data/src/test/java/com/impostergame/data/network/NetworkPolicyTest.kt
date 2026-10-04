package com.impostergame.data.network

import com.impostergame.data.account.AccountCredential
import com.impostergame.data.account.AccountSessionIssue
import com.impostergame.data.account.MobileGoogleChallenge
import com.impostergame.data.gameSnapshot
import com.impostergame.data.model.ApiEnvelope
import com.impostergame.data.model.ApiMeta
import com.impostergame.data.model.CallMeetingInput
import com.impostergame.data.model.Cooldowns
import com.impostergame.data.model.EjectionVoteInput
import com.impostergame.data.model.EvidencePolicy
import com.impostergame.data.model.GamePhase
import com.impostergame.data.model.GameProgress
import com.impostergame.data.model.GameSelf
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.GameTaskPack
import com.impostergame.data.model.Meeting
import com.impostergame.data.model.MeetingRules
import com.impostergame.data.model.ParticipantSelf
import com.impostergame.data.model.UploadIntent
import com.impostergame.data.roomSnapshot
import java.time.Instant
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NetworkPolicyTest {
    @Test
    fun meetingContractDecodesReviewAndResolvedResult() {
        val meeting =
            ContractJson.instance.decodeFromString(
                Meeting.serializer(),
                """{"id":"meeting","sequenceNumber":2,"triggerType":"task_deadline","reportedParticipantId":null,"phase":"resolved","deadlineAt":null,"eligibleParticipants":[{"id":"p1","nickname":"Ari","avatarId":"fox"}],"reviewItem":{"id":"review","submissionId":"submission","position":1,"total":1,"uploader":{"id":"p1","nickname":"Ari"},"assignmentDescription":"Check panel","ownDecision":"valid","votesCast":1,"requiredVotes":1},"ownEjectionTargetParticipantId":null,"hasCastEjectionVote":true,"votesCast":1,"requiredVotes":1,"publicVotes":[],"result":{"ejectedParticipantId":null,"totals":[],"skipVotes":1},"capabilities":[]}""",
            )

        assertEquals("valid", meeting.reviewItem?.ownDecision)
        assertEquals(1, meeting.result?.skipVotes)
        assertTrue(meeting.result?.ballots?.isEmpty() == true)
    }

    @Test
    fun authorizationIsPresentAndNeverIncludedInStructuredLogs() = runTest {
        val server = MockWebServer()
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .body(
                    """{"data":{"participantId":"p","nickname":"n","avatarId":"fox","isHost":true,"capabilities":[]},"meta":{"requestId":"r","serverTime":"2026-09-27T00:00:00Z"}}"""
                )
                .build()
        )
        server.start()
        try {
            val logs = mutableListOf<SafeLogEvent>()
            val client =
                ApiClient(
                    server.url("/").toString().toHttpUrl(),
                    credentialProvider = { "super-secret" },
                    logger = SafeLogger(logs::add),
                    allowInsecureLocalDebug = true,
                )
            client.get(
                "/api/v1/test",
                "/api/v1/test",
                deserializer = ApiEnvelope.serializer(ParticipantSelf.serializer()),
            )

            assertEquals("Bearer super-secret", server.takeRequest().headers["Authorization"])
            assertTrue(logs.isNotEmpty())
            assertFalse(logs.joinToString().contains("super-secret"))
            assertFalse(
                SecretRedactor.redact("Authorization: Bearer super-secret").contains("super-secret")
            )
            assertFalse(
                SecretRedactor.redact(
                        """{"idToken":"identity-secret","transactionToken":"transaction-secret","nonce":"nonce-secret"}"""
                    )
                    .contains("secret")
            )
            assertEquals(
                "██REDACTED_URL██",
                SecretRedactor.redact(
                    "https://storage.example/object?X-Amz-Signature=super-secret"
                ),
            )
            assertFalse(SecretRedactor.redact("C:\\private\\capture.jpg").contains("capture.jpg"))
        } finally {
            server.close()
        }
    }

    @Test
    fun serverErrorTextIsBoundedAndControlCharactersAreRemoved() = runTest {
        val server = MockWebServer()
        val hostileJson = "Try again\\u0007\\u202E" + "x".repeat(400)
        server.enqueue(
            MockResponse.Builder()
                .code(400)
                .body(
                    """{"error":{"code":"BAD","message":"$hostileJson","requestId":"r","details":{"token":"must-not-reach-ui"}}}"""
                )
                .build()
        )
        server.start()
        try {
            val client =
                ApiClient(
                    server.url("/").toString().toHttpUrl(),
                    credentialProvider = { null },
                    allowInsecureLocalDebug = true,
                )
            val result =
                client.get(
                    "/test",
                    "/test",
                    deserializer = ApiEnvelope.serializer(ParticipantSelf.serializer()),
                ) as ApiResult.Failure
            val failure = result.error as ApiFailure.Http

            assertTrue(failure.safeMessage.length <= 240)
            assertFalse(failure.safeMessage.contains('\u0007'))
            assertFalse(failure.safeMessage.contains('\u202E'))
            assertEquals(null, failure.safeDetails)
        } finally {
            server.close()
        }
    }

    @Test
    fun privateDtoStringRepresentationsRedactRolesBallotsAndIdentifiers() {
        val snapshot =
            GameSnapshot(
                id = "secret-game-id",
                roomId = "secret-room-id",
                phase = GamePhase.TASK,
                stateVersion = 1,
                winner = null,
                endReason = null,
                taskPack = GameTaskPack("Pack"),
                phaseStartedAt = "now",
                phaseDeadlineAt = null,
                participants = emptyList(),
                self =
                    GameSelf(
                        "p",
                        "fox",
                        "imposter",
                        "alive",
                        emptyList(),
                        emptyList(),
                        emptyList(),
                        null,
                    ),
                assignments = emptyList(),
                progress = GameProgress(0),
                evidenceVisibility = "private",
                cooldowns = Cooldowns(null, null, 60, 60),
                meetingRules = MeetingRules(60, "timed", "private", false, 1, 0, 1, false),
                meeting = null,
                resultSummary = null,
            )

        assertFalse(snapshot.toString().contains("imposter"))
        assertFalse(snapshot.toString().contains("secret-game-id"))
        assertFalse(EjectionVoteInput(1, "target-id").toString().contains("target-id"))
        assertFalse(
            AccountCredential("account-secret", "account-session", Instant.MAX)
                .toString()
                .contains("account-secret")
        )
        assertFalse(
            AccountSessionIssue("account-secret", "2099-01-01T00:00:00Z", "session-secret")
                .toString()
                .contains("secret")
        )
        assertFalse(
            MobileGoogleChallenge("transaction-secret", "nonce-secret", "2099-01-01T00:00:00Z")
                .toString()
                .contains("secret")
        )
    }

    @Test
    fun retryReusesCommandIdentityAndChangedCommandGetsNewIdentity() = runTest {
        var nextId = 0
        val factory = CommandFactory { "command-${++nextId}" }
        val first = factory.create("/route", "/route", "{\"value\":1}".encodeToByteArray())
        val attempts = mutableListOf<CommandRequest>()
        var call = 0
        val policy = TransientRetryPolicy(maxAttempts = 2, jitter = { 0 }, sleeper = {})

        policy.execute<Unit> {
            attempts += first
            if (call++ == 0) ApiResult.Failure(ApiFailure.Transport(java.io.IOException()))
            else ApiResult.Success(Unit, null)
        }
        val changed = factory.create("/route", "/route", "{\"value\":2}".encodeToByteArray())

        assertEquals(first.idempotencyKey, attempts[1].idempotencyKey)
        assertArrayEquals(first.body, attempts[1].body)
        assertFalse(first.idempotencyKey == changed.idempotencyKey)
    }

    @Test
    fun conflictIsNeverRetried() = runTest {
        var calls = 0
        val policy = TransientRetryPolicy(maxAttempts = 4, jitter = { 0 }, sleeper = {})
        policy.execute<Unit> {
            calls++
            ApiResult.Failure(ApiFailure.Http(409, "conflict", "Conflict", "r", null, null))
        }
        assertEquals(1, calls)
    }

    @Test
    fun everyDocumentedFailureCategoryHasDeterministicPolicy() {
        fun http(status: Int) = ApiFailure.Http(status, "code", "safe", "r", null, null)
        assertEquals(ErrorPolicy.CLEAR_SESSION, http(401).policy())
        assertEquals(ErrorPolicy.REFRESH_AND_CONFIRM, http(409).policy())
        assertEquals(ErrorPolicy.FIX_INPUT, http(422).policy())
        assertEquals(ErrorPolicy.RETRY_WITH_SERVER_DELAY, http(429).policy())
        assertEquals(ErrorPolicy.RETRY_WITH_BACKOFF, http(503).policy())
        assertEquals(ErrorPolicy.FAIL, http(400).policy())
        assertEquals(
            ErrorPolicy.RETRY_WITH_BACKOFF,
            ApiFailure.Transport(java.io.IOException()).policy(),
        )
        assertEquals(ErrorPolicy.FAIL, ApiFailure.Contract(IllegalStateException()).policy())
        assertEquals(ErrorPolicy.FAIL, ApiFailure.Cancelled.policy())
    }

    @Test
    fun noContentRepresentsAnUnchangedSnapshot() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse.Builder().code(204).build())
        server.start()
        try {
            val client =
                ApiClient(
                    server.url("/").toString().toHttpUrl(),
                    credentialProvider = { "secret" },
                    allowInsecureLocalDebug = true,
                )
            val result =
                client.getOptional(
                    "/api/v1/games/current/snapshot",
                    "/api/v1/games/current/snapshot",
                    query = mapOf("knownStateVersion" to "7"),
                    deserializer = ApiEnvelope.serializer(ParticipantSelf.serializer()),
                ) as ApiResult.Success

            assertEquals(null, result.value)
            assertEquals("7", server.takeRequest().url.queryParameter("knownStateVersion"))
        } finally {
            server.close()
        }
    }

    @Test
    fun patchCommandUsesPatchAndKeepsItsIdempotencyKey() = runTest {
        val server = MockWebServer()
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .body(
                    """{"data":{"participantId":"p","nickname":"n","avatarId":"fox","isHost":true,"capabilities":[]},"meta":{"requestId":"r","serverTime":"2026-09-27T00:00:00Z"}}"""
                )
                .build()
        )
        server.start()
        try {
            val client =
                ApiClient(
                    server.url("/").toString().toHttpUrl(),
                    credentialProvider = { "secret" },
                    allowInsecureLocalDebug = true,
                )
            client.command(
                CommandRequest(
                    routeTemplate = "/api/v1/rooms/current/settings",
                    encodedPath = "/api/v1/rooms/current/settings",
                    body = "{\"taskPhaseSeconds\":600}".encodeToByteArray(),
                    idempotencyKey = "same-command-key",
                    method = CommandMethod.PATCH,
                ),
                ApiEnvelope.serializer(ParticipantSelf.serializer()),
            )

            val request = server.takeRequest()
            assertEquals("PATCH", request.method)
            assertEquals("same-command-key", request.headers["Idempotency-Key"])
            assertEquals("{\"taskPhaseSeconds\":600}", request.body?.utf8())
        } finally {
            server.close()
        }
    }

    @Test
    fun voteCommandUsesPutAndKeepsItsIdempotencyKey() = runTest {
        val server = MockWebServer()
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .body(
                    """{"data":{"stateVersion":9,"votesCast":2},"meta":{"requestId":"r","serverTime":"2026-09-28T00:00:00Z"}}"""
                )
                .build()
        )
        server.start()
        try {
            val api =
                ParticipantApi(
                    ApiClient(
                        server.url("/").toString().toHttpUrl(),
                        { "secret" },
                        allowInsecureLocalDebug = true,
                    )
                )
            api.ejectionVote(
                "meeting-1",
                com.impostergame.data.model.EjectionVoteInput(8, null),
                "vote-key",
            )

            val request = server.takeRequest()
            assertEquals("PUT", request.method)
            assertEquals("vote-key", request.headers["Idempotency-Key"])
            assertEquals("/api/v1/meetings/meeting-1/ejection-vote", request.url.encodedPath)
            assertTrue(request.body?.utf8()?.contains("\"targetParticipantId\":null") == true)
        } finally {
            server.close()
        }
    }

    @Test
    fun meetingCallUsesVersionedIdempotentPost() = runTest {
        val server = MockWebServer()
        server.enqueue(
            MockResponse.Builder()
                .code(201)
                .body(
                    ContractJson.instance.encodeToString(
                        ApiEnvelope(
                            gameSnapshot(version = 10),
                            ApiMeta("request", "2026-09-29T00:00:00Z"),
                        )
                    )
                )
                .build()
        )
        server.start()
        try {
            val api =
                ParticipantApi(
                    ApiClient(
                        server.url("/").toString().toHttpUrl(),
                        { "secret" },
                        allowInsecureLocalDebug = true,
                    )
                )

            val result = api.callMeeting(CallMeetingInput(9), "meeting-key")

            assertTrue(result is ApiResult.Success)
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals("meeting-key", request.headers["Idempotency-Key"])
            assertEquals("/api/v1/games/current/meetings", request.url.encodedPath)
            assertEquals("{\"expectedStateVersion\":9}", request.body?.utf8())
        } finally {
            server.close()
        }
    }

    @Test
    fun replayUsesAuthoritativeIdempotentRoomCommand() = runTest {
        val server = MockWebServer()
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .body(
                    ContractJson.instance.encodeToString(
                        ApiEnvelope(
                            roomSnapshot(),
                            ApiMeta("request", "2026-09-29T00:00:00Z"),
                        )
                    )
                )
                .build()
        )
        server.start()
        try {
            val api =
                ParticipantApi(
                    ApiClient(
                        server.url("/").toString().toHttpUrl(),
                        { "secret" },
                        allowInsecureLocalDebug = true,
                    )
                )

            val result = api.replayRoom("replay-key")

            assertTrue(result is ApiResult.Success)
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals("replay-key", request.headers["Idempotency-Key"])
            assertEquals("/api/v1/rooms/current/replay", request.url.encodedPath)
            assertEquals("{}", request.body?.utf8())
        } finally {
            server.close()
        }
    }

    @Test
    fun endingParticipantSessionUsesAuthenticatedDeleteAndAcceptsNoContent() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse.Builder().code(204).build())
        server.start()
        try {
            val api =
                ParticipantApi(
                    ApiClient(
                        server.url("/").toString().toHttpUrl(),
                        { "secret" },
                        allowInsecureLocalDebug = true,
                    )
                )
            assertTrue(api.endSession() is ApiResult.Success)

            val request = server.takeRequest()
            assertEquals("DELETE", request.method)
            assertEquals("Bearer secret", request.headers["Authorization"])
            assertEquals("/api/v1/participant-sessions/current", request.url.encodedPath)
        } finally {
            server.close()
        }
    }

    @Test
    fun joinOptionsNormalizesCodeAndDecodesAvailability() = runTest {
        val server = MockWebServer()
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .body(
                    """{"data":{"availableAvatarIds":["fox","owl"],"spotsRemaining":2},"meta":{"requestId":"r","serverTime":"2026-09-27T00:00:00Z"}}"""
                )
                .build()
        )
        server.start()
        try {
            val api =
                ParticipantApi(
                    ApiClient(
                        server.url("/").toString().toHttpUrl(),
                        credentialProvider = { null },
                        allowInsecureLocalDebug = true,
                    )
                )
            val result = api.joinOptions("ab12cd") as ApiResult.Success

            assertEquals(listOf("fox", "owl"), result.value.availableAvatarIds)
            assertEquals(2, result.value.spotsRemaining)
            assertEquals("/api/v1/rooms/AB12CD/join-options", server.takeRequest().url.encodedPath)
        } finally {
            server.close()
        }
    }

    @Test
    fun signedUploadUsesExactPutInstructionsWithoutParticipantAuthorization() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse.Builder().code(200).build())
        server.start()
        try {
            val intent =
                UploadIntent(
                    uploadId = "upload",
                    expiresAt = "2026-09-28T01:00:00Z",
                    method = "PUT",
                    url = server.url("/private-upload").toString(),
                    headers = mapOf("X-Upload-Token" to "scoped-value"),
                    policy = EvidencePolicy("v1", 18, 24, "Temporary evidence"),
                )
            assertFalse(intent.toString().contains("scoped-value"))
            assertFalse(intent.toString().contains("private-upload"))
            val result =
                SignedUploadClient(allowInsecureLocalDebug = true)
                    .upload(intent, "image/jpeg", byteArrayOf(1, 2, 3))

            assertTrue(result is ApiResult.Success)
            val request = server.takeRequest()
            assertEquals("PUT", request.method)
            assertEquals("scoped-value", request.headers["X-Upload-Token"])
            assertEquals(null, request.headers["Authorization"])
            assertArrayEquals(byteArrayOf(1, 2, 3), request.body?.toByteArray())
        } finally {
            server.close()
        }
    }

    @Test
    fun signedUploadResolvesRelativeInstructionsAgainstApiOrigin() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse.Builder().code(200).build())
        server.start()
        try {
            val intent =
                UploadIntent(
                    uploadId = "upload",
                    expiresAt = "2026-09-28T01:00:00Z",
                    method = "PUT",
                    url = "/api/v1/evidence-objects/scoped-capability",
                    headers = mapOf("Content-Type" to "image/jpeg"),
                    policy = EvidencePolicy("v1", 18, 24, "Temporary evidence"),
                )

            val result =
                SignedUploadClient(
                        apiBaseUrl = server.url("/api/v1/"),
                        allowInsecureLocalDebug = true,
                    )
                    .upload(intent, "image/jpeg", byteArrayOf(1, 2, 3))

            assertTrue(result is ApiResult.Success)
            assertEquals(
                "/api/v1/evidence-objects/scoped-capability",
                server.takeRequest().url.encodedPath,
            )
        } finally {
            server.close()
        }
    }

    @Test
    fun signedUploadRejectsProtocolRelativeInstructions() = runTest {
        val intent =
            UploadIntent(
                uploadId = "upload",
                expiresAt = "2026-09-28T01:00:00Z",
                method = "PUT",
                url = "//uploads.example.test/object",
                headers = emptyMap(),
                policy = EvidencePolicy("v1", 18, 24, "Temporary evidence"),
            )

        val result =
            SignedUploadClient(apiBaseUrl = "https://api.example.test/".toHttpUrl())
                .upload(intent, "image/jpeg", byteArrayOf(1))

        assertTrue(result is ApiResult.Failure)
        assertTrue((result as ApiResult.Failure).error is ApiFailure.Contract)
    }

    @Test
    fun signedUploadRejectsUnknownMethodBeforeNetworkUse() = runTest {
        val intent =
            UploadIntent(
                uploadId = "upload",
                expiresAt = "2026-09-28T01:00:00Z",
                method = "POST",
                url = "https://uploads.example.test/object",
                headers = emptyMap(),
                policy = EvidencePolicy("v1", 18, 24, "Temporary evidence"),
            )

        val result = SignedUploadClient().upload(intent, "image/jpeg", byteArrayOf(1))

        assertTrue(result is ApiResult.Failure)
        assertTrue((result as ApiResult.Failure).error is ApiFailure.Contract)
    }

    @Test
    fun signedUploadRejectsOversizedPayloads() = runTest {
        val intent =
            UploadIntent(
                uploadId = "upload",
                expiresAt = "2026-09-28T01:00:00Z",
                method = "PUT",
                url = "https://uploads.example.test/object",
                headers = emptyMap(),
                policy = EvidencePolicy("v1", 18, 24, "Temporary evidence"),
            )

        assertTrue(
            SignedUploadClient()
                .upload(
                    intent,
                    "image/jpeg",
                    ByteArray(5 * 1024 * 1024 + 1),
                ) is ApiResult.Failure
        )
    }
}
