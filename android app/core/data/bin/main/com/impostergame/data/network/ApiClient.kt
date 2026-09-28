package com.impostergame.data.network

import java.io.IOException
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.Buffer

class ApiClient(
    baseUrl: HttpUrl,
    private val credentialProvider: () -> String?,
    private val logger: SafeLogger = NoOpSafeLogger,
    private val json: Json = ContractJson.instance,
    allowInsecureLocalDebug: Boolean = false,
    client: OkHttpClient = defaultClient(),
) {
    private val baseUrl = validateBaseUrl(baseUrl, allowInsecureLocalDebug)
    private val client = client.newBuilder().retryOnConnectionFailure(false).build()

    suspend fun <T> get(
        routeTemplate: String,
        encodedPath: String,
        query: Map<String, String> = emptyMap(),
        deserializer: KSerializer<T>,
    ): ApiResult<T> {
        val url =
            baseUrl
                .newBuilder()
                .apply {
                    addEncodedPathSegments(encodedPath.trimStart('/'))
                    query.forEach { (name, value) -> addQueryParameter(name, value) }
                }
                .build()
        return execute(routeTemplate, Request.Builder().url(url).get(), deserializer)
    }

    suspend fun <T : Any> getOptional(
        routeTemplate: String,
        encodedPath: String,
        query: Map<String, String> = emptyMap(),
        deserializer: KSerializer<T>,
    ): ApiResult<T?> {
        val url =
            baseUrl
                .newBuilder()
                .apply {
                    addEncodedPathSegments(encodedPath.trimStart('/'))
                    query.forEach { (name, value) -> addQueryParameter(name, value) }
                }
                .build()
        return execute(
            routeTemplate,
            Request.Builder().url(url).get(),
            deserializer.nullable,
            onNoContent = { null },
        )
    }

    suspend fun delete(routeTemplate: String, encodedPath: String): ApiResult<Unit> {
        val url = baseUrl.newBuilder().addEncodedPathSegments(encodedPath.trimStart('/')).build()
        return execute(
            routeTemplate,
            Request.Builder().url(url).delete(),
            Unit.serializer(),
            onNoContent = {},
        )
    }

    suspend fun <T> command(
        command: CommandRequest,
        deserializer: KSerializer<T>,
    ): ApiResult<T> {
        val requestBody = command.body.toRequestBody(JSON_MEDIA_TYPE)
        val request =
            Request.Builder()
                .url(
                    baseUrl
                        .newBuilder()
                        .addEncodedPathSegments(command.encodedPath.trimStart('/'))
                        .build()
                )
                .method(command.method.name, requestBody)
                .header("Idempotency-Key", command.idempotencyKey)
                .header("X-Session-Transport", "bearer")
        return execute(command.routeTemplate, request, deserializer)
    }

    private suspend fun <T> execute(
        routeTemplate: String,
        builder: Request.Builder,
        deserializer: KSerializer<T>,
        onNoContent: (() -> T)? = null,
    ): ApiResult<T> {
        val requestId = UuidIdGenerator.create()
        val request =
            builder
                .header("Accept", "application/json")
                .header("X-Request-ID", requestId)
                .apply { credentialProvider()?.let { header("Authorization", "Bearer $it") } }
                .build()
        val startedAt = System.nanoTime()
        val response =
            try {
                client.newCall(request).await()
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                return ApiResult.Failure(ApiFailure.Cancelled)
            } catch (io: IOException) {
                logger.log(safeEvent(routeTemplate, null, startedAt, null, "transport_error"))
                return ApiResult.Failure(ApiFailure.Transport(io))
            }

        response.use {
            val responseRequestId = UntrustedText.diagnostic(it.header("X-Request-ID") ?: requestId)
            if (!it.isSuccessful) {
                val parsed = runCatching {
                    json.decodeFromString(
                        ErrorEnvelope.serializer(),
                        it.body.readBoundedUtf8(MAX_ERROR_BYTES),
                    )
                }
                    .getOrNull()
                val failure =
                    ApiFailure.Http(
                        status = it.code,
                        code =
                            parsed?.error?.code?.takeIf { code ->
                                code.length <= 64 &&
                                    code.all { char ->
                                        char.isUpperCase() || char.isDigit() || char == '_'
                                    }
                            } ?: "http_${it.code}",
                        safeMessage = UntrustedText.display(parsed?.error?.message),
                        requestId =
                            UntrustedText.diagnostic(parsed?.error?.requestId ?: responseRequestId),
                        safeDetails = null,
                        retryAfterMillis = retryAfterMillis(it.header("Retry-After")),
                    )
                logger.log(
                    safeEvent(routeTemplate, it.code, startedAt, responseRequestId, failure.code)
                )
                return ApiResult.Failure(failure)
            }
            if (it.code == 204) {
                val noContent = onNoContent
                if (noContent != null) {
                    logger.log(
                        safeEvent(routeTemplate, it.code, startedAt, responseRequestId, null)
                    )
                    return ApiResult.Success(noContent(), responseRequestId)
                }
            }
            return try {
                val decoded =
                    json.decodeFromString(deserializer, it.body.readBoundedUtf8(MAX_RESPONSE_BYTES))
                logger.log(safeEvent(routeTemplate, it.code, startedAt, responseRequestId, null))
                ApiResult.Success(decoded, responseRequestId)
            } catch (error: Exception) {
                logger.log(
                    safeEvent(
                        routeTemplate,
                        it.code,
                        startedAt,
                        responseRequestId,
                        "contract_error",
                    )
                )
                ApiResult.Failure(ApiFailure.Contract(error))
            }
        }
    }

    private fun safeEvent(
        route: String,
        status: Int?,
        startedAt: Long,
        requestId: String?,
        error: String?,
    ) =
        SafeLogEvent(
            route,
            requestId?.let(UntrustedText::diagnostic),
            status,
            (System.nanoTime() - startedAt) / 1_000_000,
            error?.let(UntrustedText::diagnostic),
        )

    companion object {
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
        private const val MAX_ERROR_BYTES = 64L * 1024
        private const val MAX_RESPONSE_BYTES = 2L * 1024 * 1024

        fun defaultClient(): OkHttpClient =
            OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .callTimeout(20, TimeUnit.SECONDS)
                .build()

        private fun validateBaseUrl(url: HttpUrl, allowInsecureLocalDebug: Boolean): HttpUrl {
            val local = url.host == "localhost" || url.host == "127.0.0.1" || url.host == "10.0.2.2"
            require(url.isHttps || (allowInsecureLocalDebug && local)) {
                "HTTPS is required outside an explicitly enabled local debug endpoint"
            }
            return url
        }
    }
}

