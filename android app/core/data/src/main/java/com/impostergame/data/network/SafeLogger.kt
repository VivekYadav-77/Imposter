package com.impostergame.data.network

fun interface SafeLogger {
    fun log(event: SafeLogEvent)
}

data class SafeLogEvent(
    val routeTemplate: String,
    val requestId: String?,
    val statusCode: Int?,
    val durationMillis: Long,
    val errorCode: String? = null,
)

object NoOpSafeLogger : SafeLogger {
    override fun log(event: SafeLogEvent) = Unit
}

internal object SecretRedactor {
    private val authorization = Regex("(?i)(authorization\\s*[:=]\\s*bearer\\s+)[^\\s,}]+")
    private val tokenJson = Regex("(?i)(\"(?:sessionToken|token)\"\\s*:\\s*\")[^\"]+")

    fun redact(value: String): String =
        value.replace(authorization, "$1██REDACTED██").replace(tokenJson, "$1██REDACTED██")
}
