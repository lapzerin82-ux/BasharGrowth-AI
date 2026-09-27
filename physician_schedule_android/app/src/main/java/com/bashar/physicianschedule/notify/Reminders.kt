package com.bashar.physicianschedule.notify

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.bashar.physicianschedule.R
import com.bashar.physicianschedule.container
import com.bashar.physicianschedule.data.ScheduleRepository
import com.bashar.physicianschedule.data.SettingsRepository
import com.bashar.physicianschedule.ui.MainActivity
import com.bashar.physicianschedule.ui.common.formatTime
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Plans local notifications for the next [HORIZON_DAYS] days. Rather than tracking individual
 * alarms, every change cancels all previously scheduled reminders and schedules the current
 * set, which keeps edits, moves and deletions of single occurrences or whole series correct.
 * A daily refresh alarm extends the horizon for recurring events.
 */
class ReminderScheduler(
    private val context: Context,
    private val repository: ScheduleRepository,
    private val settings: SettingsRepository,
) {
    private val alarms = context.getSystemService(AlarmManager::class.java)

    fun createChannel() {
        val channel = NotificationChannel(CHANNEL_ID, context.getString(R.string.notif_channel), NotificationManager.IMPORTANCE_HIGH)
        channel.description = context.getString(R.string.notif_channel_desc)
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    suspend fun reschedule() {
        settings.scheduledReminderCodes.forEach { code ->
            PendingIntent.getBroadcast(
                context, code, Intent(context, ReminderReceiver::class.java).setAction(ACTION_REMIND),
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            )
                ?.let { alarms.cancel(it); it.cancel() }
        }
        settings.scheduledReminderCodes = emptySet()
        if (!settings.settings.value.notificationsEnabled) return

        val now = LocalDateTime.now()
        val today = LocalDate.now()
        val zone = ZoneId.systemDefault()
        val use24 = settings.settings.value.use24Hour
        val codes = HashSet<Int>()
        repository.occurrences(today, today.plusDays(HORIZON_DAYS)).forEach { o ->
            val minutes = o.reminderMinutes ?: return@forEach
            val trigger = o.start.minusMinutes(minutes.toLong())
            if (!trigger.isAfter(now)) return@forEach
            val code = (o.key + "@" + trigger).hashCode()
            val intent = Intent(context, ReminderReceiver::class.java)
                .setAction(ACTION_REMIND)
                .putExtra(EXTRA_KEY, o.key)
                .putExtra(EXTRA_TITLE, o.title)
                .putExtra(EXTRA_TIME, formatTime(o.startTime, use24))
                .putExtra(EXTRA_DATE, o.date.toString())
                .putExtra(EXTRA_LOCATION, o.location)
            val pi = PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            setAlarm(trigger.atZone(zone).toInstant().toEpochMilli(), pi)
            codes += code
        }
        // Refresh shortly after midnight so the rolling horizon keeps moving forward.
        val refresh = PendingIntent.getBroadcast(
            context, REFRESH_CODE, Intent(context, ReminderReceiver::class.java).setAction(ACTION_REFRESH),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        alarms.set(AlarmManager.RTC, today.plusDays(1).atTime(0, 5).atZone(zone).toInstant().toEpochMilli(), refresh)
        settings.scheduledReminderCodes = codes
    }

    private fun setAlarm(at: Long, pi: PendingIntent) {
        try {
            val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
            if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } catch (e: SecurityException) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }

    companion object {
        const val CHANNEL_ID = "reminders"
        const val HORIZON_DAYS = 14L
        const val REFRESH_CODE = 1
        const val ACTION_REMIND = "com.bashar.physicianschedule.REMIND"
        const val ACTION_REFRESH = "com.bashar.physicianschedule.REFRESH"
        const val EXTRA_KEY = "occurrenceKey"
        const val EXTRA_TITLE = "title"
        const val EXTRA_TIME = "time"
        const val EXTRA_DATE = "date"
        const val EXTRA_LOCATION = "location"
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ReminderScheduler.ACTION_REFRESH -> {
                val pending = goAsync()
                context.container.appScope.launch {
                    try { context.container.reminders.reschedule() } finally { pending.finish() }
                }
            }
            ReminderScheduler.ACTION_REMIND -> show(context, intent)
        }
    }

    private fun show(context: Context, intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val key = intent.getStringExtra(ReminderScheduler.EXTRA_KEY) ?: return
        val title = intent.getStringExtra(ReminderScheduler.EXTRA_TITLE).orEmpty()
        val time = intent.getStringExtra(ReminderScheduler.EXTRA_TIME).orEmpty()
        val location = intent.getStringExtra(ReminderScheduler.EXTRA_LOCATION).orEmpty()
        val open = PendingIntent.getActivity(
            context, key.hashCode(),
            Intent(context, MainActivity::class.java).putExtra(ReminderScheduler.EXTRA_KEY, key).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.notif_upcoming, title, time))
            .setContentText(location.ifBlank { null })
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(key.hashCode(), notification)
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        context.container.appScope.launch {
            try { context.container.reminders.reschedule() } finally { pending.finish() }
        }
    }
}
