package com.impostergame.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BuildEnvironmentTest {
    @Test
    fun debugBuildIdentifiesItsEnvironmentWithoutEmbeddingAnEndpoint() {
        assertEquals("debug", BuildConfig.ENVIRONMENT)
        assertTrue(BuildConfig.API_BASE_URL.isBlank())
    }
}
