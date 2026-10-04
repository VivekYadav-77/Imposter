package com.impostergame.session

import android.annotation.SuppressLint
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.impostergame.data.account.AccountCredential
import com.impostergame.data.account.AccountSessionStore
import com.impostergame.data.account.StoredAccountSession
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

class AndroidKeystoreAccountSessionStore(
    context: Context,
    private val clock: Clock = Clock.systemUTC(),
) : AccountSessionStore {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    private val mutex = Mutex()
    private val mutableSession = MutableStateFlow<StoredAccountSession>(StoredAccountSession.None)
    override val session: StateFlow<StoredAccountSession> = mutableSession.asStateFlow()

    override suspend fun restore(): StoredAccountSession = mutex.withLock {
        val restored =
            try {
                decryptStored()
            } catch (_: GeneralSecurityException) {
                clearLocked(deleteKey = true)
                StoredAccountSession.Unavailable("secure_storage_invalidated")
            } catch (_: IllegalArgumentException) {
                clearLocked(deleteKey = true)
                StoredAccountSession.Unavailable("secure_storage_corrupt")
            } catch (_: Exception) {
                clearLocked(deleteKey = true)
                StoredAccountSession.Unavailable("secure_storage_unavailable")
            }
        mutableSession.value = restored
        restored
    }

    override suspend fun save(credential: AccountCredential) {
        mutex.withLock {
            require(credential.token.isNotBlank()) { "A blank account token cannot be stored" }
            require(credential.sessionId.isNotBlank()) {
                "A blank account session ID cannot be stored"
            }
            if (!credential.expiresAt.isAfter(clock.instant())) {
                clearLocked(deleteKey = false)
                throw IllegalArgumentException("An expired account token cannot be stored")
            }
            try {
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
                val plaintext = "${credential.token}\n${credential.sessionId}"
                val ciphertext = cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))
                check(
                    preferences
                        .edit()
                        .putString(TOKEN, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                        .putString(IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                        .putString(EXPIRY, credential.expiresAt.toString())
                        .commit()
                ) {
                    "Unable to persist account credential"
                }
                mutableSession.value = StoredAccountSession.Available(credential)
            } catch (error: Exception) {
                clearLocked(deleteKey = true)
                mutableSession.value =
                    StoredAccountSession.Unavailable("secure_storage_unavailable")
                throw SecureStorageException(error)
            }
        }
    }

    override suspend fun clear() {
        mutex.withLock {
            clearLocked(deleteKey = true)
            mutableSession.value = StoredAccountSession.None
        }
    }

    private fun decryptStored(): StoredAccountSession {
        val encodedToken = preferences.getString(TOKEN, null) ?: return StoredAccountSession.None
        val encodedIv = preferences.getString(IV, null) ?: return StoredAccountSession.None
        val expiry =
            preferences.getString(EXPIRY, null)?.let(Instant::parse)
                ?: return StoredAccountSession.None
        if (!expiry.isAfter(clock.instant())) {
            clearLocked(deleteKey = false)
            return StoredAccountSession.None
        }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateKey(),
            GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)),
        )
        val fields =
            String(
                    cipher.doFinal(Base64.decode(encodedToken, Base64.NO_WRAP)),
                    StandardCharsets.UTF_8,
                )
                .split('\n', limit = 2)
        require(fields.size == 2 && fields.all(String::isNotBlank))
        return StoredAccountSession.Available(AccountCredential(fields[0], fields[1], expiry))
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
        const val PREFERENCES = "account_credential_encrypted"
        const val KEY_ALIAS = "imposter_game_account_session_v1"
        const val TOKEN = "ciphertext"
        const val IV = "iv"
        const val EXPIRY = "expires_at"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
