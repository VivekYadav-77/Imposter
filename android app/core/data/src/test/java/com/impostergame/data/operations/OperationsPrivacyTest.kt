package com.impostergame.data.operations

import com.impostergame.data.network.SafeLogEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OperationsPrivacyTest {
    @Test
    fun telemetryAndBreadcrumbsReceiveOnlyFixedVocabulary() {
        val metrics = mutableListOf<OperationalEvent>()
        val breadcrumbs = mutableListOf<OperationalEvent>()
        val operations =
            PrivacySafeOperations(
                OperationalTelemetry(metrics::add),
                SafeBreadcrumbSink(breadcrumbs::add),
            )

        operations.record(OperationalMetric.RESYNC, OperationalOutcome.RETRYING)

        assertEquals(metrics, breadcrumbs)
        assertEquals(
            OperationalEvent(OperationalMetric.RESYNC, OperationalOutcome.RETRYING),
            metrics.single(),
        )
        assertFalse(metrics.single().toString().contains("token", ignoreCase = true))
    }

    @Test
    fun diagnosticsRequireConsentAndKeepOnlyBoundedSanitizedRequestIds() {
        val buffer = SupportDiagnosticsBuffer(capacity = 2)
        buffer.log(SafeLogEvent("/private/room", "request-1", 200, 10, null))
        buffer.log(SafeLogEvent("/private/room", "request-2\u202E", 409, 11, "conflict"))
        buffer.log(SafeLogEvent("/private/room", "request-3", 200, 12, null))
        val diagnostics = buffer.snapshot("1.2.3", 12, "release", SafeNetworkState.ONLINE)

        assertNull(diagnostics.asConsentGatedText(userConsented = false))
        val shared = requireNotNull(diagnostics.asConsentGatedText(userConsented = true))
        assertTrue(shared.contains("App 1.2.3 (12)"))
        assertTrue(shared.contains("request-3, request-2"))
        assertFalse(shared.contains("request-1"))
        assertFalse(shared.contains("/private/room"))
        assertFalse(shared.contains("conflict"))
        assertFalse(shared.contains('\u202E'))
    }
}
