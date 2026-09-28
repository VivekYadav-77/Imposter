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
    private val signedUrl =
        Regex("(?i)https://[^\\s\"]+[?&](?:x-amz-|x-goog-|signature|token|key)[^\\s\"]*")
    private val filePath = Regex("(?i)(?:[a-z]:\\\\|/)(?:[^\\s/\\\\]+[/\\\\])+[^\\s]+")

    fun redact(value: String): String =
        value
            .replace(authorization, "$1██REDACTED██")
            .replace(tokenJson, "$1██REDACTED██")
            .replace(signedUrl, "██REDACTED_URL██")
            .replace(filePath, "██REDACTED_PATH██")
}

/** Bounds and neutralizes server-controlled text before it reaches UI or diagnostics. */
object UntrustedText {
    private const val MAX_DISPLAY_CHARS = 240
    private val whitespace = Regex("\\s+")

    fun display(value: String?, fallback: String = "Request failed"): String {
        val normalized =
            value
                ?.asSequence()
                ?.filterNot { it.isISOControl() || it.isBidiControl() }
                ?.joinToString(separator = "")
                ?.replace(whitespace, " ")
                ?.trim()
                ?.take(MAX_DISPLAY_CHARS)
                .orEmpty()
        return normalized.ifBlank { fallback }
    }

    fun diagnostic(value: String?, fallback: String = "unknown"): String =
        display(value, fallback).take(64)

    private fun Char.isBidiControl(): Boolean =
        code in 0x202A..0x202E || code in 0x2066..0x2069 || code in 0x200E..0x200F
}
