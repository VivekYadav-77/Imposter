package com.impostergame.data.realtime

import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReconnectBackoffTest {
    @Test
    fun delaysAreBounded() = runTest {
        val delays = mutableListOf<Long>()
        val backoff = ReconnectBackoff(jitter = { it }, sleeper = { delays += it })
        repeat(30) { backoff.pause(it) }
        assertEquals(500L, delays.first())
        assertTrue(delays.all { it in 0..10_000 })
        assertEquals(10_000L, delays.last())
    }

    @Test
    fun waitingIsCancellable() = runTest {
        var cancelled = false
        val backoff =
            ReconnectBackoff(
                jitter = { it },
                sleeper = {
                    try {
                        kotlinx.coroutines.awaitCancellation()
                    } finally {
                        cancelled = true
                    }
                },
            )
        val job: Job = launch { backoff.pause(0) }
        testScheduler.runCurrent()
        job.cancel()
        testScheduler.runCurrent()
        assertTrue(cancelled)
    }
}
