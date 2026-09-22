package com.tacticalptx.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingReceiver

/**
 * Intercepta FCM C2DM antes del isolate Dart: despierta Contestar con FGS nativo.
 * Luego delega al receiver de FlutterFire (sin perder onBackgroundMessage).
 */
class CallWakeFirebaseMessagingReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "CallWakeFcmReceiver"

        /** Extrae data payload FCM sin depender de la API RemoteMessage en compile. */
        fun dataFromExtras(extras: Bundle): Map<String, String> {
            val out = LinkedHashMap<String, String>()
            for (key in extras.keySet()) {
                if (key == null) continue
                // Metadatos FCM / GCM — no son data de app.
                if (key == "from" ||
                    key == "message_type" ||
                    key == "collapse_key" ||
                    key.startsWith("google.") ||
                    key.startsWith("gcm.")
                ) {
                    continue
                }
                val raw = extras.get(key) ?: continue
                out[key] = raw.toString()
            }
            return out
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        try {
            val extras = intent.extras
            if (extras != null) {
                val data = dataFromExtras(extras)
                val type = data["type"]
                if (IncomingCallWakeHelper.isCallPushType(type)) {
                    val foreground = IncomingCallWakeHelper.isAppInForeground(context)
                    if (!foreground) {
                        val callId = data["callId"] ?: ""
                        Log.i(TAG, "native call wake type=$type callId=$callId")
                        IncomingCallWakeHelper.wake(context, data)
                    } else {
                        Log.i(TAG, "app foreground — Dart Contestar; skip FGS wake")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "pre-wake failed", e)
        }

        // Misma ruta que FlutterFire (foreground LiveData / background isolate).
        try {
            FlutterFirebaseMessagingReceiver().onReceive(context, intent)
        } catch (e: Exception) {
            Log.e(TAG, "FlutterFirebaseMessagingReceiver failed", e)
        }
    }
}
