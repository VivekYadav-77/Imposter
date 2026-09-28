package com.impostergame.session

import android.annotation.SuppressLint
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.impostergame.data.session.ParticipantCredential
import com.impostergame.data.session.SessionStore
import com.impostergame.data.session.StoredSession
import java.nio.charset.StandardCharsets
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.time.Clock
import java.time.Instant
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class AndroidKeystoreSessionStore(
    context: Context,
    private val clock: Clock = Clock.systemUTC(),
) : SessionStore {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    private val mutex = Mutex()
    private val mutableSession = MutableStateFlow<StoredSession>(StoredSession.None)
    override val session: StateFlow<StoredSession> = mutableSession.asStateFlow()

    override suspend fun restore(): StoredSession = mutex.withLock {
        val restored =
            try {
                decryptStored()
            } catch (_: GeneralSecurityException) {
                clearLocked(deleteKey = true)
                StoredSession.Unavailable("secure_storage_invalidated")
            } catch (_: IllegalArgumentException) {
                clearLocked(deleteKey = true)
                StoredSession.Unavailable("secure_storage_corrupt")
            } catch (_: Exception) {
                clearLocked(deleteKey = true)
                StoredSession.Unavailable("secure_storage_unavailable")
            }
        mutableSession.value = restored
        restored
    }

    override suspend fun save(credential: ParticipantCredential) {
        mutex.withLock {
            require(credential.token.isNotBlank()) { "A blank participant token cannot be stored" }
            if (!credential.expiresAt.isAfter(clock.instant())) {
                clearLocked(deleteKey = false)
                throw IllegalArgumentException("An expired participant token cannot be stored")
            }
            try {
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
                val ciphertext =
                    cipher.doFinal(credential.token.toByteArray(StandardCharsets.UTF_8))
                check(
                    preferences
                        .edit()
                        .putString(TOKEN, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                        .putString(IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                        .putString(EXPIRY, credential.expiresAt.toString())
                        .commit()
                ) {
                    "Unable to persist participant credential"
                }
                mutableSession.value = StoredSession.Available(credential)
            } catch (error: Exception) {
                clearLocked(deleteKey = true)
                mutableSession.value = StoredSession.Unavailable("secure_storage_unavailable")
                throw SecureStorageException(error)
            }
        }
    }

    override suspend fun clear() {
        mutex.withLock {
            clearLocked(deleteKey = true)
            mutableSession.value = StoredSession.None
        }
    }

    private fun decryptStored(): StoredSession {
        val encodedToken = preferences.getString(TOKEN, null) ?: return StoredSession.None
        val encodedIv = preferences.getString(IV, null) ?: return StoredSession.None
        val expiry =
            preferences.getString(EXPIRY, null)?.let(Instant::parse) ?: return StoredSession.None
        if (!expiry.isAfter(clock.instant())) {
            clearLocked(deleteKey = false)
            return StoredSession.None
        }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateKey(),
            GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)),
        )
        val token =
            String(
                cipher.doFinal(Base64.decode(encodedToken, Base64.NO_WRAP)),
                StandardCharsets.UTF_8,
            )
        return StoredSession.Available(ParticipantCredential(token, expiry))
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let {
            return it
        }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE).run {
            init(
                KeyGenParameterSpec.Builder(
                        KEY_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                    )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build()
            )
            generateKey()
        }
    }

    // Token removal must complete before callers continue or report the session as cleared.
    @SuppressLint("ApplySharedPref")
    private fun clearLocked(deleteKey: Boolean) {
        preferences.edit().clear().commit()
        if (deleteKey) {
            runCatching {
                KeyStore.getInstance(ANDROID_KEYSTORE).apply {
                    load(null)
                    if (containsAlias(KEY_ALIAS)) deleteEntry(KEY_ALIAS)
                }
            }
        }
    }

    private companion object {
        const val PREFERENCES = "participant_credential_encrypted"
        const val KEY_ALIAS = "imposter_game_participant_session_v1"
        const val TOKEN = "ciphertext"
        const val IV = "iv"
        const val EXPIRY = "expires_at"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}

class SecureStorageException(cause: Throwable) :
    IllegalStateException("Secure storage unavailable", cause)
