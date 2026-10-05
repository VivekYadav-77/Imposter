package com.impostergame.data.account

import com.impostergame.data.network.ApiClient
import com.impostergame.data.network.ApiResult
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Test

class AccountApiTest {
    @Test
    fun historyDecodesItemsAndCursorFromResponseData() = runTest {
        val server = MockWebServer()
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .body(
                    """{"data":{"items":[{"id":"00000000-0000-0000-0000-000000000001","roomId":"00000000-0000-0000-0000-000000000002","code":"ABC123","taskPackName":"City Hunt","winner":"crew","endReason":"tasks_completed","phase":"finished","role":"crew","lifeStatus":"alive","playerCount":4,"won":true,"startedAt":"2026-10-05T00:00:00Z","endedAt":"2026-10-05T00:30:00Z"}],"nextCursor":"cursor-2"},"meta":{"requestId":"request-1","serverTime":"2026-10-05T00:31:00Z"}}"""
                )
                .build()
        )
        server.start()
        try {
            val api =
                AccountApi(
                    client =
                        ApiClient(
                            server.url("/").toString().toHttpUrl(),
                            credentialProvider = { null },
                            allowInsecureLocalDebug = true,
                        ),
                    accountCredential = { "account-token" },
                    participantCredential = { null },
                )

            val result = api.history() as ApiResult.Success

            assertEquals("City Hunt", result.value.items.single().taskPackName)
            assertEquals("cursor-2", result.value.nextCursor)
            val request = server.takeRequest()
            assertEquals("20", request.url.queryParameter("limit"))
            assertEquals("Bearer account-token", request.headers["Authorization"])
        } finally {
            server.close()
        }
    }
}
