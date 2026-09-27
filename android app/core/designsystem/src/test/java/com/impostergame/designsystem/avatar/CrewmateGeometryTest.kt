package com.impostergame.designsystem.avatar

import java.io.File
import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CrewmateGeometryTest {
    @Test
    fun vectorRetainsCanonicalViewportAndPathGeometry() {
        val vector = File("src/main/res/drawable/ic_crewmate.xml").readText()
        val pathData =
            Regex("android:pathData=\"([^\"]+)\"").find(vector)?.groupValues?.get(1)
                ?: error("Crewmate pathData is missing")

        assertTrue(vector.contains("android:viewportWidth=\"192\""))
        assertTrue(vector.contains("android:viewportHeight=\"192\""))
        assertTrue(vector.contains("android:fillType=\"evenOdd\""))
        assertEquals(
            "39ce351f047445dbe1f94cb892dd85e91d925896f2592b18c4e8bc35fb40a912",
            pathData.sha256(),
        )
    }

    private fun String.sha256(): String =
        MessageDigest.getInstance("SHA-256").digest(toByteArray()).joinToString("") {
            "%02x".format(it)
        }
}
