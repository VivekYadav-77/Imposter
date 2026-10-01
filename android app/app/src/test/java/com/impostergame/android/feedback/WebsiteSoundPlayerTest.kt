package com.impostergame.android.feedback

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WebsiteSoundPlayerTest {
    @Test
    fun everyWebsiteCueProducesDeterministicAudiblePcm() {
        val player = WebsiteSoundPlayer()
        try {
            GameFeedbackKind.entries.forEach { kind ->
                val first = player.synthesizeForTest(kind)
                val second = player.synthesizeForTest(kind)
                assertTrue("$kind must be long enough to hear", first.size >= 3_000)
                assertTrue("$kind must contain audible samples", first.any { it.toInt() != 0 })
                assertArrayEquals("$kind synthesis must be deterministic", first, second)
            }
        } finally {
            player.close()
        }
    }

    @Test
    fun meetingCueKeepsTheWebsiteLongAlertShape() {
        val player = WebsiteSoundPlayer()
        try {
            val samples = player.synthesizeForTest(GameFeedbackKind.Meeting)
            assertTrue(samples.size >= 44_100 * 2)
        } finally {
            player.close()
        }
    }
}
