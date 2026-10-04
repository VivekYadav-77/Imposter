package com.impostergame.android.account

import android.app.Activity
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

sealed interface GoogleCredentialResult {
    data class Success(val idToken: String) : GoogleCredentialResult {
        override fun toString(): String = "GoogleCredentialResult.Success(idToken=██REDACTED██)"
    }

    data object Cancelled : GoogleCredentialResult

    data class Failed(val safeReason: String) : GoogleCredentialResult
}

class GoogleCredentialCoordinator(
    activity: Activity,
    private val serverClientId: String,
) {
    private val context = activity
    private val manager = CredentialManager.create(activity)

    suspend fun signIn(nonce: String): GoogleCredentialResult {
        if (serverClientId.isBlank()) return GoogleCredentialResult.Failed("google_not_configured")
        return try {
            request(nonce, authorizedOnly = true)
        } catch (_: NoCredentialException) {
            try {
                request(nonce, authorizedOnly = false)
            } catch (_: GetCredentialCancellationException) {
                GoogleCredentialResult.Cancelled
            } catch (_: Exception) {
                GoogleCredentialResult.Failed("google_sign_in_failed")
            }
        } catch (_: GetCredentialCancellationException) {
            GoogleCredentialResult.Cancelled
        } catch (_: Exception) {
            GoogleCredentialResult.Failed("google_sign_in_failed")
        }
    }

    suspend fun clearState() {
        runCatching { manager.clearCredentialState(ClearCredentialStateRequest()) }
    }

    private suspend fun request(nonce: String, authorizedOnly: Boolean): GoogleCredentialResult {
        val option =
            GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(authorizedOnly)
                .setAutoSelectEnabled(authorizedOnly)
                .setServerClientId(serverClientId)
                .setNonce(nonce)
                .build()
        val credential =
            manager
                .getCredential(
                    context,
                    GetCredentialRequest.Builder().addCredentialOption(option).build(),
                )
                .credential
        if (
            credential !is CustomCredential ||
                credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            return GoogleCredentialResult.Failed("google_credential_invalid")
        }
        val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
        return GoogleCredentialResult.Success(token)
    }
}
