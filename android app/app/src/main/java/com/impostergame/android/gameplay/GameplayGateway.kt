package com.impostergame.android.gameplay

import com.impostergame.android.entry.GatewayResult
import com.impostergame.data.model.ConfirmSubmissionInput
import com.impostergame.data.model.FlagSubmissionInput
import com.impostergame.data.model.GameSnapshot
import com.impostergame.data.model.KillInput
import com.impostergame.data.model.Submission
import com.impostergame.data.model.SubmissionConfirmation
import com.impostergame.data.model.UploadIntentInput
import com.impostergame.data.network.ApiResult
import com.impostergame.data.network.ParticipantApi
import com.impostergame.data.network.SignedUploadClient
import java.net.URI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

interface GameplayGateway {
    suspend fun snapshot(): GatewayResult<GameSnapshot>

    suspend fun submitEvidence(
        assignmentId: String,
        expectedStateVersion: Long,
        evidence: PreparedEvidence,
        intentKey: String,
        confirmationKey: String,
        onStage: (UploadStage) -> Unit,
    ): GatewayResult<SubmissionConfirmation>

    suspend fun submissions(): GatewayResult<List<Submission>>

    suspend fun loadImage(url: String): GatewayResult<ByteArray>

    suspend fun flag(
        submissionId: String,
        expectedStateVersion: Long,
        key: String,
    ): GatewayResult<Unit>

    suspend fun kill(
        targetParticipantId: String,
        expectedStateVersion: Long,
        key: String,
    ): GatewayResult<GameSnapshot>
}

class UnavailableGameplayGateway(private val reason: String) : GameplayGateway {
    private fun <T> failure(): GatewayResult<T> =
        GatewayResult.Failure(
            com.impostergame.data.network.ApiFailure.Transport(IllegalStateException(reason))
        )

    override suspend fun snapshot(): GatewayResult<GameSnapshot> = failure()

    override suspend fun submitEvidence(
        assignmentId: String,
        expectedStateVersion: Long,
        evidence: PreparedEvidence,
        intentKey: String,
        confirmationKey: String,
        onStage: (UploadStage) -> Unit,
    ): GatewayResult<SubmissionConfirmation> = failure()

    override suspend fun submissions(): GatewayResult<List<Submission>> = failure()

    override suspend fun loadImage(url: String): GatewayResult<ByteArray> = failure()

    override suspend fun flag(
        submissionId: String,
        expectedStateVersion: Long,
        key: String,
    ): GatewayResult<Unit> = failure()

    override suspend fun kill(
        targetParticipantId: String,
        expectedStateVersion: Long,
        key: String,
    ): GatewayResult<GameSnapshot> = failure()
}

