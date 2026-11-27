package com.kash.cleancooking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.RingtoneManager
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import androidx.core.app.NotificationCompat

class TimerForegroundService : Service() {
  private var countDownTimer: CountDownTimer? = null
  private val ongoingChannelId = "clean_cooking_timer_ongoing"
  private val alertChannelId = "clean_cooking_timers"
  private val ongoingNotifId = 2001

  companion object {
    const val ACTION_START = "com.kash.cleancooking.TIMER_START"
    const val ACTION_STOP = "com.kash.cleancooking.TIMER_STOP"
    const val EXTRA_SECONDS = "seconds"
    const val EXTRA_TITLE = "title"
    const val EXTRA_MESSAGE = "message"
  }

  override fun onCreate() {
    super.onCreate()
    createChannels()
  }

  private fun createChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val ongoing = NotificationChannel(
        ongoingChannelId,
        "Active Cooking Countdown",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Shows your live ticking oven preheat or recipe timer"
        setShowBadge(false)
      }
      val alert = NotificationChannel(
        alertChannelId,
        "Cooking & Preheat Timers",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Alerts when oven preheat or recipe cooking timers finish"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 500)
      }
      nm.createNotificationChannel(ongoing)
      nm.createNotificationChannel(alert)
    }
  }

  private fun buildOngoingNotification(title: String, remainingSec: Int): Notification {
    val mins = remainingSec / 60
    val secs = remainingSec % 60
    val clockStr = String.format("%d:%02d", mins, secs)

    val openIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val openPending = PendingIntent.getActivity(
      this, 2002, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val stopIntent = Intent(this, TimerForegroundService::class.java).apply {
      action = ACTION_STOP
    }
    val stopPending = PendingIntent.getService(
      this, 2003, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, ongoingChannelId)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("$clockStr remaining — $title")
      .setContentText("Clean Cooking timer running in background")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(openPending)
      .addAction(0, "Stop Timer", stopPending)
      .build()
  }

  private fun fireCompleteNotification(title: String, message: String) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val openIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this, 2004, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

    val notif = NotificationCompat.Builder(this, alertChannelId)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(message)
      .setStyle(NotificationCompat.BigTextStyle().bigText(message))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setAutoCancel(true)
      .setSound(soundUri)
      .setVibrate(longArrayOf(0, 300, 150, 300, 150, 500))
      .setContentIntent(pendingIntent)
      .build()

    nm.notify((System.currentTimeMillis() % 100000).toInt(), notif)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        countDownTimer?.cancel()
        countDownTimer = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_START -> {
        val seconds = intent.getIntExtra(EXTRA_SECONDS, 60).coerceAtLeast(1)
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Clean Cooking Timer"
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: "Your timer is READY!"

        countDownTimer?.cancel()
        val initialNotif = buildOngoingNotification(title, seconds)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          startForeground(ongoingNotifId, initialNotif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
          startForeground(ongoingNotifId, initialNotif)
        }

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        countDownTimer = object : CountDownTimer(seconds * 1000L, 1000L) {
          override fun onTick(millisUntilFinished: Long) {
            val rem = ((millisUntilFinished + 500L) / 1000L).toInt().coerceAtLeast(0)
            nm.notify(ongoingNotifId, buildOngoingNotification(title, rem))
          }

          override fun onFinish() {
            stopForeground(STOP_FOREGROUND_REMOVE)
            fireCompleteNotification(title, message)
            stopSelf()
          }
        }.start()
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    countDownTimer?.cancel()
    countDownTimer = null
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
