package com.bashar.growthchart.sync

import android.util.Base64
import com.bashar.growthchart.core.model.MeasurementRecord
import com.bashar.growthchart.core.model.PatientRecord
import com.bashar.growthchart.core.security.Crypto
import com.bashar.growthchart.data.AppSettings
import com.bashar.growthchart.data.PatientRepository
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json

data class SyncReport(val uploaded: Int, val downloaded: Int, val undecryptable: Int)

/**
 * Two-way synchronisation of one clinician's records with Cloud Firestore.
 *
 * Layout:  users/{uid}/records/{recordId} = { kind, updatedAt, deleted, payload, serverTs }
 * payload = base64(AES-256-GCM(cloudKey, JSON record))  -> end-to-end encrypted.
 * Firestore security rules must restrict users/{uid}/... to request.auth.uid == uid.
 *
 * Conflict resolution: last writer wins on the record's updatedAt timestamp.
 * The pull cursor uses the server timestamp so that device clock differences cannot hide changes.
 */
class SyncManager(
    private val firestore: FirebaseFirestore,
    private val uid: String,
    private val account: String,
    private val cloudKey: ByteArray,
    private val repo: PatientRepository,
    private val settings: AppSettings,
) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val mutex = Mutex()
    private val records get() = firestore.collection("users").document(uid).collection("records")

    suspend fun onKeyRotated() {
        repo.markAllDirty()
        settings.clearLastPull(account)
    }

    suspend fun sync(): SyncReport = mutex.withLock {
        val up = push()
        val (down, bad) = pull()
        SyncReport(up, down, bad)
    }

    private fun encrypt(plain: String): String =
        Base64.encodeToString(Crypto.aesGcmEncrypt(cloudKey, plain.toByteArray(Charsets.UTF_8), uid.toByteArray()), Base64.NO_WRAP)

    private fun decrypt(payload: String): String =
        Crypto.aesGcmDecrypt(cloudKey, Base64.decode(payload, Base64.NO_WRAP), uid.toByteArray()).toString(Charsets.UTF_8)

    private suspend fun push(): Int {
        var n = 0
        for (p in repo.dirtyPatients()) {
            val r = p.toRecord()
            write(r.id, "patient", r.updatedAt, r.deleted, json.encodeToString(PatientRecord.serializer(), r))
            repo.clearPatientDirty(r.id, r.updatedAt)
            n++
        }
        for (m in repo.dirtyMeasurements()) {
            val r = m.toRecord()
            write(r.id, "measurement", r.updatedAt, r.deleted, json.encodeToString(MeasurementRecord.serializer(), r))
            repo.clearMeasurementDirty(r.id, r.updatedAt)
            n++
        }
        return n
    }

    private suspend fun write(id: String, kind: String, updatedAt: Long, deleted: Boolean, plain: String) {
        val data = hashMapOf(
            "kind" to kind,
            "updatedAt" to updatedAt,
            "deleted" to deleted,
            "payload" to encrypt(plain),
            "serverTs" to FieldValue.serverTimestamp(),
        )
        // The write is queued by Firestore even if the timeout expires; the record stays dirty and is retried.
        withTimeout(30_000) { records.document(id).set(data).await() }
    }

    private suspend fun pull(): Pair<Int, Int> {
        val (s, ns) = settings.lastPull(account)
        var cursor = Timestamp(s, ns)
        var applied = 0
        var bad = 0
        while (true) {
            val snap = withTimeout(30_000) {
                records.whereGreaterThan("serverTs", cursor)
                    .orderBy("serverTs", Query.Direction.ASCENDING)
                    .limit(500)
                    .get(Source.SERVER).await()
            }
            if (snap.isEmpty) break
            for (doc in snap.documents) {
                val ts = doc.getTimestamp("serverTs") ?: continue
                val payload = doc.getString("payload")
                val plain = payload?.let { runCatching { decrypt(it) }.getOrNull() }
                if (plain == null) {
                    bad++
                } else {
                    val ok = when (doc.getString("kind")) {
                        "patient" -> repo.applyRemotePatient(json.decodeFromString(PatientRecord.serializer(), plain))
                        "measurement" -> repo.applyRemoteMeasurement(json.decodeFromString(MeasurementRecord.serializer(), plain))
                        else -> false
                    }
                    if (ok) applied++
                }
                if (ts > cursor) cursor = ts
            }
            settings.setLastPull(account, cursor.seconds, cursor.nanoseconds)
            if (snap.size() < 500) break
        }
        return applied to bad
    }

    companion object {
        fun isNetworkError(e: Throwable): Boolean =
            e is TimeoutCancellationException || e is com.google.firebase.FirebaseNetworkException ||
                (e is com.google.firebase.firestore.FirebaseFirestoreException && e.code == com.google.firebase.firestore.FirebaseFirestoreException.Code.UNAVAILABLE)
    }
}