class NetworkGameplayGateway(
    private val api: ParticipantApi,
    private val uploads: SignedUploadClient,
    private val imageClient: OkHttpClient = com.impostergame.data.network.ApiClient.defaultClient(),
    private val allowInsecureLocalDebug: Boolean = false,
) : GameplayGateway {
    override suspend fun snapshot(): GatewayResult<GameSnapshot> =
        when (val result = api.fetch(null)) {
            is ApiResult.Failure -> GatewayResult.Failure(result.error)
            is ApiResult.Success ->
                result.value?.let { GatewayResult.Success(it) }
                    ?: GatewayResult.Failure(
                        com.impostergame.data.network.ApiFailure.Contract(
                            IllegalStateException("Game snapshot was empty")
                        )
                    )
        }

    override suspend fun submitEvidence(
        assignmentId: String,
        expectedStateVersion: Long,
        evidence: PreparedEvidence,
        intentKey: String,
        confirmationKey: String,
        onStage: (UploadStage) -> Unit,
    ): GatewayResult<SubmissionConfirmation> {
        onStage(UploadStage.REQUESTING_INTENT)
        val intent =
            when (
                val result =
                    api.createUploadIntent(
                        assignmentId,
                        UploadIntentInput(
                            expectedStateVersion,
                            evidence.contentType,
                            evidence.bytes.size.toLong(),
                            evidence.checksum,
                        ),
                        intentKey,
                    )
            ) {
                is ApiResult.Failure -> return GatewayResult.Failure(result.error)
                is ApiResult.Success -> result.value
            }
        onStage(UploadStage.UPLOADING)
        when (val result = uploads.upload(intent, evidence.contentType, evidence.bytes)) {
            is ApiResult.Failure -> return GatewayResult.Failure(result.error)
            is ApiResult.Success -> Unit
        }
        onStage(UploadStage.CONFIRMING)
        return api.confirmSubmission(
                assignmentId,
                ConfirmSubmissionInput(expectedStateVersion, intent.uploadId),
                confirmationKey,
            )
            .toGateway()
    }

    override suspend fun submissions(): GatewayResult<List<Submission>> =
        api.submissions().toGateway()

    override suspend fun loadImage(url: String): GatewayResult<ByteArray> =
        withContext(Dispatchers.IO) {
            val uri = runCatching { URI(url) }.getOrNull()
            val local = uri?.host in setOf("localhost", "127.0.0.1", "10.0.2.2")
            if (uri?.scheme != "https" && !(allowInsecureLocalDebug && local)) {
                return@withContext GatewayResult.Failure(
                    com.impostergame.data.network.ApiFailure.Contract(
                        IllegalArgumentException("Evidence image URL must use HTTPS")
                    )
                )
            }
            try {
                imageClient.newCall(Request.Builder().url(url).get().build()).execute().use {
                    response ->
                    if (!response.isSuccessful) {
                        GatewayResult.Failure(
                            com.impostergame.data.network.ApiFailure.Http(
                                response.code,
                                "image_${response.code}",
                                "Evidence image is unavailable",
                                null,
                                null,
                                null,
                            )
                        )
                    } else {
                        val body = response.body
                        if (body.contentLength() > MAX_PREVIEW_BYTES) {
                            GatewayResult.Failure(
                                com.impostergame.data.network.ApiFailure.Contract(
                                    IllegalArgumentException("Evidence preview is too large")
                                )
                            )
                        } else {
                            val bytes =
                                body.byteStream().use { it.readNBytes(MAX_PREVIEW_BYTES + 1) }
                            if (bytes.size > MAX_PREVIEW_BYTES) {
                                GatewayResult.Failure(
                                    com.impostergame.data.network.ApiFailure.Contract(
                                        IllegalArgumentException("Evidence preview is too large")
                                    )
                                )
                            } else {
                                GatewayResult.Success(bytes)
                            }
                        }
                    }
                }
            } catch (error: java.io.IOException) {
                GatewayResult.Failure(com.impostergame.data.network.ApiFailure.Transport(error))
            }
        }

    override suspend fun flag(
        submissionId: String,
        expectedStateVersion: Long,
        key: String,
    ): GatewayResult<Unit> =
        when (
            val result =
                api.flagSubmission(
                    submissionId,
                    FlagSubmissionInput(expectedStateVersion),
                    key,
                )
        ) {
            is ApiResult.Failure -> GatewayResult.Failure(result.error)
            is ApiResult.Success -> GatewayResult.Success(Unit)
        }

    override suspend fun kill(
        targetParticipantId: String,
        expectedStateVersion: Long,
        key: String,
    ): GatewayResult<GameSnapshot> =
        api.kill(KillInput(expectedStateVersion, targetParticipantId), key).toGateway()

    private companion object {
        const val MAX_PREVIEW_BYTES = 5 * 1024 * 1024
    }
}

private fun <T> ApiResult<T>.toGateway(): GatewayResult<T> =
    when (this) {
        is ApiResult.Failure -> GatewayResult.Failure(error)
        is ApiResult.Success -> GatewayResult.Success(value)
    }
