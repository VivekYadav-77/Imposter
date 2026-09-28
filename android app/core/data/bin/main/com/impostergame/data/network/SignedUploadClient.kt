package com.impostergame.data.network

import com.impostergame.data.model.UploadIntent
import java.io.IOException
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

class SignedUploadClient(
    client: OkHttpClient = ApiClient.defaultClient(),
    private val allowInsecureLocalDebug: Boolean = false,
) {
    private val client =
        client
            .newBuilder()
            .retryOnConnectionFailure(false)
            .followRedirects(false)
            .followSslRedirects(false)
            .build()

    suspend fun upload(
        intent: UploadIntent,
        contentType: String,
        bytes: ByteArray,
    ): ApiResult<Unit> {
        if (bytes.isEmpty() || bytes.size > MAX_UPLOAD_BYTES || contentType != "image/jpeg") {
            return ApiResult.Failure(
                ApiFailure.Contract(IllegalArgumentException("Invalid evidence upload payload"))
            )
        }
        val url =
            intent.url.toHttpUrlOrNull()
                ?: return ApiResult.Failure(
                    ApiFailure.Contract(IllegalArgumentException("Invalid signed upload URL"))
                )
        val local = url.host in setOf("localhost", "127.0.0.1", "10.0.2.2")
        if (!url.isHttps && !(allowInsecureLocalDebug && local)) {
            return ApiResult.Failure(
                ApiFailure.Contract(IllegalArgumentException("Signed upload URL must use HTTPS"))
            )
        }
        if (intent.method != "PUT") {
            return ApiResult.Failure(
                ApiFailure.Contract(IllegalArgumentException("Unsupported signed upload method"))
            )
        }
        val request =
            Request.Builder()
                .url(url)
                .put(bytes.toRequestBody(contentType.toMediaType()))
                .apply { intent.headers.forEach { (name, value) -> header(name, value) } }
                .build()
        val response =
            try {
                client.newCall(request).awaitUpload()
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                return ApiResult.Failure(ApiFailure.Cancelled)
            } catch (io: IOException) {
                return ApiResult.Failure(ApiFailure.Transport(io))
            }
        response.use {
            return if (it.isSuccessful) {
                ApiResult.Success(Unit, it.header("X-Request-ID"))
            } else {
                ApiResult.Failure(
                    ApiFailure.Http(
                        status = it.code,
                        code = "upload_${it.code}",
                        safeMessage = "Evidence upload failed",
                        requestId = it.header("X-Request-ID"),
                        safeDetails = null,
                        retryAfterMillis = retryAfterMillis(it.header("Retry-After")),
                    )
                )
            }
        }
    }

    private companion object {
        const val MAX_UPLOAD_BYTES = 5 * 1024 * 1024
    }
}

private suspend fun Call.awaitUpload(): Response = suspendCancellableCoroutine { continuation ->
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
