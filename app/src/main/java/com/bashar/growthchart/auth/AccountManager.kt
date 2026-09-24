package com.bashar.growthchart.auth

import android.content.Context
import android.util.Base64
import com.bashar.growthchart.core.security.Crypto
import com.bashar.growthchart.core.security.PasswordVerifier
import com.bashar.growthchart.data.AppDatabase
import com.bashar.growthchart.data.KeyWrapper
import com.bashar.growthchart.sync.CloudService
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Source
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.UUID

class AuthException(message: String) : Exception(message)

/** An unlocked clinician workspace: their own encrypted database and (optionally) cloud identity. */
class Session(
    val email: String,
    val db: AppDatabase,
    val firebaseUid: String?,
    /** 256-bit key used to end-to-end encrypt this clinician's records in the cloud. */
    val cloudKey: ByteArray?,
    /** True when sign-in was verified only against the local credential (no connection). */
    val offline: Boolean,
    /** The cloud data key changed (password reset elsewhere): everything local must be re-uploaded. */
    val cloudKeyRotated: Boolean = false,
)

class AccountManager(
    private val context: Context,
    private val cloud: CloudService,
) {
    private val store = AccountStore(context)

    private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun unb64(s: String) = Base64.decode(s, Base64.NO_WRAP)

    fun normalize(email: String) = email.trim().lowercase()

    val lastEmail: String? get() = store.currentEmail ?: store.all().lastOrNull()?.email

    /** Re-opens the previous session after an app restart (until the user logs out). */
    suspend fun restoreSession(): Session? = withContext(Dispatchers.IO) {
        val email = store.currentEmail ?: return@withContext null
        if (!prefsSignedIn()) return@withContext null
        val acc = store.get(email) ?: return@withContext null
        runCatching { openSession(acc, offline = true) }.getOrNull()
    }

    private val sessionPrefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    private fun prefsSignedIn() = sessionPrefs.getBoolean("signedIn", false)
    private fun setSignedIn(v: Boolean) = sessionPrefs.edit().putBoolean("signedIn", v).apply()

    suspend fun register(emailRaw: String, password: String): Session = withContext(Dispatchers.IO) {
        val email = normalize(emailRaw)
        validate(email, password, registering = true)
        if (store.get(email) != null) throw AuthException("An account with this email already exists on this device. Please sign in.")

        var uid: String? = null
        var cloudKey: ByteArray? = null
        val auth = cloud.auth()
        if (auth != null) {
            try {
                val result = withTimeout(30_000) { auth.createUserWithEmailAndPassword(email, password).await() }
                uid = result.user?.uid ?: throw AuthException("Cloud registration failed")
                cloudKey = loadOrCreateCloudKey(uid, password)
            } catch (e: FirebaseAuthUserCollisionException) {
                throw AuthException("This email is already registered. Please sign in instead.")
            } catch (e: FirebaseAuthWeakPasswordException) {
                throw AuthException("Password is too weak (use at least 8 characters).")
            } catch (e: FirebaseNetworkException) {
                throw AuthException("An internet connection is needed to create a cloud account.")
            } catch (e: TimeoutCancellationException) {
                throw AuthException("An internet connection is needed to create a cloud account.")
            }
        }
        val acc = createLocalAccount(email, password, uid, cloudKey)
        openSession(acc, offline = false)
    }

    suspend fun signIn(emailRaw: String, password: String): Session = withContext(Dispatchers.IO) {
        val email = normalize(emailRaw)
        validate(email, password, registering = false)
        var local = store.get(email)
        val auth = cloud.auth()

        if (auth != null) {
            try {
                val result = withTimeout(20_000) { auth.signInWithEmailAndPassword(email, password).await() }
                val uid = result.user?.uid ?: throw AuthException("Sign-in failed")
                val cloudKey = loadOrCreateCloudKey(uid, password)
                val previousKey = local?.wrappedCloudKey?.let { runCatching { KeyWrapper.unwrap(it) }.getOrNull() }
                val rotated = previousKey != null && !previousKey.contentEquals(cloudKey)
                local = if (local == null) {
                    createLocalAccount(email, password, uid, cloudKey)
                } else {
                    // Refresh the offline verifier (the password may have been changed on another device).
                    val v = PasswordVerifier.create(password.toCharArray())
                    local.copy(
                        verifierSalt = b64(v.salt), verifierIterations = v.iterations, verifierHash = b64(v.hash),
                        firebaseUid = uid, wrappedCloudKey = KeyWrapper.wrap(cloudKey),
                    ).also { store.put(it) }
                }
                return@withContext openSession(local, offline = false, cloudKeyRotated = rotated)
            } catch (e: FirebaseAuthInvalidCredentialsException) {
                return@withContext linkLocalAccountToCloud(local, email, password) ?: throw AuthException("Incorrect email or password.")
            } catch (e: FirebaseAuthInvalidUserException) {
                return@withContext linkLocalAccountToCloud(local, email, password)
                    ?: throw AuthException("No account found for this email. Choose \"Create account\".")
            } catch (e: FirebaseNetworkException) {
                // fall through to offline verification
            } catch (e: TimeoutCancellationException) {
                // fall through to offline verification
            } catch (e: FirebaseFirestoreException) {
                if (e.code != FirebaseFirestoreException.Code.UNAVAILABLE) throw AuthException("Cloud error: ${e.message}")
            }
            if (local == null) throw AuthException("No internet connection. The first sign-in on a new device must be online.")
        }

        local ?: throw AuthException("No account found on this device. Choose \"Create account\".")
        if (!verifier(local).matches(password.toCharArray())) throw AuthException("Incorrect email or password.")
        openSession(local, offline = auth != null)
    }

    /**
     * A clinician who started in local mode and later enabled cloud sync: if the password matches the
     * local account, create the matching cloud account so this device's records start syncing.
     * Returns null when this is not applicable (no local account / wrong password / cloud account exists).
     */
    private suspend fun linkLocalAccountToCloud(local: LocalAccount?, email: String, password: String): Session? {
        if (local == null || local.firebaseUid != null) return null
        if (!verifier(local).matches(password.toCharArray())) return null
        val auth = cloud.auth() ?: return null
        val uid = try {
            withTimeout(30_000) { auth.createUserWithEmailAndPassword(email, password).await() }.user?.uid
        } catch (e: FirebaseAuthUserCollisionException) {
            return null
        } ?: return null
        val cloudKey = loadOrCreateCloudKey(uid, password)
        val linked = local.copy(firebaseUid = uid, wrappedCloudKey = KeyWrapper.wrap(cloudKey))
        store.put(linked)
        // Everything already on this device must be uploaded.
        return openSession(linked, offline = false, cloudKeyRotated = true)
    }

    fun signOut() {
        setSignedIn(false)
        runCatching { cloud.auth()?.signOut() }
    }

    private fun verifier(a: LocalAccount) = PasswordVerifier(unb64(a.verifierSalt), a.verifierIterations, unb64(a.verifierHash))

    private fun validate(email: String, password: String, registering: Boolean) {
        if (!Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(email)) throw AuthException("Enter a valid email address.")
        if (password.isEmpty()) throw AuthException("Enter your password.")
        if (registering && password.length < 8) throw AuthException("Password must be at least 8 characters.")
    }

    private fun createLocalAccount(email: String, password: String, uid: String?, cloudKey: ByteArray?): LocalAccount {
        val v = PasswordVerifier.create(password.toCharArray())
        val acc = LocalAccount(
            email = email,
            verifierSalt = b64(v.salt),
            verifierIterations = v.iterations,
            verifierHash = b64(v.hash),
            wrappedDbKey = KeyWrapper.wrap(Crypto.randomBytes(32)),
            dbName = "patients_" + UUID.randomUUID().toString().replace("-", "") + ".db",
            firebaseUid = uid,
            wrappedCloudKey = cloudKey?.let { KeyWrapper.wrap(it) },
        )
        store.put(acc)
        return acc
    }

    private fun openSession(acc: LocalAccount, offline: Boolean, cloudKeyRotated: Boolean = false): Session {
        val db = AppDatabase.open(context, acc.dbName, KeyWrapper.unwrap(acc.wrappedDbKey))
        store.currentEmail = acc.email
        setSignedIn(true)
        return Session(
            email = acc.email,
            db = db,
            firebaseUid = acc.firebaseUid,
            cloudKey = acc.wrappedCloudKey?.let { KeyWrapper.unwrap(it) },
            offline = offline,
            cloudKeyRotated = cloudKeyRotated,
        )
    }

    /**
     * Cloud records are encrypted with a random data key. That key is stored in Firestore only
     * in wrapped form, encrypted with a key derived from the clinician's password, so neither the
     * cloud provider nor anyone without the password can read patient data.
     */
    private suspend fun loadOrCreateCloudKey(uid: String, password: String): ByteArray {
        val fs = cloud.firestore() ?: throw AuthException("Cloud not configured")
        val ref = fs.collection("users").document(uid).collection("meta").document("keys")
        val snap = withTimeout(20_000) { ref.get(Source.SERVER).await() }
        if (snap.exists()) {
            val salt = unb64(snap.getString("salt")!!)
            val iterations = snap.getLong("iterations")!!.toInt()
            val wrapped = unb64(snap.getString("wrapped")!!)
            val kek = Crypto.pbkdf2(password.toCharArray(), salt, iterations)
            val unwrapped = runCatching { Crypto.aesGcmDecrypt(kek, wrapped) }.getOrNull()
            if (unwrapped != null) return unwrapped
            // Password was reset through Firebase: previous cloud copies can no longer be decrypted.
            // Create a new key; this device re-uploads its data (see SyncManager.onKeyRotated).
        }
        val dek = Crypto.randomBytes(32)
        val salt = Crypto.randomBytes(16)
        val kek = Crypto.pbkdf2(password.toCharArray(), salt)
        withTimeout(20_000) {
            ref.set(
                mapOf(
                    "salt" to b64(salt),
                    "iterations" to Crypto.PBKDF2_ITERATIONS,
                    "wrapped" to b64(Crypto.aesGcmEncrypt(kek, dek)),
                    "createdAt" to System.currentTimeMillis(),
                )
            ).await()
        }
        return dek
    }
}
