package com.tacticalptx.app

import android.app.ActivityOptions
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat

/**
 * FGS breve: publica notificación CallStyle + FSI y arranca MainActivity.
 * Con pantalla encendida Android degrada FSI a heads-up; startActivity desde
 * este servicio es el camino para abrir Contestar (estilo WhatsApp).
 */
class IncomingCallWakeService : Service() {
    companion object {
        private const val TAG = "IncomingCallWakeSvc"
        const val CHANNEL_ID = "tacticalptx_calls_v4_silent"
        const val CHANNEL_NAME = "Llamadas SICOM"
        private const val ACTION_START = "com.tacticalptx.app.INCOMING_CALL_WAKE"
        private const val EXTRA_CALL_ID = "callId"
        private const val EXTRA_CALLER_NAME = "callerName"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_BODY = "body"
        private const val EXTRA_MODE = "mode"
        private const val EXTRA_TYPE = "type"

        fun start(context: Context, data: Map<String, String>) {
            val intent = Intent(context, IncomingCallWakeService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_CALL_ID, data["callId"] ?: "")
                putExtra(
                    EXTRA_CALLER_NAME,
                    data["callerName"] ?: data["title"] ?: "Usuario",
                )
                putExtra(EXTRA_TITLE, data["title"] ?: "Llamada entrante")
                putExtra(EXTRA_BODY, data["body"] ?: "")
                putExtra(EXTRA_MODE, data["mode"] ?: "call")
                putExtra(EXTRA_TYPE, data["type"] ?: "private_call")
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun notifIdForCall(callId: String): Int {
            val tag = "call:$callId"
            return tag.hashCode() and 0x7fffffff
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val callId = intent?.getStringExtra(EXTRA_CALL_ID).orEmpty()
        val callerName = intent?.getStringExtra(EXTRA_CALLER_NAME) ?: "Usuario"
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Llamada entrante"
        val body = intent?.getStringExtra(EXTRA_BODY)
            ?: "$callerName te está llamando"
        val mode = intent?.getStringExtra(EXTRA_MODE) ?: "call"

        ensureChannel()
        acquireWakeLockBrief()

        val notifId = if (callId.isNotEmpty()) notifIdForCall(callId) else 42001
        val notification = buildCallNotification(
            notifId = notifId,
            callId = callId,
            callerName = callerName,
            title = title,
            body = body,
            mode = mode,
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    notifId,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
                )
            } else {
                @Suppress("DEPRECATION")
                startForeground(notifId, notification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "startForeground", e)
            try {
                startForeground(notifId, notification)
            } catch (e2: Exception) {
                Log.e(TAG, "startForeground fallback", e2)
            }
        }

        // Re-publicar por NotificationManager (mismo id) por si el SO
        // necesita el FSI fuera del ciclo startForeground.
        try {
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.notify("call:$callId", notifId, notification)
        } catch (e: Exception) {
            Log.w(TAG, "notify", e)
        }

        val data = mapOf(
            "callId" to callId,
            "callerName" to callerName,
            "mode" to mode,
        )
        // Varios intentos: Samsung a veces bloquea el primero.
        launchNow(data)
        Handler(Looper.getMainLooper()).postDelayed({ launchNow(data) }, 400)
        Handler(Looper.getMainLooper()).postDelayed({ launchNow(data) }, 1200)
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(false)
                }
            } catch (_: Exception) {
            }
            stopSelf()
        }, 3500)

        return START_NOT_STICKY
    }

    private fun launchNow(data: Map<String, String>) {
        try {
            IncomingCallWakeHelper.launchMainActivity(this, data)
        } catch (e: Exception) {
            Log.e(TAG, "launchMainActivity", e)
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val existing = nm.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return
        val ch = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Llamadas y videollamadas (timbre vía app)"
            setSound(null, null)
            enableVibration(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(ch)
    }

    private fun buildCallNotification(
        notifId: Int,
        callId: String,
        callerName: String,
        title: String,
        body: String,
        mode: String,
    ): Notification {
        val fullIntent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            putExtra("tacticalptx_incoming_call", true)
            putExtra("tacticalptx_call_id", callId)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP,
            )
        }
        val contentPi = activityPi(notifId, fullIntent)

        val acceptIntent = Intent(this, MainActivity::class.java).apply {
            action = "com.tacticalptx.app.CALL_ACCEPT"
            putExtra("tacticalptx_incoming_call", true)
            putExtra("tacticalptx_call_id", callId)
            putExtra("tacticalptx_auto_accept", "1")
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP,
            )
        }
        val acceptPi = activityPi(notifId + 1, acceptIntent)

        val declineIntent = Intent(this, IncomingCallActionReceiver::class.java).apply {
            action = IncomingCallActionReceiver.ACTION_REJECT
            putExtra(EXTRA_CALL_ID, callId)
        }
        val declinePi = PendingIntent.getBroadcast(
            this,
            notifId + 2,
            declineIntent,
            pendingFlags(),
        )

        val caller = Person.Builder()
            .setName(callerName)
            .setImportant(true)
            .build()

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(title)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(55_000)
            .setContentIntent(contentPi)
            .setFullScreenIntent(contentPi, true)
            .setSound(null)
            .setSilent(true)
            .addPerson(caller)

        // CallStyle (API 31+ / AndroidX): UI de llamada; ayuda en Samsung.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setStyle(
                    NotificationCompat.CallStyle.forIncomingCall(
                        caller,
                        declinePi,
                        acceptPi,
                    ),
                )
            } else {
                builder
                    .addAction(0, "Contestar", acceptPi)
                    .addAction(0, "Rechazar", declinePi)
            }
        } catch (e: Exception) {
            Log.w(TAG, "CallStyle fallback", e)
            builder
                .addAction(0, "Contestar", acceptPi)
                .addAction(0, "Rechazar", declinePi)
        }

        // Icono app si existe.
        try {
            val appIcon = IconCompat.createWithResource(this, R.mipmap.ic_launcher)
            builder.setSmallIcon(appIcon)
        } catch (_: Exception) {
        }

        @Suppress("UNUSED_VARIABLE")
        val unusedMode = mode
        return builder.build()
    }

    private fun activityPi(requestCode: Int, intent: Intent): PendingIntent {
        val flags = pendingFlags()
        return if (Build.VERSION.SDK_INT >= 34) {
            val opts = ActivityOptions.makeBasic()
            @Suppress("DEPRECATION")
            opts.setPendingIntentBackgroundActivityStartMode(
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED,
            )
            PendingIntent.getActivity(this, requestCode, intent, flags, opts.toBundle())
        } else {
            PendingIntent.getActivity(this, requestCode, intent, flags)
        }
    }

    private fun pendingFlags(): Int {
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        return flags
    }

    private fun acquireWakeLockBrief() {
        releaseWakeLock()
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        val wl = pm.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "tacticalptx:incoming_call_svc",
        )
        wl.setReferenceCounted(false)
        wl.acquire(15_000L)
        wakeLock = wl
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }
}
