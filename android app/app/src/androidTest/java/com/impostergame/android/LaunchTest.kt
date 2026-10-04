package com.impostergame.android

import android.Manifest
import android.content.pm.PackageManager
import android.view.ViewGroup
import android.view.WindowManager
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LaunchTest {
    @Test
    fun bootstrapShellLaunches() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val content = activity.findViewById<ViewGroup>(android.R.id.content)
                assertTrue(
                    "MainActivity must install an application content view",
                    content.childCount > 0,
                )
            }
        }
    }

    @Test
    fun screenshotsRemainEnabledForEveryBuild() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val secureFlag =
                    activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE
                assertTrue("FLAG_SECURE must remain disabled", secureFlag == 0)
            }
        }
    }

    @Test
    fun permissionsMatchTheFeaturesThatNeedThem() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val requested =
            context.packageManager
                .getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
                .requestedPermissions
                .orEmpty()
                .toSet()

        assertTrue(Manifest.permission.INTERNET in requested)
        assertTrue(Manifest.permission.VIBRATE in requested)
        assertTrue(Manifest.permission.CAMERA in requested)
        assertFalse(Manifest.permission.RECORD_AUDIO in requested)
        assertFalse(Manifest.permission.READ_EXTERNAL_STORAGE in requested)
        assertFalse(Manifest.permission.WRITE_EXTERNAL_STORAGE in requested)
        assertFalse(Manifest.permission.POST_NOTIFICATIONS in requested)
    }
}