private fun okhttp3.ResponseBody.readBoundedUtf8(maxBytes: Long): String {
    val declared = contentLength()
    require(declared == -1L || declared <= maxBytes) { "Response exceeds the allowed size" }
    val buffer = Buffer()
    val input = source()
    var total = 0L
    while (total <= maxBytes) {
        val read = input.read(buffer, minOf(8_192L, maxBytes + 1 - total))
        if (read == -1L) break
        total += read
    }
    require(total <= maxBytes) { "Response exceeds the allowed size" }
    return buffer.readUtf8()
}

object ContractJson {
    val instance = Json {
        ignoreUnknownKeys = true
        explicitNulls = true
    }
}

private suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    continuation.invokeOnCancellation { cancel() }
    enqueue(
        object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWith(Result.failure(e))
            }

            override fun onResponse(call: Call, response: Response) {
                if (continuation.isActive) continuation.resume(response) else response.close()
            }
        }
    )
}

internal fun retryAfterMillis(value: String?, now: Instant = Instant.now()): Long? {
    if (value == null) return null
    value.toLongOrNull()?.let {
        return (it * 1_000).coerceAtLeast(0)
    }
    return runCatching {
        val retryAt = ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()
        (retryAt.toEpochMilli() - now.toEpochMilli()).coerceAtLeast(0)
    }
        .getOrNull()
}
