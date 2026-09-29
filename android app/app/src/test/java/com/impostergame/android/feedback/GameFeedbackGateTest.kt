package com.impostergame.android.feedback

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GameFeedbackGateTest {
    @Test
    fun stableEventPlaysOnlyOnce() {
        var now = 1_000L
        val gate = GameFeedbackGate({ now })
        val event = GameFeedbackEvent(GameFeedbackKind.Meeting, "meeting-1")

        assertTrue(gate.shouldPlay(event))
        now += 1_000
        assertFalse(gate.shouldPlay(event))
    }

    @Test
    fun rapidEventIsRateLimitedWithoutConsumingStableIdentity() {
        var now = 1_000L
        val gate = GameFeedbackGate({ now })

        assertTrue(gate.shouldPlay(GameFeedbackEvent(GameFeedbackKind.VoteSelect)))
        now += 10
        val stable = GameFeedbackEvent(GameFeedbackKind.VoteSelect, "choice-2")
        assertFalse(gate.shouldPlay(stable))
        now += 200
        assertTrue(gate.shouldPlay(stable))
    }
}
