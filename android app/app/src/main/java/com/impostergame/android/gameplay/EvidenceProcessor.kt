package com.impostergame.android.gameplay

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class EvidenceProcessor(private val context: Context) {
    private val captureDirectory = File(context.cacheDir, "evidence-capture")

    init {
        cleanupOldCaptures()
    }

    fun createCameraUri(): Uri {
        captureDirectory.mkdirs()
        cleanupOldCaptures()
        val file = File(captureDirectory, "capture-${UUID.randomUUID()}.jpg")
        return FileProvider.getUriForFile(context, "${context.packageName}.evidence", file)
    }

    suspend fun prepare(uri: Uri): Result<PreparedEvidence> =
        withContext(Dispatchers.IO) {
            runCatching {
                val resolver = context.contentResolver
                val sourceType = resolver.getType(uri)
                require(sourceType in SUPPORTED_SOURCE_TYPES) {
                    "Choose a JPEG, PNG, or WebP image."
                }
                val orientation =
                    resolver.openInputStream(uri)?.use {
                        runCatching {
                                ExifInterface(it)
                                    .getAttributeInt(
                                        ExifInterface.TAG_ORIENTATION,
                                        ExifInterface.ORIENTATION_NORMAL,
                                    )
                            }
                            .getOrDefault(ExifInterface.ORIENTATION_NORMAL)
                    } ?: ExifInterface.ORIENTATION_NORMAL
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
                    ?: error("The selected image could not be opened.")
                require(bounds.outWidth > 0 && bounds.outHeight > 0) {
                    "The selected image is corrupt."
                }
                var sample = 1
                while (
                    bounds.outWidth / sample > MAX_DIMENSION ||
                        bounds.outHeight / sample > MAX_DIMENSION
                ) {
                    sample *= 2
                }
                val decoded =
                    resolver.openInputStream(uri)?.use {
                        BitmapFactory.decodeStream(
                            it,
                            null,
                            BitmapFactory.Options().apply {
                                inSampleSize = sample
                                inPreferredConfig = Bitmap.Config.ARGB_8888
                            },
                        )
                    } ?: error("The selected image is corrupt.")
                val scale =
                    minOf(1f, MAX_DIMENSION.toFloat() / maxOf(decoded.width, decoded.height))
                val width = (decoded.width * scale).toInt().coerceAtLeast(1)
                val height = (decoded.height * scale).toInt().coerceAtLeast(1)
                val scaled =
                    if (width == decoded.width && height == decoded.height) decoded
                    else
                        Bitmap.createScaledBitmap(decoded, width, height, true).also {
                            decoded.recycle()
                        }
                val oriented = applyOrientation(scaled, orientation)
                if (oriented !== scaled) scaled.recycle()
                val flattened =
                    Bitmap.createBitmap(oriented.width, oriented.height, Bitmap.Config.ARGB_8888)
                Canvas(flattened).apply {
                    drawColor(Color.WHITE)
                    drawBitmap(oriented, 0f, 0f, null)
                }
                oriented.recycle()
                val output = ByteArrayOutputStream()
                var quality = 90
                do {
                    output.reset()
                    check(flattened.compress(Bitmap.CompressFormat.JPEG, quality, output))
                    quality -= 10
                } while (output.size() > MAX_BYTES && quality >= 40)
                val bytes = output.toByteArray()
                flattened.recycle()
                require(bytes.isNotEmpty() && bytes.size <= MAX_BYTES) {
                    "The image is larger than the 5 MB evidence limit."
                }
                val preview =
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size).let { bitmap ->
                        val ratio =
                            minOf(
                                1f,
                                PREVIEW_DIMENSION.toFloat() / maxOf(bitmap.width, bitmap.height),
                            )
                        val previewBitmap =
                            Bitmap.createScaledBitmap(
                                bitmap,
                                (bitmap.width * ratio).toInt().coerceAtLeast(1),
                                (bitmap.height * ratio).toInt().coerceAtLeast(1),
                                true,
                            )
                        if (previewBitmap !== bitmap) bitmap.recycle()
                        ByteArrayOutputStream().use { previewOutput ->
                            previewBitmap.compress(Bitmap.CompressFormat.JPEG, 75, previewOutput)
                            previewBitmap.recycle()
                            previewOutput.toByteArray()
                        }
                    }
                val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
                PreparedEvidence(
                    bytes = bytes,
                    previewBytes = preview,
                    contentType = "image/jpeg",
                    checksum = Base64.getEncoder().encodeToString(digest),
                )
            }
        }

    fun cleanupCameraUri(uri: Uri) {
        runCatching { context.contentResolver.delete(uri, null, null) }
    }

    private fun cleanupOldCaptures() {
        val cutoff = System.currentTimeMillis() - CAPTURE_TTL_MILLIS
        captureDirectory.listFiles()?.filter { it.lastModified() < cutoff }?.forEach(File::delete)
    }

    private fun applyOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> {
                matrix.setRotate(90f)
                matrix.postScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
            ExifInterface.ORIENTATION_TRANSVERSE -> {
                matrix.setRotate(-90f)
                matrix.postScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
            else -> return bitmap
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private companion object {
        const val MAX_BYTES = 5 * 1024 * 1024
        const val MAX_DIMENSION = 2048
        const val PREVIEW_DIMENSION = 512
        const val CAPTURE_TTL_MILLIS = 60 * 60 * 1000L
        val SUPPORTED_SOURCE_TYPES = setOf("image/jpeg", "image/png", "image/webp")
    }
}
