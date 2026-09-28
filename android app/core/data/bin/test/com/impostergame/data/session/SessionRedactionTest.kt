package com.impostergame.data.session

import java.time.Instant
import org.junit.Assert.assertFalse
import org.junit.Test

class SessionRedactionTest {
    @Test
    fun credentialStringNeverContainsBearerSecret() {
        val credential =
            ParticipantCredential("never-print-this", Instant.parse("2099-01-01T00:00:00Z"))
        assertFalse(credential.toString().contains("never-print-this"))
    }
}
