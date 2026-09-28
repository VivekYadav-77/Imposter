package com.impostergame.android

import org.junit.Assert.assertEquals
import org.junit.Test

class BuildEnvironmentTest {
    @Test
    fun debugBuildIdentifiesItsEnvironment() {
        assertEquals("debug", BuildConfig.ENVIRONMENT)
    }
}
