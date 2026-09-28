package com.impostergame.data.operations

import com.impostergame.data.network.SafeLogEvent
import com.impostergame.data.network.SafeLogger
import com.impostergame.data.network.UntrustedText
import java.util.ArrayDeque

enum class SafeNetworkState {
    OFFLINE,
    CONNECTING,
    ONLINE,
    UNKNOWN,
}

data class SupportDiagnostics(
    val versionName: String,
    val versionCode: Int,
    val environment: String,
    val networkState: SafeNetworkState,
    val recentRequestIds: List<String>,
) {
    fun asConsentGatedText(userConsented: Boolean): String? {
        if (!userConsented) return null
        return buildString {
            appendLine("App $versionName ($versionCode)")
            appendLine("Environment: $environment")
            appendLine("Network: ${networkState.name.lowercase()}")
            append("Recent request IDs: ")
            append(if (recentRequestIds.isEmpty()) "none" else recentRequestIds.joinToString())
        }
    }
}

/**
 * Keeps only bounded server/request correlation IDs; routes, bodies, headers, and errors are not
 * retained.
 */
class SupportDiagnosticsBuffer(private val capacity: Int = 5) : SafeLogger {
    private val requestIds = ArrayDeque<String>()

    init {
        require(capacity in 1..20) { "Diagnostic request ID capacity must be between 1 and 20" }
    }

    @Synchronized
    override fun log(event: SafeLogEvent) {
        val requestId = event.requestId?.let { UntrustedText.diagnostic(it, fallback = "") }
        if (requestId.isNullOrBlank()) return
        requestIds.remove(requestId)
        requestIds.addFirst(requestId)
        while (requestIds.size > capacity) requestIds.removeLast()
    }

    @Synchronized
    fun snapshot(
        versionName: String,
        versionCode: Int,
        environment: String,
        networkState: SafeNetworkState,
    ): SupportDiagnostics =
        SupportDiagnostics(
            versionName = UntrustedText.diagnostic(versionName),
            versionCode = versionCode,
            environment = UntrustedText.diagnostic(environment),
            networkState = networkState,
            recentRequestIds = requestIds.toList(),
        )
}
