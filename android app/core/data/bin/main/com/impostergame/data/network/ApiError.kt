package com.impostergame.data.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

sealed interface ApiFailure {
    data class Http(
        val status: Int,
        val code: String,
        val safeMessage: String,
        val requestId: String?,
        val safeDetails: JsonObject?,
        val retryAfterMillis: Long?,
    ) : ApiFailure

    data class Transport(val cause: Throwable) : ApiFailure

    data class Contract(val cause: Throwable) : ApiFailure

    data object Cancelled : ApiFailure
}

@Serializable internal data class ErrorEnvelope(val error: ErrorBody)

@Serializable
internal data class ErrorBody(
    val code: String,
    val message: String,
    val details: JsonObject? = null,
    val requestId: String,
)

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T, val requestId: String?) : ApiResult<T>

    data class Failure(val error: ApiFailure) : ApiResult<Nothing>
}

enum class ErrorPolicy {
    CLEAR_SESSION,
    REFRESH_AND_CONFIRM,
    FIX_INPUT,
    RETRY_WITH_SERVER_DELAY,
    RETRY_WITH_BACKOFF,
    FAIL,
}

fun ApiFailure.policy(): ErrorPolicy =
    when (this) {
        is ApiFailure.Http ->
            when (status) {
                401 -> ErrorPolicy.CLEAR_SESSION
                409 -> ErrorPolicy.REFRESH_AND_CONFIRM
                422 -> ErrorPolicy.FIX_INPUT
                429 -> ErrorPolicy.RETRY_WITH_SERVER_DELAY
                in 500..599 -> ErrorPolicy.RETRY_WITH_BACKOFF
                else -> ErrorPolicy.FAIL
            }
        is ApiFailure.Transport -> ErrorPolicy.RETRY_WITH_BACKOFF
        is ApiFailure.Cancelled,
        is ApiFailure.Contract -> ErrorPolicy.FAIL
    }
