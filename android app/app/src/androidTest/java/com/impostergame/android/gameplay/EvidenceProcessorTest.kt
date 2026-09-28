package com.impostergame.android.gameplay

import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.File
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EvidenceProcessorTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val processor = EvidenceProcessor(context)

    @Test
    fun validJpegPngAndWebpImagesArePreparedAsBoundedMetadataFreeJpegs() = runBlocking {
        val formats =
            listOf(
                "jpg" to Bitmap.CompressFormat.JPEG,
                "png" to Bitmap.CompressFormat.PNG,
                "webp" to Bitmap.CompressFormat.WEBP_LOSSLESS,
            )
        for ((extension, format) in formats) {
            val uri = fixtureUri(extension)
            val source = Bitmap.createBitmap(64, 32, Bitmap.Config.ARGB_8888)
            source.eraseColor(Color.MAGENTA)
            val encoded =
                ByteArrayOutputStream().use { output ->
                    assertTrue(source.compress(format, 95, output))
                    output.toByteArray()
                }
            source.recycle()
            context.contentResolver.openOutputStream(uri)?.use { it.write(encoded) }
                ?: error("Test fixture URI was not writable")

            val prepared = processor.prepare(uri).getOrThrow()

            assertEquals("image/jpeg", prepared.contentType)
            assertTrue(prepared.bytes.isNotEmpty())
            assertTrue(prepared.bytes.size <= 5 * 1024 * 1024)
            assertTrue(prepared.previewBytes.isNotEmpty())
            assertTrue(prepared.checksum.isNotBlank())
            processor.cleanupCameraUri(uri)
        }
    }

    @Test
    fun corruptPickedImageFailsClosed() = runBlocking {
        val uri = processor.createCameraUri()
        try {
            context.contentResolver.openOutputStream(uri)?.use { it.write(byteArrayOf(1, 2, 3)) }
                ?: error("Test fixture URI was not writable")

            val result = processor.prepare(uri)

            assertTrue(result.isFailure)
        } finally {
            processor.cleanupCameraUri(uri)
        }
    }

    @Test
    fun unsupportedMimeTypeFailsClosed() = runBlocking {
        val uri = fixtureUri("txt")
        context.contentResolver.openOutputStream(uri)?.use {
            it.write("not an image".toByteArray())
        } ?: error("Test fixture URI was not writable")

        assertTrue(processor.prepare(uri).isFailure)
        processor.cleanupCameraUri(uri)
    }

    @Test
    fun oversizedSourceFailsClosed() = runBlocking {
        val uri = fixtureUri("jpg")
        context.contentResolver.openOutputStream(uri)?.use { output ->
            val block = ByteArray(1024 * 1024)
            repeat(21) { output.write(block) }
        } ?: error("Test fixture URI was not writable")

        assertTrue(processor.prepare(uri).isFailure)
        processor.cleanupCameraUri(uri)
    }

    @Test
    fun revokedUriFailsClosed() = runBlocking {
        val uri = fixtureUri("jpg")
        processor.cleanupCameraUri(uri)

        assertTrue(processor.prepare(uri).isFailure)
    }

    private fun fixtureUri(extension: String): Uri {
        val directory = File(context.cacheDir, "evidence-capture").apply { mkdirs() }
        val file =
            File(directory, "fixture-${System.nanoTime()}.$extension").apply { createNewFile() }
        return FileProvider.getUriForFile(context, "${context.packageName}.evidence", file)
    }
}
