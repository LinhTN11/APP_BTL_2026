package com.gapmobile.auth

import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/** Android supplies the Google credential; Firebase Auth SDK validates and exchanges it. */
class GapGoogleSignInModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var cancellation: CancellationSignal? = null
  private var pending: Promise? = null

  override fun getName() = "GapGoogleSignIn"

  @ReactMethod
  fun signIn(webClientId: String, nonce: String, promise: Promise) {
    context.runOnUiQueueThread {
      if (pending != null) {
        promise.reject("GOOGLE_BUSY", "A sign-in request is already open.")
        return@runOnUiQueueThread
      }
      val activity = context.currentActivity
      if (activity == null || activity.isFinishing) {
        promise.reject("GOOGLE_UNAVAILABLE", "No foreground activity.")
        return@runOnUiQueueThread
      }
      try {
        val option = GetSignInWithGoogleOption.Builder(webClientId)
          .apply { if (nonce.isNotBlank()) setNonce(nonce) }.build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val signal = CancellationSignal()
        cancellation = signal
        pending = promise
        CredentialManager.create(context).getCredentialAsync(
          activity, request, signal, ContextCompat.getMainExecutor(context),
          object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
            override fun onResult(result: GetCredentialResponse) {
              pending = null
              cancellation = null
              try {
                val credential = result.credential
                if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                  promise.reject("GOOGLE_INVALID_CREDENTIAL", "Unexpected credential type.")
                  return
                }
                promise.resolve(GoogleIdTokenCredential.createFrom(credential.data).idToken)
              } catch (_: Exception) {
                promise.reject("GOOGLE_INVALID_CREDENTIAL", "Cannot read Google credential.")
              }
            }

            override fun onError(error: GetCredentialException) {
              pending = null
              cancellation = null
              val code = when (error) {
                is GetCredentialCancellationException -> "GOOGLE_CANCELLED"
                is NoCredentialException -> "GOOGLE_NO_CREDENTIAL"
                else -> "GOOGLE_UNAVAILABLE"
              }
              // Provider exceptions can include account details; keep errors generic.
              promise.reject(code, "Google sign-in could not complete.")
            }
          }
        )
      } catch (_: Exception) {
        pending = null
        cancellation = null
        promise.reject("GOOGLE_UNAVAILABLE", "Google sign-in could not start.")
      }
    }
  }

  override fun invalidate() {
    cancellation?.cancel()
    cancellation = null
    pending?.reject("GOOGLE_CANCELLED", "Sign-in closed.")
    pending = null
    super.invalidate()
  }
}
