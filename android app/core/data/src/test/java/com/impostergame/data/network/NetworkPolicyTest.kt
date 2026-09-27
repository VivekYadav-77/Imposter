package com.impostergame.data.network

import com.impostergame.data.model.ApiEnvelope
import com.impostergame.data.model.ParticipantSelf
import kotlinx.coroutines.test.runTest
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
        } finally {
            server.close()
        }
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
}
