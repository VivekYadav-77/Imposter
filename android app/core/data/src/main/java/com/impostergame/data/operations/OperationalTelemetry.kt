package com.impostergame.data.operations

/**
 * Fixed operational vocabulary. The API intentionally accepts no arbitrary labels or payloads so
 * roles, ballots, evidence data, room codes, participant IDs, and tokens cannot become metrics.
 */
enum class OperationalMetric {
    BOOTSTRAP,
    JOIN,
    SOCKET_RECONNECT,
    RESYNC,
    UPLOAD_PREPARE,
    UPLOAD_TRANSFER,
    UPLOAD_CONFIRM,
    COMMAND_CONFLICT,
    SESSION_REVOCATION,
}

enum class OperationalOutcome {
    STARTED,
    SUCCEEDED,
    RETRYING,
    FAILED,
}

data class OperationalEvent(
    val metric: OperationalMetric,
    val outcome: OperationalOutcome,
)

fun interface OperationalTelemetry {
    fun record(event: OperationalEvent)
}

object NoOpOperationalTelemetry : OperationalTelemetry {
    override fun record(event: OperationalEvent) = Unit
}

/** A privacy-safe crash breadcrumb has the same fixed vocabulary as operational metrics. */
fun interface SafeBreadcrumbSink {
    fun add(event: OperationalEvent)
}

class PrivacySafeOperations(
    private val metrics: OperationalTelemetry = NoOpOperationalTelemetry,
    private val breadcrumbs: SafeBreadcrumbSink = SafeBreadcrumbSink {},
) {
    fun record(metric: OperationalMetric, outcome: OperationalOutcome) {
        val event = OperationalEvent(metric, outcome)
        metrics.record(event)
        breadcrumbs.add(event)
    }
}
