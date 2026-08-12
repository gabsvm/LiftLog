package com.gabsvm.liftlog.nativeapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

/** Keeps the rest countdown visible when LiftLog is backgrounded. */
class RestTimerService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var endEpochMillis: Long = 0L

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopTimer()
            return START_NOT_STICKY
        }
        endEpochMillis = intent?.getLongExtra(EXTRA_END_EPOCH_MILLIS, 0L) ?: 0L
        if (endEpochMillis <= System.currentTimeMillis()) {
            stopTimer()
            return START_NOT_STICKY
        }
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        handler.removeCallbacksAndMessages(null)
        handler.post(tick)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private val tick = object : Runnable {
        override fun run() {
            if (endEpochMillis <= System.currentTimeMillis()) {
                stopTimer()
            } else {
                getSystemService(NotificationManager::class.java)
                    .notify(NOTIFICATION_ID, buildNotification())
                handler.postDelayed(this, 1000L)
            }
        }
    }

    private fun stopTimer() {
        handler.removeCallbacksAndMessages(null)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
        else @Suppress("DEPRECATION") stopForeground(true)
        stopSelf()
    }

    private fun buildNotification(): Notification {
        val remaining = ((endEpochMillis - System.currentTimeMillis() + 999L) / 1000L).coerceAtLeast(0L)
        val minutes = remaining / 60
        val seconds = remaining % 60
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_pause)
            .setContentTitle("Descanso en LiftLog")
            .setContentText("%02d:%02d restantes".format(minutes, seconds))
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Temporizador de descanso", NotificationManager.IMPORTANCE_LOW),
            )
        }
    }

    companion object {
        const val ACTION_START = "com.gabsvm.liftlog.nativeapp.action.START_REST"
        const val ACTION_STOP = "com.gabsvm.liftlog.nativeapp.action.STOP_REST"
        const val EXTRA_END_EPOCH_MILLIS = "end_epoch_millis"
        private const val CHANNEL_ID = "liftlog_rest_timer"
        private const val NOTIFICATION_ID = 42
    }
}
