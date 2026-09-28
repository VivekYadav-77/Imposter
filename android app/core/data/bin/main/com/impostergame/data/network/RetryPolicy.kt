package com.impostergame.data.network

import kotlin.math.min
import kotlin.random.Random
import kotlinx.coroutines.delay

class TransientRetryPolicy(
    private val maxAttempts: Int = 4,
    private val initialDelayMillis: Long = 500,
    private val maxDelayMillis: Long = 10_000,
    private val jitter: (Long) -> Long = { ceiling -> Random.nextLong(0, ceiling + 1) },
    private val sleeper: suspend (Long) -> Unit = { delay(it) },
) {
    suspend fun <T> execute(block: suspend () -> ApiResult<T>): ApiResult<T> {
        var attempt = 0
        while (true) {
            val result = block()
            attempt++
            if (
                result !is ApiResult.Failure ||
                    attempt >= maxAttempts ||
                    !result.error.isRetryable()
            ) {
                return result
            }
            val serverDelay = (result.error as? ApiFailure.Http)?.retryAfterMillis
            val exponential = min(maxDelayMillis, initialDelayMillis * (1L shl (attempt - 1)))
            sleeper((serverDelay ?: jitter(exponential)).coerceAtMost(maxDelayMillis))
        }
    }
}

private fun ApiFailure.isRetryable(): Boolean =
    when (this) {
        is ApiFailure.Transport -> true
        is ApiFailure.Http -> status == 429 || status in 500..599
        else -> false
    }
