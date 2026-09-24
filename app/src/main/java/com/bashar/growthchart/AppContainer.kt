package com.bashar.growthchart

import android.app.Application
import com.bashar.growthchart.auth.AccountManager
import com.bashar.growthchart.auth.Session
import com.bashar.growthchart.data.AppSettings
import com.bashar.growthchart.data.PatientRepository
import com.bashar.growthchart.sync.CloudService
import com.bashar.growthchart.sync.SyncManager
import com.bashar.growthchart.sync.SyncReport
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ActiveSession(val session: Session, val repo: PatientRepository, val sync: SyncManager?) {
    val email get() = session.email
}

sealed class SyncState {
    data object LocalOnly : SyncState()
    data object Idle : SyncState()
    data object Running : SyncState()
    data class Done(val report: SyncReport, val at: Long) : SyncState()
    data object Offline : SyncState()
    data class Error(val message: String) : SyncState()
}

/** Simple manual dependency container (no DI framework needed for an app of this size). */
class AppContainer(val app: Application) {
    val settings = AppSettings(app)
    val cloud = CloudService(app, settings)
    val accounts = AccountManager(app, cloud)
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _session = MutableStateFlow<ActiveSession?>(null)
    val session: StateFlow<ActiveSession?> = _session.asStateFlow()

    private val _restoring = MutableStateFlow(true)
    val restoring: StateFlow<Boolean> = _restoring.asStateFlow()

    private val _sync = MutableStateFlow<SyncState>(SyncState.LocalOnly)
    val syncState: StateFlow<SyncState> = _sync.asStateFlow()

    private var syncJob: Job? = null

    init {
        scope.launch {
            accounts.restoreSession()?.let { start(it) }
            _restoring.value = false
        }
    }

    fun start(session: Session) {
        _session.value?.session?.db?.close()
        val repo = PatientRepository(session.db) { scheduleSync() }
        val fs = cloud.firestore()
        val sync = if (fs != null && session.firebaseUid != null && session.cloudKey != null) {
            SyncManager(fs, session.firebaseUid, session.email, session.cloudKey, repo, settings)
        } else null
        _session.value = ActiveSession(session, repo, sync)
        _sync.value = if (sync == null) SyncState.LocalOnly else SyncState.Idle
        if (sync != null) {
            scope.launch {
                if (session.cloudKeyRotated) sync.onKeyRotated()
                scheduleSync(0)
            }
        }
    }

    fun logout() {
        syncJob?.cancel()
        val s = _session.value
        _session.value = null
        accounts.signOut()
        _sync.value = SyncState.LocalOnly
        scope.launch { runCatching { s?.session?.db?.close() } }
    }

    fun scheduleSync(delayMs: Long = 3_000) {
        val active = _session.value ?: return
        if (active.sync == null) return
        syncJob?.cancel()
        syncJob = scope.launch {
            delay(delayMs)
            runSync(active)
        }
    }

    suspend fun syncNow(): SyncState {
        val active = _session.value ?: return SyncState.LocalOnly
        if (active.sync == null) return SyncState.LocalOnly
        syncJob?.cancel()
        return runSync(active)
    }

    private suspend fun runSync(active: ActiveSession): SyncState {
        val sync = active.sync ?: return SyncState.LocalOnly
        val user = cloud.auth()?.currentUser
        if (user == null || user.uid != active.session.firebaseUid) {
            _sync.value = SyncState.Error("Sign out and sign in again (online) to resume cloud sync.")
            return _sync.value
        }
        _sync.value = SyncState.Running
        _sync.value = try {
            SyncState.Done(sync.sync(), System.currentTimeMillis())
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException && e !is kotlinx.coroutines.TimeoutCancellationException) throw e
            if (SyncManager.isNetworkError(e)) SyncState.Offline else SyncState.Error(e.message ?: e.javaClass.simpleName)
        }
        return _sync.value
    }
}
