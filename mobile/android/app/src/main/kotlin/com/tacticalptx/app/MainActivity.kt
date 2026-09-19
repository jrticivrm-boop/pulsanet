package com.tacticalptx.app

import android.app.ActivityOptions
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.view.WindowManager
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Channels:
 * - installer: OTA APK
 * - notifications: cancel, ringer, ringtone/ringback, bringToFront
 * - audio: modo AudioManager (anti-bloqueo WhatsApp)
 */
class MainActivity : FlutterActivity() {
    private val installerChannel = "com.tacticalptx.app/installer"
    private val notifyChannel = "com.tacticalptx.app/notifications"
    private val audioChannel = "com.tacticalptx.app/audio"
    private val networkChannel = "com.tacticalptx.app/network"

    private var callRingtone: Ringtone? = null
    private var callVibrator: Vibrator? = null
    private var ringbackTone: ToneGenerator? = null
    private var ringbackHandler: Handler? = null
    private var ringbackRunnable: Runnable? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var cellularCallback: ConnectivityManager.NetworkCallback? = null
    private var boundToCellular: Boolean = false

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        handleIncomingCallIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingCallIntent(intent)
    }

    /** Extras desde IncomingCallWakeService / FSI / Contestar en notificación. */
    private fun handleIncomingCallIntent(intent: Intent?) {
        if (intent == null) return
        val incoming = intent.getBooleanExtra("tacticalptx_incoming_call", false)
        if (!incoming) return
        val callId = intent.getStringExtra("tacticalptx_call_id").orEmpty()
        val autoAccept = intent.getStringExtra("tacticalptx_auto_accept")
        if (autoAccept == "1" && callId.isNotEmpty()) {
            IncomingCallWakeHelper.persistAccept(this, callId)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            } else {
                @Suppress("DEPRECATION")
                window.addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                )
            }
            acquireWakeLockBrief()
        } catch (_: Exception) {
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, installerChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "installApk" -> {
                        val path = call.argument<String>("path")
                        if (path.isNullOrBlank()) {
                            result.error("bad_args", "Falta path", null)
                            return@setMethodCallHandler
                        }
                        try {
                            result.success(installApk(path))
                        } catch (e: Exception) {
                            result.error("install_failed", e.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, notifyChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "cancelAll" -> {
                        notificationManager().cancelAll()
                        result.success(true)
                    }
                    "cancelTag" -> {
                        val tag = call.argument<String>("tag")
                        val id = call.argument<Int>("id") ?: 0
                        if (tag.isNullOrBlank()) {
                            notificationManager().cancel(id)
                        } else {
                            notificationManager().cancel(tag, id)
                            notificationManager().cancel(id)
                        }
                        result.success(true)
                    }
                    "getRingerMode" -> {
                        result.success(ringerModeName())
                    }
                    "startCallRingtone" -> {
                        try {
                            result.success(startCallRingtone())
                        } catch (e: Exception) {
                            result.error("ringtone_failed", e.message, null)
                        }
                    }
                    "stopCallRingtone" -> {
                        stopCallRingtone()
                        result.success(true)
                    }
                    "startOutgoingRingback" -> {
                        val maxRings = call.argument<Int>("maxRings") ?: 5
                        try {
                            startOutgoingRingback(maxRings.coerceIn(1, 20))
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("ringback_failed", e.message, null)
                        }
                    }
                    "stopOutgoingRingback" -> {
                        stopOutgoingRingback()
                        result.success(true)
                    }
                    "bringToFrontForCall" -> {
                        try {
                            bringToFrontForCall()
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("bring_front_failed", e.message, null)
                        }
                    }
                    // Samsung/Android 14+: sin este permiso la llamada solo es heads-up.
                    "ensureFullScreenIntent" -> {
                        try {
                            result.success(ensureFullScreenIntentPermission(openSettings = true))
                        } catch (e: Exception) {
                            result.error("fsi_failed", e.message, null)
                        }
                    }
                    "canUseFullScreenIntent" -> {
                        try {
                            result.success(ensureFullScreenIntentPermission(openSettings = false))
                        } catch (e: Exception) {
                            result.error("fsi_check_failed", e.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, audioChannel)
            .setMethodCallHandler { call, result ->
                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                when (call.method) {
                    "getMode" -> result.success(audioModeName(am.mode))
                    // Solo si NO está ya en normal: no cortar telefonía real.
                    "ensureNormalMode" -> {
                        try {
                            if (am.mode != AudioManager.MODE_NORMAL) {
                                am.mode = AudioManager.MODE_NORMAL
                            }
                            result.success(audioModeName(am.mode))
                        } catch (e: Exception) {
                            result.error("set_mode_failed", e.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, networkChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "preferCellular" -> {
                        Thread {
                            try {
                                val ok = preferCellular()
                                runOnUiThread { result.success(ok) }
                            } catch (e: Exception) {
                                runOnUiThread {
                                    result.error("net_failed", e.message, null)
                                }
                            }
                        }.start()
                    }
                    "clearBind" -> {
                        try {
                            clearNetworkBind()
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("net_clear_failed", e.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    override fun onDestroy() {
        stopCallRingtone()
        stopOutgoingRingback()
        releaseWakeLock()
        clearNetworkBind()
        super.onDestroy()
    }

    /**
     * Telmex HG8145 aísla Wi‑Fi del Ethernet: DuckDNS por Wi‑Fi no hace hairpin.
     * Fuerza sockets de la app por datos móviles (4G) aunque el Wi‑Fi esté activo.
     */
    private fun preferCellular(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val latch = java.util.concurrent.CountDownLatch(1)
        var ok = false
        clearNetworkBindLocked(cm)

        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                try {
                    cm.bindProcessToNetwork(network)
                    ok = true
                    boundToCellular = true
                } catch (_: Exception) {
                    ok = false
                }
                latch.countDown()
            }

            override fun onUnavailable() {
                latch.countDown()
            }
        }
        cellularCallback = cb
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                cm.requestNetwork(request, cb, 8_000)
            } else {
                cm.requestNetwork(request, cb)
            }
        } catch (e: Exception) {
            cellularCallback = null
            throw e
        }
        latch.await(10, java.util.concurrent.TimeUnit.SECONDS)
        return ok && boundToCellular
    }

    private fun clearNetworkBind() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        clearNetworkBindLocked(cm)
    }

    private fun clearNetworkBindLocked(cm: ConnectivityManager) {
        try {
            cm.bindProcessToNetwork(null)
        } catch (_: Exception) {
        }
        cellularCallback?.let { cb ->
            try {
                cm.unregisterNetworkCallback(cb)
            } catch (_: Exception) {
            }
        }
        cellularCallback = null
        boundToCellular = false
    }

    private fun ringerModeName(): String {
        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        return when (am.ringerMode) {
            AudioManager.RINGER_MODE_SILENT -> "silent"
            AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
            else -> "normal"
        }
    }

    /** Ringtone del sistema + vibración estilo llamada. Respeta silencio. */
    private fun startCallRingtone(): String {
        stopOutgoingRingback()
        stopCallRingtone()

        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val mode = when (am.ringerMode) {
            AudioManager.RINGER_MODE_SILENT -> "silent"
            AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
            else -> "normal"
        }
        if (mode == "silent") return mode

        if (mode == "normal") {
            val uri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(applicationContext, uri)
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    ringtone.isLooping = true
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    ringtone.audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                }
                ringtone.play()
                callRingtone = ringtone
            }
        }

        startCallVibration()
        return mode
    }

    private fun stopCallRingtone() {
        try {
            callRingtone?.stop()
        } catch (_: Exception) {
        }
        callRingtone = null
        stopCallVibration()
    }

    private fun startCallVibration() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        callVibrator = vibrator
        // patrón teléfono: wait, buzz, wait, buzz…
        val pattern = longArrayOf(0, 500, 400, 500, 400)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, 0)
        }
    }

    private fun stopCallVibration() {
        try {
            callVibrator?.cancel()
        } catch (_: Exception) {
        }
        callVibrator = null
    }

    /**
     * Ringback saliente (tono de red). [maxRings] ráfagas ~4 s + pausa,
     * alineado al sweeper Dart (~5 × 5 s).
     */
    private fun startOutgoingRingback(maxRings: Int) {
        stopCallRingtone()
        stopOutgoingRingback()

        val tg = ToneGenerator(AudioManager.STREAM_VOICE_CALL, 70)
        ringbackTone = tg
        val handler = Handler(Looper.getMainLooper())
        ringbackHandler = handler
        var remaining = maxRings

        val tick = object : Runnable {
            override fun run() {
                if (remaining <= 0) {
                    stopOutgoingRingback()
                    return
                }
                remaining -= 1
                try {
                    // SUP_RINGTONE ≈ doble tono de llamada (USA/México style)
                    tg.startTone(ToneGenerator.TONE_SUP_RINGTONE, 3000)
                } catch (_: Exception) {
                    stopOutgoingRingback()
                    return
                }
                handler.postDelayed(this, 5000L)
            }
        }
        ringbackRunnable = tick
        handler.post(tick)
    }

    private fun stopOutgoingRingback() {
        ringbackRunnable?.let { r ->
            ringbackHandler?.removeCallbacks(r)
        }
        ringbackRunnable = null
        ringbackHandler = null
        try {
            ringbackTone?.stopTone()
            ringbackTone?.release()
        } catch (_: Exception) {
        }
        ringbackTone = null
    }

    /**
     * Android 14+ / Samsung: comprobar (y opcionalmente abrir ajustes de)
     * «Permitir intents a pantalla completa» — sin eso solo sale heads-up.
     */
    private fun ensureFullScreenIntentPermission(openSettings: Boolean): Boolean {
        if (Build.VERSION.SDK_INT < 34) return true
        val nm = notificationManager()
        if (nm.canUseFullScreenIntent()) return true
        if (!openSettings) return false
        try {
            startActivity(
                Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                    data = Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
            )
        } catch (_: Exception) {
            startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
            )
        }
        return false
    }

    /**
     * Despierta pantalla, muestra sobre lockscreen y trae la Activity al frente
     * sin recrear el proceso (singleTop + reorder). Galaxy Tab: flags extra.
     */
    private fun bringToFrontForCall() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val kg = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            kg.requestDismissKeyguard(this, null)
        }

        acquireWakeLockBrief()

        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            putExtra("tacticalptx_incoming_call", true)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED,
            )
        }
        if (Build.VERSION.SDK_INT >= 34) {
            val opts = ActivityOptions.makeBasic()
            @Suppress("DEPRECATION")
            opts.setPendingIntentBackgroundActivityStartMode(
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED,
            )
            startActivity(intent, opts.toBundle())
        } else {
            startActivity(intent)
        }
    }

    private fun acquireWakeLockBrief() {
        releaseWakeLock()
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        val wl = pm.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "tacticalptx:incoming_call",
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

    private fun audioModeName(mode: Int): String = when (mode) {
        AudioManager.MODE_NORMAL -> "normal"
        AudioManager.MODE_RINGTONE -> "ringtone"
        AudioManager.MODE_IN_CALL -> "inCall"
        AudioManager.MODE_IN_COMMUNICATION -> "inCommunication"
        AudioManager.MODE_CALL_SCREENING -> "callScreening"
        else -> "unknown($mode)"
    }

    private fun notificationManager(): NotificationManager =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun installApk(path: String): Boolean {
        val file = File(path)
        if (!file.exists() || !file.canRead()) {
            throw IllegalArgumentException("APK no legible")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!packageManager.canRequestPackageInstalls()) {
                val settings = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:$packageName"),
                )
                settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(settings)
                return false
            }
        }

        val uri = FileProvider.getUriForFile(
            this,
            "$packageName.fileprovider",
            file,
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
        return true
    }
}
