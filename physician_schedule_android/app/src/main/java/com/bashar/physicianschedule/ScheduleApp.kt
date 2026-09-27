package com.bashar.physicianschedule

import android.app.Application
import android.content.Context
import com.bashar.physicianschedule.data.AppDatabase
import com.bashar.physicianschedule.data.ScheduleRepository
import com.bashar.physicianschedule.data.SettingsRepository
import com.bashar.physicianschedule.notify.ReminderScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/** Manual dependency container; one instance per process. */
class AppContainer(context: Context) {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val database = AppDatabase.build(context)
    val repository = ScheduleRepository(database)
    val settings = SettingsRepository(context)
    val reminders = ReminderScheduler(context, repository, settings)
}

class ScheduleApp : Application() {
    lateinit var container: AppContainer
        private set

    @OptIn(FlowPreview::class)
    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        container.reminders.createChannel()
        container.appScope.launch {
            container.repository.ensureDefaults()
            // Any data or settings change re-plans the reminders, so edits and deletions
            // update or cancel their notifications.
            combine(container.repository.version, container.settings.settings) { v, s -> v to s.notificationsEnabled }
                .debounce(400)
                .collectLatest { container.reminders.reschedule() }
        }
    }
}

val Context.container: AppContainer get() = (applicationContext as ScheduleApp).container
