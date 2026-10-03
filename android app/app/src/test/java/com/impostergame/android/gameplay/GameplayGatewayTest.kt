package com.impostergame.android.gameplay

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GameplayGatewayTest {
    @Test
    fun relativeEvidenceUrlResolvesAgainstApiOrigin() {
        val resolved =
            resolveEvidenceImageUrl(
                "https://example.test/".toHttpUrl(),
                "/api/v1/evidence-objects/signed-token",
                allowInsecureLocalDebug = false,
            )

        assertEquals(
            "https://example.test/api/v1/evidence-objects/signed-token",
            resolved.toString(),
        )
    }

    @Test
    fun localHttpEvidenceUrlIsOnlyAllowedForDebug() {
        val baseUrl = "http://10.0.2.2:3000/".toHttpUrl()

        assertNull(
            resolveEvidenceImageUrl(
                baseUrl,
                "/api/v1/evidence-objects/signed-token",
                allowInsecureLocalDebug = false,
            )
        )
        assertEquals(
            "http://10.0.2.2:3000/api/v1/evidence-objects/signed-token",
            resolveEvidenceImageUrl(
                    baseUrl,
                    "/api/v1/evidence-objects/signed-token",
                    allowInsecureLocalDebug = true,
                )
                .toString(),
        )
    }
}
